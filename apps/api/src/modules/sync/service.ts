import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type {
  SyncChange,
  SyncEntity,
  SyncMutation,
  SyncMutationResult,
  SyncMutationStatus,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from '@dwaso/shared-types';
import { isEventEntity } from '@dwaso/shared-types';
import type { Database, Transaction } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import {
  reserveSeqBlock,
  withTenantScope,
  withTenantTransaction,
  type TenantContext,
} from '../../lib/tenant.js';
import { dayBoundsUtc, shopDate } from '../../lib/time.js';
import { shops, syncDeviceState, syncMutations } from '../../db/schema/index.js';
import {
  rebuildCreditorBalance,
  rebuildDailyMetrics,
  rebuildProductStock,
} from '../projections/service.js';
import { ENTITY_REGISTRY, deserialisePayload, serialiseRow, syncColumnsOf } from './registry.js';

/**
 * Projections touched by a batch. Rather than applying incremental deltas per
 * mutation, the batch records what it affected and rebuilds those projections
 * from the event log once at the end.
 *
 * That distinction matters here specifically. A client may replay a batch it
 * already sent, or split a sale across two batches so the items arrive after the
 * sale. Recomputing from the log is correct under both; incremental deltas would
 * double-count the first and miss the second.
 */
type AffectedProjections = {
  productIds: Set<string>;
  creditorIds: Set<string>;
  dates: Set<string>;
};

type MutationOutcome = {
  status: Exclude<SyncMutationStatus, 'rejected'>;
  message?: string;
};

export class SyncService {
  constructor(private readonly db: Database) {}

  async push(tenant: TenantContext, request: SyncPushRequest): Promise<SyncPushResponse> {
    return withTenantTransaction(this.db, tenant, async (tx) => {
      const shop = await this.loadShop(tx, tenant.shopId);

      const results: SyncMutationResult[] = [];
      const affected: AffectedProjections = {
        productIds: new Set(),
        creditorIds: new Set(),
        dates: new Set(),
      };

      const alreadyApplied = await this.findAppliedMutations(
        tx,
        request.mutations.map((mutation) => mutation.mutationId),
      );

      const pending = request.mutations.filter(
        (mutation) => !alreadyApplied.has(mutation.mutationId),
      );

      // Sequence numbers are claimed once for the whole batch. Claiming them one
      // at a time would take and release the shop's row lock per mutation, which
      // on a 500-row catch-up after a week offline is 500 extra round trips.
      let seq = pending.length ? await reserveSeqBlock(tx, tenant.shopId, pending.length) : 0;

      for (const mutation of request.mutations) {
        if (alreadyApplied.has(mutation.mutationId)) {
          results.push({
            mutationId: mutation.mutationId,
            status: 'duplicate',
            serverSeq: alreadyApplied.get(mutation.mutationId) ?? null,
            message: null,
          });
          continue;
        }

        const assignedSeq = seq;
        seq += 1;

        // Each mutation runs in a nested transaction (a Postgres savepoint) so a
        // foreign-key failure — the classic out-of-order case of a stock movement
        // arriving before its product — rejects that one row without aborting the
        // rest of the batch.
        try {
          const outcome = await tx.transaction(async (inner) =>
            this.applyMutation(
              inner,
              tenant.withExecutor(inner),
              shop.timezone,
              mutation,
              assignedSeq,
              affected,
            ),
          );

          results.push({
            mutationId: mutation.mutationId,
            status: outcome.status,
            serverSeq: outcome.status === 'applied' ? assignedSeq : null,
            message: outcome.message ?? null,
          });

          await tx.insert(syncMutations).values({
            mutationId: mutation.mutationId,
            shopId: tenant.shopId,
            deviceId: request.deviceId,
            entity: mutation.entity,
            entityId: mutation.entityId,
            op: mutation.op,
            serverSeq: outcome.status === 'applied' ? assignedSeq : null,
          });
        } catch (error) {
          // A rejection is permanent: retrying produces the same failure, so the
          // client must drop the mutation rather than wedge its whole outbox
          // behind one malformed row forever.
          const message =
            error instanceof AppError ? error.message : 'Mutation could not be applied';

          this.logRejection(mutation, error);

          results.push({
            mutationId: mutation.mutationId,
            status: 'rejected',
            serverSeq: null,
            message,
          });

          await tx.insert(syncMutations).values({
            mutationId: mutation.mutationId,
            shopId: tenant.shopId,
            deviceId: request.deviceId,
            entity: mutation.entity,
            entityId: mutation.entityId,
            op: mutation.op,
            serverSeq: null,
          });
        }
      }

      await this.rebuildAffected(tx, tenant.shopId, shop.timezone, affected);

      await tx
        .insert(syncDeviceState)
        .values({ deviceId: request.deviceId, shopId: tenant.shopId, lastPushedAt: new Date() })
        .onConflictDoUpdate({
          target: syncDeviceState.deviceId,
          set: { lastPushedAt: new Date() },
        });

      return { results, cursor: await this.currentSeq(tx, tenant.shopId) };
    });
  }

  private async applyMutation(
    tx: Transaction,
    tenant: TenantContext,
    timezone: string,
    mutation: SyncMutation,
    seq: number,
    affected: AffectedProjections,
  ): Promise<MutationOutcome> {
    const entry = ENTITY_REGISTRY[mutation.entity];
    if (!entry) throw AppError.badRequest(`Unknown sync entity: ${mutation.entity}`);

    const parsed = entry.schema.safeParse({ ...mutation.payload, id: mutation.entityId });
    if (!parsed.success) {
      throw AppError.badRequest(
        `Payload does not match the ${mutation.entity} contract`,
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
    }

    const values = deserialisePayload(entry.table, mutation.payload as Record<string, unknown>);

    // The shop row is the tenant itself and is not part of the replicated change
    // stream. Renames go through /shops, not through sync.
    if (mutation.entity === 'shop') {
      throw AppError.badRequest('Shop updates are not synced; use the shops endpoint');
    }

    const outcome = isEventEntity(mutation.entity)
      ? await this.applyEventMutation(tx, tenant, mutation, values, seq)
      : await this.applyMutableMutation(tx, tenant, mutation, values, seq);

    // Only rebuild projections for mutations that actually landed. A rejected
    // stock movement for an unknown product must not try to upsert a stock row
    // that would itself violate the foreign key.
    if (outcome.status === 'applied') {
      this.trackAffected(mutation, values, timezone, affected);
    }

    return outcome;
  }

  private async applyEventMutation(
    tx: Transaction,
    tenant: TenantContext,
    mutation: SyncMutation,
    values: Record<string, unknown>,
    seq: number,
  ): Promise<MutationOutcome> {
    if (mutation.op === 'delete') {
      // Events are immutable. A mistake is corrected by appending a compensating
      // event, which keeps the correction itself part of the audit trail.
      throw AppError.badRequest(`${mutation.entity} rows are append-only and cannot be deleted`);
    }

    const entry = ENTITY_REGISTRY[mutation.entity];
    const columns = syncColumnsOf(entry.table);
    if (!columns) throw AppError.badRequest(`${mutation.entity} cannot be pushed`);

    const inserted = await tx
      .insert(entry.table)
      .values({
        ...values,
        id: mutation.entityId,
        shopId: tenant.shopId,
        serverSeq: seq,
        updatedAt: new Date(),
        updatedByDeviceId: tenant.deviceId,
      })
      // Insert-if-absent. Replaying an event is a no-op, which is precisely what
      // lets a client retry as aggressively as a market connection demands.
      .onConflictDoNothing({ target: columns.id })
      .returning({ id: columns.id });

    return inserted.length
      ? { status: 'applied' }
      : { status: 'duplicate', message: 'This event was already recorded' };
  }

  /**
   * Last-writer-wins on the client's timestamp, with the device id as a
   * deterministic tiebreak so two devices that wrote in the same millisecond
   * converge on the same winner rather than flip-flopping on every sync.
   */
  private async applyMutableMutation(
    tx: Transaction,
    tenant: TenantContext,
    mutation: SyncMutation,
    values: Record<string, unknown>,
    seq: number,
  ): Promise<MutationOutcome> {
    const entry = ENTITY_REGISTRY[mutation.entity];
    const columns = syncColumnsOf(entry.table);
    if (!columns) throw AppError.badRequest(`${mutation.entity} cannot be pushed`);

    const clientTimestamp = new Date(mutation.clientTimestamp);

    const [existing] = await tx
      .select({ updatedAt: columns.updatedAt, deviceId: columns.updatedByDeviceId })
      .from(entry.table)
      .where(and(eq(columns.id, mutation.entityId), eq(columns.shopId, tenant.shopId)))
      .limit(1);

    if (existing) {
      const existingAt = new Date(existing.updatedAt as string | Date).getTime();
      const incomingAt = clientTimestamp.getTime();
      const existingDevice = (existing.deviceId as string | null) ?? '';

      const loses =
        incomingAt < existingAt || (incomingAt === existingAt && existingDevice > tenant.deviceId);

      if (loses) {
        return {
          status: 'superseded',
          message: 'A newer version of this record already exists on the server',
        };
      }
    }

    const row: Record<string, unknown> = {
      ...values,
      id: mutation.entityId,
      shopId: tenant.shopId,
      serverSeq: seq,
      updatedAt: clientTimestamp,
      updatedByDeviceId: tenant.deviceId,
      ...(mutation.op === 'delete' ? { deletedAt: new Date() } : {}),
    };

    // The shop's identity is never rewritten by an update; everything else is.
    const { id: _id, shopId: _shopId, ...updateSet } = row;

    await tx
      .insert(entry.table)
      .values(row)
      .onConflictDoUpdate({ target: columns.id, set: updateSet });

    return { status: 'applied' };
  }

  private trackAffected(
    mutation: SyncMutation,
    values: Record<string, unknown>,
    timezone: string,
    affected: AffectedProjections,
  ) {
    if (mutation.entity === 'stock_movement' && typeof values.productId === 'string') {
      affected.productIds.add(values.productId);
    }

    if (mutation.entity === 'credit_ledger_entry' && typeof values.creditorId === 'string') {
      affected.creditorIds.add(values.creditorId);
    }

    if (mutation.entity === 'sale' || mutation.entity === 'sale_item') {
      const occurredAt = values.occurredAt;
      affected.dates.add(shopDate(occurredAt instanceof Date ? occurredAt : new Date(), timezone));
    }
  }

  private async rebuildAffected(
    tx: Transaction,
    shopId: string,
    timezone: string,
    affected: AffectedProjections,
  ) {
    for (const productId of affected.productIds) {
      await rebuildProductStock(tx, shopId, productId);
    }

    for (const creditorId of affected.creditorIds) {
      await rebuildCreditorBalance(tx, shopId, creditorId);
    }

    for (const date of affected.dates) {
      const { start, end } = dayBoundsUtc(date, timezone);
      await rebuildDailyMetrics(tx, shopId, date, start, end);
    }
  }

  /**
   * Returns changes across every replicated entity as one `serverSeq`-ordered
   * stream, so the client applies them in causal order: a sale item never lands
   * before the sale that owns it.
   */
  async pull(tenant: TenantContext, since: number, limit: number): Promise<SyncPullResponse> {
    return withTenantScope(this.db, tenant, async (scoped) => {
      const [shop] = await scoped.db
        .select({ seq: shops.seq, floor: shops.tombstoneFloorSeq })
        .from(shops)
        .where(eq(shops.id, tenant.shopId))
        .limit(1);

      if (!shop) throw AppError.notFound('Shop');

      // A device whose cursor predates the purged tombstones cannot be told what
      // it missed, because the rows recording those deletions are gone. Rebuilding
      // from scratch is the only answer that leaves it consistent.
      if (since > 0 && since < shop.floor) {
        return { changes: [], nextCursor: shop.seq, hasMore: false, resyncRequired: true };
      }

      const collected: SyncChange[] = [];

      for (const entity of Object.keys(ENTITY_REGISTRY) as SyncEntity[]) {
        const entry = ENTITY_REGISTRY[entity];
        const columns = syncColumnsOf(entry.table);
        // Shop is the tenant row and has no shop_id / server_seq; see syncColumnsOf.
        if (!columns) continue;

        // Fetch one extra row per table so a full page is distinguishable from
        // a short one. Taking exactly `limit` would make a shop with twelve
        // products and a page size of five look finished after the first page.
        const rows = (await scoped.db
          .select()
          .from(entry.table)
          .where(and(eq(columns.shopId, tenant.shopId), gt(columns.serverSeq, since)))
          .orderBy(asc(columns.serverSeq))
          .limit(limit + 1)) as unknown as Record<string, unknown>[];

        for (const row of rows) {
          const deletedAt = row.deletedAt as Date | null;

          collected.push({
            entity,
            id: row.id as string,
            serverSeq: Number(row.serverSeq),
            deletedAt: deletedAt ? deletedAt.toISOString() : null,
            // A tombstone carries no payload. The client only needs to know the
            // row is gone, and shipping its former contents would re-transmit
            // data the trader deliberately deleted.
            data: deletedAt ? null : serialiseRow(row),
          });
        }
      }

      collected.sort((a, b) => a.serverSeq - b.serverSeq);

      const page = collected.slice(0, limit);
      const hasMore = collected.length > limit;
      const nextCursor = page.length ? page[page.length - 1].serverSeq : since;

      return { changes: page, nextCursor, hasMore, resyncRequired: false };
    });
  }

  async recordPull(tenant: TenantContext, deviceId: string, cursor: number) {
    await withTenantTransaction(this.db, tenant, async (tx) => {
      await tx
        .insert(syncDeviceState)
        .values({
          deviceId,
          shopId: tenant.shopId,
          lastPulledSeq: cursor,
          lastPulledAt: new Date(),
        })
        .onConflictDoUpdate({
          target: syncDeviceState.deviceId,
          set: { lastPulledSeq: cursor, lastPulledAt: new Date() },
        });
    });
  }

  private async findAppliedMutations(tx: Transaction, mutationIds: string[]) {
    if (!mutationIds.length) return new Map<string, number | null>();

    const rows = await tx
      .select({ mutationId: syncMutations.mutationId, serverSeq: syncMutations.serverSeq })
      .from(syncMutations)
      .where(sql`${syncMutations.mutationId} = any(${sql.param(mutationIds)}::uuid[])`);

    return new Map(rows.map((row) => [row.mutationId, row.serverSeq]));
  }

  private async currentSeq(tx: Transaction, shopId: string): Promise<number> {
    const [row] = await tx.select({ seq: shops.seq }).from(shops).where(eq(shops.id, shopId));
    return row?.seq ?? 0;
  }

  private async loadShop(tx: Transaction, shopId: string) {
    const [shop] = await tx.select().from(shops).where(eq(shops.id, shopId)).limit(1);
    if (!shop) throw AppError.notFound('Shop');
    return shop;
  }

  private logRejection(mutation: SyncMutation, error: unknown) {
    this.onRejection?.(mutation, error);
  }

  /** Set by the route layer so rejections reach the request logger without the
   * service having to hold a Fastify instance. */
  onRejection?: (mutation: SyncMutation, error: unknown) => void;
}
