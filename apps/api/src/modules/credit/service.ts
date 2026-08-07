import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type {
  CreateCreditor,
  CreditorView,
  ImportContacts,
  RecordPayment,
  UpdateCreditor,
} from '@dwaso/shared-types';
import { creditorTiming } from '@dwaso/domain';
import type { Database } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { normalisePhone, type CountryCode } from '../../lib/phone.js';
import {
  nextSeq,
  reserveSeqBlock,
  withTenantTransaction,
  type TenantContext,
} from '../../lib/tenant.js';
import { creditLedgerEntries, creditorBalances, creditors, shops } from '../../db/schema/index.js';
import { applyCreditDelta } from '../projections/service.js';

type CreditorRow = typeof creditors.$inferSelect;

function toView(row: CreditorRow, balanceMinor: number, lastPaymentAt: Date | null): CreditorView {
  const timing = creditorTiming(balanceMinor, row.dueDate);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    dueDate: row.dueDate,
    note: row.note,
    remindersOptedOut: row.remindersOptedOut,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    serverSeq: row.serverSeq,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    updatedByDeviceId: row.updatedByDeviceId,
    balanceMinor,
    status: timing.status,
    daysOverdue: timing.daysOverdue,
    daysUntilDue: timing.daysUntilDue,
    lastPaymentAt: lastPaymentAt?.toISOString() ?? null,
  };
}

export class CreditService {
  constructor(private readonly db: Database) {}

  async list(tenant: TenantContext, status?: 'all' | 'overdue' | 'upcoming' | 'clear') {
    const rows = await tenant.db
      .select({
        creditor: creditors,
        balanceMinor: sql<number>`coalesce(${creditorBalances.balanceMinor}, 0)::bigint`,
        lastPaymentAt: creditorBalances.lastPaymentAt,
      })
      .from(creditors)
      .leftJoin(
        creditorBalances,
        and(
          eq(creditorBalances.creditorId, creditors.id),
          eq(creditorBalances.shopId, tenant.shopId),
        ),
      )
      .where(and(eq(creditors.shopId, tenant.shopId), isNull(creditors.deletedAt)))
      .orderBy(creditors.name);

    const views = rows.map((row) =>
      toView(row.creditor, Number(row.balanceMinor), row.lastPaymentAt),
    );

    if (!status || status === 'all') return views;
    return views.filter((view) => view.status === status);
  }

  async get(tenant: TenantContext, creditorId: string): Promise<CreditorView> {
    const [row] = await tenant.db
      .select({
        creditor: creditors,
        balanceMinor: sql<number>`coalesce(${creditorBalances.balanceMinor}, 0)::bigint`,
        lastPaymentAt: creditorBalances.lastPaymentAt,
      })
      .from(creditors)
      .leftJoin(
        creditorBalances,
        and(
          eq(creditorBalances.creditorId, creditors.id),
          eq(creditorBalances.shopId, tenant.shopId),
        ),
      )
      .where(
        and(
          eq(creditors.shopId, tenant.shopId),
          eq(creditors.id, creditorId),
          isNull(creditors.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw AppError.notFound('Creditor');
    return toView(row.creditor, Number(row.balanceMinor), row.lastPaymentAt);
  }

  async create(tenant: TenantContext, input: CreateCreditor): Promise<CreditorView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const shop = await this.loadShop(scoped, tenant.shopId);
      const opening = input.openingBalanceMinor ?? 0;

      const seqCount = opening > 0 ? 2 : 1;
      const firstSeq = await reserveSeqBlock(tx, tenant.shopId, seqCount);

      const creditorId = input.id ?? newId();

      await tx.insert(creditors).values({
        id: creditorId,
        shopId: tenant.shopId,
        name: input.name,
        phone: input.phone ? normalisePhone(input.phone, shop.countryCode as CountryCode) : null,
        email: input.email ?? null,
        dueDate: input.dueDate ?? null,
        note: input.note ?? null,
        remindersOptedOut: input.remindersOptedOut ?? false,
        source: input.source ?? 'manual',
        serverSeq: firstSeq,
        updatedByDeviceId: tenant.deviceId,
      });

      // An opening balance is a ledger entry, not a stored number, so it folds
      // into the balance the same way every later entry does.
      if (opening > 0) {
        await tx.insert(creditLedgerEntries).values({
          id: newId(),
          shopId: tenant.shopId,
          creditorId,
          kind: 'adjustment',
          amountMinor: opening,
          note: 'Opening balance',
          occurredAt: new Date(),
          serverSeq: firstSeq + 1,
          updatedByDeviceId: tenant.deviceId,
        });

        await applyCreditDelta(tx, tenant.shopId, creditorId, opening, null);
      }

      return this.get(scoped, creditorId);
    });
  }

