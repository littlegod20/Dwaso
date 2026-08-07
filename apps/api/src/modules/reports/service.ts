import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { Dashboard, ReportQuery, ReportSummary, ActivityEntry } from '@dwaso/shared-types';
import { changePercent, marginPercent } from '@dwaso/domain';
import type { Database } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import {
  addDays,
  dateRange,
  dayBoundsUtc,
  periodLengthDays,
  periodStart,
  todayInShop,
} from '../../lib/time.js';
import {
  creditLedgerEntries,
  creditorBalances,
  creditors,
  dailyShopMetrics,
  products,
  sales,
  shops,
  stockMovements,
} from '../../db/schema/index.js';
import { rebuildDailyMetrics } from '../projections/service.js';
import { withTenantTransaction, type TenantContext } from '../../lib/tenant.js';
import * as catalogRepo from '../catalog/repo.js';

export class ReportsService {
  constructor(private readonly db: Database) {}

  /**
   * Reads pre-aggregated daily rows rather than scanning sale items, so a trader
   * with two years of history opens this as fast as one on her first day.
   *
   * The current day is the exception: it is still moving, so it is recomputed on
   * demand before the range is read.
   */
  async summary(tenant: TenantContext, query: ReportQuery): Promise<ReportSummary> {
    const shop = await this.loadShop(tenant);
    const today = todayInShop(shop.timezone);
    const endDate = query.endDate ?? today;

    if (endDate >= today) {
      await this.refreshDay(tenant, shop.timezone, today);
    }

    const startDate = periodStart(endDate, query.period);
    const span = periodLengthDays(query.period);

    const previousEnd = addDays(startDate, -1);
    const previousStart = periodStart(previousEnd, query.period);

    const [current, previous] = await Promise.all([
      this.readRange(tenant, startDate, endDate),
      this.readRange(tenant, previousStart, previousEnd),
    ]);

    // Zero-fill so a chart of the last seven days always has seven bars, with
    // quiet days visibly quiet rather than missing.
    const byDate = new Map(current.map((row) => [row.date, row]));
    const buckets = dateRange(startDate, endDate).map((date) => {
      const row = byDate.get(date);
      return {
        date,
        revenueMinor: row?.revenueMinor ?? 0,
        costMinor: row?.costMinor ?? 0,
        profitMinor: row?.profitMinor ?? 0,
        salesCount: row?.salesCount ?? 0,
      };
    });

    const totals = sum(buckets);
    const previousTotals = sum(previous);

    return {
      period: query.period,
      startDate,
      endDate,
      buckets: buckets.slice(-span),
      revenueMinor: totals.revenueMinor,
      costMinor: totals.costMinor,
      profitMinor: totals.profitMinor,
      marginPercent: marginPercent(totals.revenueMinor, totals.costMinor),
      previous: {
        revenueMinor: previousTotals.revenueMinor,
        costMinor: previousTotals.costMinor,
        profitMinor: previousTotals.profitMinor,
        marginPercent: marginPercent(previousTotals.revenueMinor, previousTotals.costMinor),
      },
      revenueChangePercent: changePercent(totals.revenueMinor, previousTotals.revenueMinor),
      profitChangePercent: changePercent(totals.profitMinor, previousTotals.profitMinor),
    };
  }

  /**
   * The home screen in one request. Spec 2.5 puts P&L, low stock and overdue
   * credit on the same view, and three separate round trips over a market
   * connection would make the first screen the slowest one in the app.
   */
  async dashboard(tenant: TenantContext): Promise<Dashboard> {
    const shop = await this.loadShop(tenant);
    const today = todayInShop(shop.timezone);
    const yesterday = addDays(today, -1);

    await this.refreshDay(tenant, shop.timezone, today);

    const [metrics, lowStockNames, overdue, activity] = await Promise.all([
      this.readRange(tenant, yesterday, today),
      catalogRepo.countLowStock(tenant),
      this.overdueCredit(tenant, today),
      this.recentActivity(tenant),
    ]);

    const todayMetrics = metrics.find((row) => row.date === today);
    const yesterdayMetrics = metrics.find((row) => row.date === yesterday);

    return {
      businessName: shop.name,
      currency: shop.currency,
      today: {
        revenueMinor: todayMetrics?.revenueMinor ?? 0,
        costMinor: todayMetrics?.costMinor ?? 0,
        profitMinor: todayMetrics?.profitMinor ?? 0,
        changeVsYesterdayPercent: changePercent(
          todayMetrics?.profitMinor ?? 0,
          yesterdayMetrics?.profitMinor ?? 0,
        ),
      },
      lowStock: {
        count: lowStockNames.length,
        // Enough to name the situation in the alert card without shipping the
        // whole catalog to render a summary line.
        productNames: lowStockNames.slice(0, 5),
      },
      overdueCredit: overdue,
      recentActivity: activity,
    };
  }

  private async refreshDay(tenant: TenantContext, timezone: string, date: string) {
    const { start, end } = dayBoundsUtc(date, timezone);
    await withTenantTransaction(this.db, tenant, async (tx) => {
      await rebuildDailyMetrics(tx, tenant.shopId, date, start, end);
    });
  }

