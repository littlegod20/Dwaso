import { and, eq, sql } from 'drizzle-orm';
import type { Transaction } from '../../db/client.js';
import {
  creditLedgerEntries,
  creditorBalances,
  dailyShopMetrics,
  productStock,
  saleItems,
  sales,
  stockMovements,
} from '../../db/schema/index.js';
import { shopDate } from '../../lib/time.js';

/**
 * Projections are caches of a fold over the event log, updated in the same
 * transaction as the event that changed them. Two properties matter:
 *
 * 1. They are always applied as a *delta* (`quantity + $1`), never as an
 *    absolute value read then written. A read-modify-write would reintroduce
 *    exactly the lost-update race the event log exists to avoid.
 * 2. They can be dropped and rebuilt from the log at any time, which is what
 *    makes them safe to treat as a cache rather than as the truth.
 */

export async function applyStockDelta(
  tx: Transaction,
  shopId: string,
  productId: string,
  delta: number,
): Promise<number> {
  const [row] = await tx
    .insert(productStock)
    .values({ shopId, productId, quantity: delta })
    .onConflictDoUpdate({
      target: [productStock.shopId, productStock.productId],
      set: { quantity: sql`${productStock.quantity} + ${delta}`, updatedAt: new Date() },
    })
    .returning({ quantity: productStock.quantity });

  return row.quantity;
}

export async function applyCreditDelta(
  tx: Transaction,
  shopId: string,
  creditorId: string,
  amountMinor: number,
  paymentAt: Date | null,
): Promise<number> {
  const [row] = await tx
    .insert(creditorBalances)
    .values({
      shopId,
      creditorId,
      balanceMinor: amountMinor,
      lastPaymentAt: paymentAt,
    })
    .onConflictDoUpdate({
      target: [creditorBalances.shopId, creditorBalances.creditorId],
      set: {
        balanceMinor: sql`${creditorBalances.balanceMinor} + ${amountMinor}`,
        ...(paymentAt ? { lastPaymentAt: paymentAt } : {}),
        updatedAt: new Date(),
      },
    })
    .returning({ balanceMinor: creditorBalances.balanceMinor });

  return row.balanceMinor;
}

export async function applyDailyMetrics(
  tx: Transaction,
  shopId: string,
  timezone: string,
  occurredAt: Date,
  revenueMinor: number,
  costMinor: number,
  salesCountDelta: number,
): Promise<void> {
  const date = shopDate(occurredAt, timezone);

  await tx
    .insert(dailyShopMetrics)
    .values({
      shopId,
      date,
      revenueMinor,
      costMinor,
      profitMinor: revenueMinor - costMinor,
      salesCount: salesCountDelta,
    })
    .onConflictDoUpdate({
      target: [dailyShopMetrics.shopId, dailyShopMetrics.date],
      set: {
        revenueMinor: sql`${dailyShopMetrics.revenueMinor} + ${revenueMinor}`,
        costMinor: sql`${dailyShopMetrics.costMinor} + ${costMinor}`,
        profitMinor: sql`${dailyShopMetrics.profitMinor} + ${revenueMinor - costMinor}`,
        salesCount: sql`${dailyShopMetrics.salesCount} + ${salesCountDelta}`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Recomputes a product's stock from its movement history.
 *
 * This is the safety net that makes the projection disposable: if a bug ever
 * skews a cached quantity, the log is still authoritative and this restores
 * agreement without anyone having to reason about what went wrong.
 */
export async function rebuildProductStock(
  tx: Transaction,
  shopId: string,
  productId: string,
): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${stockMovements.delta}), 0)::int` })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.shopId, shopId),
        eq(stockMovements.productId, productId),
        sql`${stockMovements.deletedAt} is null`,
      ),
    );

  const quantity = row?.total ?? 0;

  await tx
    .insert(productStock)
    .values({ shopId, productId, quantity })
    .onConflictDoUpdate({
      target: [productStock.shopId, productStock.productId],
      set: { quantity, updatedAt: new Date() },
    });

  return quantity;
}

export async function rebuildCreditorBalance(
  tx: Transaction,
  shopId: string,
  creditorId: string,
): Promise<number> {
  const [row] = await tx
    .select({
      total: sql<number>`coalesce(sum(${creditLedgerEntries.amountMinor}), 0)::bigint`,
      lastPayment: sql<Date | null>`max(${creditLedgerEntries.occurredAt}) filter (where ${creditLedgerEntries.kind} = 'payment')`,
    })
    .from(creditLedgerEntries)
    .where(
      and(
        eq(creditLedgerEntries.shopId, shopId),
        eq(creditLedgerEntries.creditorId, creditorId),
        sql`${creditLedgerEntries.deletedAt} is null`,
      ),
    );

  const balanceMinor = Number(row?.total ?? 0);

  await tx
    .insert(creditorBalances)
    .values({ shopId, creditorId, balanceMinor, lastPaymentAt: row?.lastPayment ?? null })
    .onConflictDoUpdate({
      target: [creditorBalances.shopId, creditorBalances.creditorId],
      set: { balanceMinor, lastPaymentAt: row?.lastPayment ?? null, updatedAt: new Date() },
    });

  return balanceMinor;
}

/** Recomputes one day's P&L from sales. Used for the current day, which is still
 * moving, and by the nightly rollup to correct any drift. */
export async function rebuildDailyMetrics(
  tx: Transaction,
  shopId: string,
  date: string,
  start: Date,
  end: Date,
): Promise<void> {
  const [row] = await tx
    .select({
      revenue: sql<number>`coalesce(sum(${saleItems.unitPriceMinor} * ${saleItems.quantity}), 0)::bigint`,
      cost: sql<number>`coalesce(sum(${saleItems.unitCostMinor} * ${saleItems.quantity}), 0)::bigint`,
      count: sql<number>`count(distinct ${sales.id})::int`,
    })
    .from(sales)
    .innerJoin(saleItems, eq(saleItems.saleId, sales.id))
    .where(
      and(
        eq(sales.shopId, shopId),
        sql`${sales.deletedAt} is null`,
        sql`${sales.occurredAt} >= ${start}`,
        sql`${sales.occurredAt} < ${end}`,
      ),
    );

  const revenueMinor = Number(row?.revenue ?? 0);
  const costMinor = Number(row?.cost ?? 0);

  await tx
    .insert(dailyShopMetrics)
    .values({
      shopId,
      date,
      revenueMinor,
      costMinor,
      profitMinor: revenueMinor - costMinor,
      salesCount: row?.count ?? 0,
    })
    .onConflictDoUpdate({
      target: [dailyShopMetrics.shopId, dailyShopMetrics.date],
      set: {
        revenueMinor,
        costMinor,
        profitMinor: revenueMinor - costMinor,
        salesCount: row?.count ?? 0,
        updatedAt: new Date(),
      },
    });
}
