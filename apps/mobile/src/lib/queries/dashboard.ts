import { useQuery } from '@tanstack/react-query';
import { changePercent } from '@dwaso/domain';
import { getDatabase } from '../db';
import { queryKeys } from './keys';

export type DashboardData = {
  todayRevenueMinor: number;
  todayCostMinor: number;
  todayProfitMinor: number;
  /** Null on a trader's first day, when there is no baseline to compare against
   * and "up ∞%" would be the honest but useless answer. */
  percentVsYesterday: number | null;
  lowStockCount: number;
  lowStockPreview: string[];
  overdueTotalMinor: number;
  overdueCount: number;
};

/**
 * Day boundaries in the device's own timezone.
 *
 * The server computes these from the shop's configured timezone, which is the
 * authoritative version. The device uses its own because a trader looking at
 * "today's profit" means the day she is standing in, and a figure that rolls
 * over at a different hour than her own midnight would read as simply wrong.
 */
function dayBounds(offsetDays = 0): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function dayTotals(start: string, end: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ revenue: number | null; cost: number | null }>(
    `SELECT SUM(totalMinor) AS revenue, SUM(costTotalMinor) AS cost
     FROM sales
     WHERE deletedAt IS NULL AND occurredAt >= ? AND occurredAt < ?`,
    start,
    end,
  );

  return { revenue: Number(row?.revenue ?? 0), cost: Number(row?.cost ?? 0) };
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async (): Promise<DashboardData> => {
      const db = await getDatabase();
      const today = dayBounds(0);
      const yesterday = dayBounds(-1);

      const [todayTotals, yesterdayTotals] = await Promise.all([
        dayTotals(today.start, today.end),
        dayTotals(yesterday.start, yesterday.end),
      ]);

      const lowStock = await db.getAllAsync<{ name: string }>(
        `SELECT p.name
         FROM products p
         WHERE p.deletedAt IS NULL
           AND p.lowStockThreshold > 0
           AND COALESCE((
             SELECT SUM(m.delta) FROM stock_movements m
             WHERE m.productId = p.id AND m.deletedAt IS NULL
           ), 0) <= p.lowStockThreshold
         ORDER BY p.name COLLATE NOCASE`,
      );

      // Overdue is computed in SQL against today's date rather than by loading
      // every creditor into memory, because the home screen opens on every cold
      // start and a trader may carry hundreds of debtors.
      const overdue = await db.getFirstAsync<{ total: number | null; count: number }>(
        `SELECT SUM(balance) AS total, COUNT(*) AS count FROM (
           SELECT c.id, COALESCE((
             SELECT SUM(e.amountMinor) FROM credit_ledger_entries e
             WHERE e.creditorId = c.id AND e.deletedAt IS NULL
           ), 0) AS balance
           FROM creditors c
           WHERE c.deletedAt IS NULL
             AND c.dueDate IS NOT NULL
             AND c.dueDate < date('now')
         ) WHERE balance > 0`,
      );

      const todayProfitMinor = todayTotals.revenue - todayTotals.cost;
      const yesterdayProfitMinor = yesterdayTotals.revenue - yesterdayTotals.cost;

      return {
        todayRevenueMinor: todayTotals.revenue,
        todayCostMinor: todayTotals.cost,
        todayProfitMinor,
        percentVsYesterday: changePercent(todayProfitMinor, yesterdayProfitMinor),
        lowStockCount: lowStock.length,
        lowStockPreview: lowStock.slice(0, 3).map((row) => row.name),
        overdueTotalMinor: Number(overdue?.total ?? 0),
        overdueCount: Number(overdue?.count ?? 0),
      };
    },
  });
}

export type ActivityItem = {
  id: string;
  kind: 'sale' | 'restock' | 'payment' | 'adjustment' | 'reconciliation';
  title: string;
  amountMinor: number;
  direction: 'in' | 'out';
  occurredAt: string;
};

/**
 * The home feed, assembled from three event tables.
 *
 * Reading the events directly rather than keeping a separate activity table
 * means the feed cannot disagree with the ledger it summarises — there is only
 * one set of facts, presented differently.
 */
export function useRecentActivity(limit = 12) {
  return useQuery({
    queryKey: [...queryKeys.activity, limit],
    queryFn: async (): Promise<ActivityItem[]> => {
      const db = await getDatabase();

      return db.getAllAsync<ActivityItem>(
        `SELECT * FROM (
           SELECT
             s.id,
             'sale' AS kind,
             COALESCE((
               SELECT COALESCE(p.name, i.description)
               FROM sale_items i LEFT JOIN products p ON p.id = i.productId
               WHERE i.saleId = s.id LIMIT 1
             ), 'Sale') AS title,
             s.totalMinor AS amountMinor,
             'in' AS direction,
             s.occurredAt
           FROM sales s WHERE s.deletedAt IS NULL

           UNION ALL

           SELECT
             m.id,
             'restock' AS kind,
             COALESCE(p.name, 'Restock') AS title,
             m.delta * COALESCE(m.unitCostMinor, 0) AS amountMinor,
             'out' AS direction,
             m.occurredAt
           FROM stock_movements m
           LEFT JOIN products p ON p.id = m.productId
           WHERE m.reason = 'restock' AND m.deletedAt IS NULL

           UNION ALL

           SELECT
             e.id,
             'payment' AS kind,
             COALESCE(c.name, 'Payment') AS title,
             -e.amountMinor AS amountMinor,
             'in' AS direction,
             e.occurredAt
           FROM credit_ledger_entries e
           LEFT JOIN creditors c ON c.id = e.creditorId
           WHERE e.kind = 'payment' AND e.deletedAt IS NULL
         )
         ORDER BY occurredAt DESC
         LIMIT ?`,
        limit,
      );
    },
  });
}
