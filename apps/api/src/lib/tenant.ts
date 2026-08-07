import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { Database, Executor, Transaction } from '../db/client.js';
import { shops } from '../db/schema/index.js';
import { AppError } from './errors.js';

export type TenantIdentity = {
  shopId: string;
  userId: string;
  deviceId: string;
  role: 'owner' | 'staff';
};

/**
 * The only handle through which a repository can reach the database.
 *
 * Every repository function takes one of these as its first argument, so shop
 * scoping is a type-level requirement rather than something a developer has to
 * remember to add to a where clause. Forgetting it does not compile.
 */
export class TenantContext {
  readonly shopId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly role: 'owner' | 'staff';
  readonly db: Executor;

  constructor(identity: TenantIdentity, db: Executor) {
    this.shopId = identity.shopId;
    this.userId = identity.userId;
    this.deviceId = identity.deviceId;
    this.role = identity.role;
    this.db = db;
  }

  /** Rebinds this context onto an open transaction. */
  withExecutor(db: Executor): TenantContext {
    return new TenantContext(
      { shopId: this.shopId, userId: this.userId, deviceId: this.deviceId, role: this.role },
      db,
    );
  }

  requireOwner(action: string): void {
    if (this.role !== 'owner') {
      throw AppError.forbidden(`Only the shop owner can ${action}`);
    }
  }
}

/**
 * Claims the next sync sequence number for this shop.
 *
 * The `UPDATE ... RETURNING` takes a row lock, which serialises sequence
 * assignment per shop and makes the resulting stream gapless and monotonic in
 * commit order. A global `bigserial` cannot do this: concurrent transactions can
 * commit out of order, so a client that had already advanced past a lower number
 * would never be told about the row carrying it.
 *
 * Contention is irrelevant here because a shop is one owner and at most a couple
 * of staff. If that ever changes, the escape hatch is a change_log table read
 * behind a pg_snapshot_xmin watermark.
 */
export async function nextSeq(tx: Transaction, shopId: string): Promise<number> {
  const [row] = await tx
    .update(shops)
    .set({ seq: sql`${shops.seq} + 1` })
    .where(eq(shops.id, shopId))
    .returning({ seq: shops.seq });

  if (!row) throw AppError.notFound('Shop');
  return row.seq;
}

/**
 * Claims a contiguous block of sequence numbers in one round trip, for writes
 * that touch several rows (a sale plus its items plus the stock movements it
 * causes). Returns the first number of the block.
 */
export async function reserveSeqBlock(
  tx: Transaction,
  shopId: string,
  count: number,
): Promise<number> {
  if (count <= 0) throw new Error('reserveSeqBlock requires a positive count');

  const [row] = await tx
    .update(shops)
    .set({ seq: sql`${shops.seq} + ${count}` })
    .where(eq(shops.id, shopId))
    .returning({ seq: shops.seq });

  if (!row) throw AppError.notFound('Shop');
  return row.seq - count + 1;
}

/**
 * Sets the row-level-security variable for the current transaction. This is
 * defence in depth behind the repository layer: if a query ever escapes tenant
 * scoping, the database still refuses to return another shop's rows.
 */
export async function applyRlsContext(tx: Transaction, shopId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.shop_id', ${shopId}, true)`);
}

/**
 * Attribution for writes the server makes on its own behalf — reminder sweeps,
 * rollups, retention purges.
 *
 * A sentinel rather than null so that "the system did this" is a visible,
 * greppable value in the audit trail instead of an absence that reads the same
 * as missing data.
 */
export const SYSTEM_DEVICE_ID = '00000000-0000-0000-0000-000000000000';
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * A tenant context for background work.
 *
 * Workers enumerate shops and then scope each unit of work through one of these,
 * so a sweep that touches every trader still runs one tenant at a time under the
 * same RLS policies as a request. There is deliberately no cross-tenant escape
 * hatch anywhere in the codebase.
 */
export function systemTenant(shopId: string, db: Executor): TenantContext {
  return new TenantContext(
    { shopId, userId: SYSTEM_USER_ID, deviceId: SYSTEM_DEVICE_ID, role: 'owner' },
    db,
  );
}

export function requireTenant(tenant: TenantContext | undefined): TenantContext {
  if (!tenant) throw AppError.unauthorized();
  return tenant;
}

/**
 * Runs `work` inside a transaction with the tenant's RLS context applied.
 *
 * Every write path goes through this rather than calling `db.transaction`
 * directly, so the RLS variable can never be forgotten and the tenant handed to
 * repositories is always bound to the same transaction as the sequence numbers
 * they claim.
 */
export async function withTenantTransaction<T>(
  db: Database,
  tenant: TenantContext,
  work: (tx: Transaction, scoped: TenantContext) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await applyRlsContext(tx, tenant.shopId);
    return work(tx, tenant.withExecutor(tx));
  });
}

/**
 * Read-path counterpart to {@link withTenantTransaction}.
 *
 * Row-level security is forced even for the table owner, so a SELECT that never
 * sets `app.shop_id` returns nothing — not "everything", which is the whole
 * point. Every tenant read has to go through here for the same reason every
 * write does: forgetting it does not produce a loud error, it produces an
 * empty shop that looks like a brand-new account.
 */
export async function withTenantScope<T>(
  db: Database,
  tenant: TenantContext,
  work: (scoped: TenantContext) => Promise<T>,
): Promise<T> {
  return withTenantTransaction(db, tenant, async (_tx, scoped) => work(scoped));
}

export type { Database, Transaction };