  async update(
    tenant: TenantContext,
    creditorId: string,
    input: UpdateCreditor,
  ): Promise<CreditorView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const shop = await this.loadShop(scoped, tenant.shopId);
      const seq = await nextSeq(tx, tenant.shopId);

      const [updated] = await tx
        .update(creditors)
        .set({
          ...input,
          ...(input.phone
            ? { phone: normalisePhone(input.phone, shop.countryCode as CountryCode) }
            : {}),
          serverSeq: seq,
          updatedAt: new Date(),
          updatedByDeviceId: tenant.deviceId,
        })
        .where(
          and(
            eq(creditors.shopId, tenant.shopId),
            eq(creditors.id, creditorId),
            isNull(creditors.deletedAt),
          ),
        )
        .returning();

      if (!updated) throw AppError.notFound('Creditor');
      return this.get(scoped, creditorId);
    });
  }

  /**
   * Payments are negative ledger entries. Nothing subtracts from a stored
   * balance, so a payment recorded on two devices while offline cannot produce
   * a balance that depends on which one synced first.
   */
  async recordPayment(
    tenant: TenantContext,
    creditorId: string,
    input: RecordPayment,
  ): Promise<CreditorView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      await this.get(scoped, creditorId);

      const seq = await nextSeq(tx, tenant.shopId);
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

      await tx.insert(creditLedgerEntries).values({
        id: input.id ?? newId(),
        shopId: tenant.shopId,
        creditorId,
        kind: 'payment',
        amountMinor: -input.amountMinor,
        note: input.note ?? null,
        occurredAt,
        serverSeq: seq,
        updatedByDeviceId: tenant.deviceId,
      });

      await applyCreditDelta(tx, tenant.shopId, creditorId, -input.amountMinor, occurredAt);

      return this.get(scoped, creditorId);
    });
  }

  async history(tenant: TenantContext, creditorId: string, limit = 100) {
    return tenant.db
      .select()
      .from(creditLedgerEntries)
      .where(
        and(
          eq(creditLedgerEntries.shopId, tenant.shopId),
          eq(creditLedgerEntries.creditorId, creditorId),
          isNull(creditLedgerEntries.deletedAt),
        ),
      )
      .orderBy(desc(creditLedgerEntries.occurredAt))
      .limit(limit);
  }

  async remove(tenant: TenantContext, creditorId: string): Promise<void> {
    await withTenantTransaction(this.db, tenant, async (tx) => {
      const seq = await nextSeq(tx, tenant.shopId);

      const [removed] = await tx
        .update(creditors)
        .set({
          deletedAt: new Date(),
          serverSeq: seq,
          updatedAt: new Date(),
          updatedByDeviceId: tenant.deviceId,
        })
        .where(
          and(
            eq(creditors.shopId, tenant.shopId),
            eq(creditors.id, creditorId),
            isNull(creditors.deletedAt),
          ),
        )
        .returning();

      if (!removed) throw AppError.notFound('Creditor');
    });
  }

  /**
   * Imports only the contacts the trader explicitly selected.
   *
   * There is deliberately no endpoint that accepts a whole address book: these
   * are third parties who never consented, and under Act 843 the smallest
   * defensible import is the one the trader picked by hand.
   */
  async importContacts(tenant: TenantContext, input: ImportContacts): Promise<CreditorView[]> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const shop = await this.loadShop(scoped, tenant.shopId);
      const firstSeq = await reserveSeqBlock(tx, tenant.shopId, input.contacts.length);

      const ids: string[] = [];

      for (const [index, contact] of input.contacts.entries()) {
        const id = contact.id ?? newId();
        ids.push(id);

        await tx.insert(creditors).values({
          id,
          shopId: tenant.shopId,
          name: contact.name,
          phone: normalisePhone(contact.phone, shop.countryCode as CountryCode),
          source: 'contact_import',
          serverSeq: firstSeq + index,
          updatedByDeviceId: tenant.deviceId,
        });
      }

      return Promise.all(ids.map((id) => this.get(scoped, id)));
    });
  }

  private async loadShop(tenant: TenantContext, shopId: string) {
    const [shop] = await tenant.db.select().from(shops).where(eq(shops.id, shopId)).limit(1);
    if (!shop) throw AppError.notFound('Shop');
    return shop;
  }
}