  private async readRange(tenant: TenantContext, startDate: string, endDate: string) {
    return tenant.db
      .select({
        date: dailyShopMetrics.date,
        revenueMinor: dailyShopMetrics.revenueMinor,
        costMinor: dailyShopMetrics.costMinor,
        profitMinor: dailyShopMetrics.profitMinor,
        salesCount: dailyShopMetrics.salesCount,
      })
      .from(dailyShopMetrics)
      .where(
        and(
          eq(dailyShopMetrics.shopId, tenant.shopId),
          gte(dailyShopMetrics.date, startDate),
          lte(dailyShopMetrics.date, endDate),
        ),
      )
      .orderBy(dailyShopMetrics.date);
  }

  private async overdueCredit(tenant: TenantContext, today: string) {
    const [row] = await tenant.db
      .select({
        totalMinor: sql<string>`coalesce(sum(${creditorBalances.balanceMinor}), 0)`,
        creditorCount: sql<number>`count(*)::int`,
      })
      .from(creditorBalances)
      .innerJoin(creditors, eq(creditors.id, creditorBalances.creditorId))
      .where(
        and(
          eq(creditorBalances.shopId, tenant.shopId),
          isNull(creditors.deletedAt),
          sql`${creditorBalances.balanceMinor} > 0`,
          sql`${creditors.dueDate} is not null and ${creditors.dueDate} < ${today}`,
        ),
      );

    return {
      totalMinor: Number(row?.totalMinor ?? 0),
      creditorCount: row?.creditorCount ?? 0,
    };
  }

  /**
   * The activity feed is a union over the event log rather than a separate
   * table. Because every action already appends an event, there is nothing extra
   * to write and nothing that can drift out of step with the books.
   */
  private async recentActivity(tenant: TenantContext, limit = 12): Promise<ActivityEntry[]> {
    const [saleRows, movementRows, paymentRows] = await Promise.all([
      tenant.db
        .select({
          id: sales.id,
          totalMinor: sales.totalMinor,
          paymentMethod: sales.paymentMethod,
          occurredAt: sales.occurredAt,
        })
        .from(sales)
        .where(and(eq(sales.shopId, tenant.shopId), isNull(sales.deletedAt)))
        .orderBy(desc(sales.occurredAt))
        .limit(limit),

      tenant.db
        .select({
          id: stockMovements.id,
          delta: stockMovements.delta,
          reason: stockMovements.reason,
          unitCostMinor: stockMovements.unitCostMinor,
          productName: products.name,
          occurredAt: stockMovements.occurredAt,
        })
        .from(stockMovements)
        .innerJoin(products, eq(products.id, stockMovements.productId))
        .where(
          and(
            eq(stockMovements.shopId, tenant.shopId),
            isNull(stockMovements.deletedAt),
            sql`${stockMovements.reason} in ('restock', 'adjustment', 'reconciliation')`,
          ),
        )
        .orderBy(desc(stockMovements.occurredAt))
        .limit(limit),

      tenant.db
        .select({
          id: creditLedgerEntries.id,
          amountMinor: creditLedgerEntries.amountMinor,
          creditorName: creditors.name,
          occurredAt: creditLedgerEntries.occurredAt,
        })
        .from(creditLedgerEntries)
        .innerJoin(creditors, eq(creditors.id, creditLedgerEntries.creditorId))
        .where(
          and(
            eq(creditLedgerEntries.shopId, tenant.shopId),
            eq(creditLedgerEntries.kind, 'payment'),
            isNull(creditLedgerEntries.deletedAt),
          ),
        )
        .orderBy(desc(creditLedgerEntries.occurredAt))
        .limit(limit),
    ]);

    const entries: ActivityEntry[] = [
      ...saleRows.map((row) => ({
        id: row.id,
        kind: 'sale' as const,
        title: row.paymentMethod === 'credit' ? 'Credit sale' : 'Sale',
        amountMinor: row.totalMinor,
        direction: 'in' as const,
        occurredAt: row.occurredAt.toISOString(),
      })),
      ...movementRows.map((row) => ({
        id: row.id,
        kind: (row.reason === 'restock' ? 'restock' : row.reason) as ActivityEntry['kind'],
        title: `${row.productName} ${row.delta > 0 ? '+' : ''}${row.delta}`,
        amountMinor: Math.abs(row.delta) * (row.unitCostMinor ?? 0),
        direction: 'out' as const,
        occurredAt: row.occurredAt.toISOString(),
      })),
      ...paymentRows.map((row) => ({
        id: row.id,
        kind: 'payment' as const,
        title: `${row.creditorName} paid`,
        amountMinor: Math.abs(row.amountMinor),
        direction: 'in' as const,
        occurredAt: row.occurredAt.toISOString(),
      })),
    ];

    return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
  }

  private async loadShop(tenant: TenantContext) {
    const [shop] = await tenant.db.select().from(shops).where(eq(shops.id, tenant.shopId)).limit(1);

    if (!shop) throw AppError.notFound('Shop');
    return shop;
  }
}

function sum(rows: { revenueMinor: number; costMinor: number; profitMinor: number }[]) {
  return rows.reduce(
    (acc, row) => ({
      revenueMinor: acc.revenueMinor + row.revenueMinor,
      costMinor: acc.costMinor + row.costMinor,
      profitMinor: acc.profitMinor + row.profitMinor,
    }),
    { revenueMinor: 0, costMinor: 0, profitMinor: 0 },
  );
}
