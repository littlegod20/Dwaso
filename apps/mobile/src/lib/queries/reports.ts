import { useQuery } from '@tanstack/react-query';
import { getDatabase } from '../db';
import { queryKeys } from './keys';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export type ReportSeries = {
  labels: string[];
  revenue: number[];
  cost: number[];
  totalRevenueMinor: number;
  totalCostMinor: number;
  totalProfitMinor: number;
};

const SPAN_DAYS: Record<ReportPeriod, number> = { daily: 1, weekly: 7, monthly: 30 };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Revenue and cost per day, read from the local sale log.
 *
 * The server has the same figures pre-aggregated, but reading them locally is
 * what keeps the reports tab useful with no signal — and it means a sale
 * recorded thirty seconds ago is already in the chart rather than waiting for a
 * rollup job to notice it.
 */
export function useReport(period: ReportPeriod) {
  return useQuery({
    queryKey: queryKeys.report(period),
    queryFn: async (): Promise<ReportSeries> => {
      const db = await getDatabase();
      const span = SPAN_DAYS[period];

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1));

      const rows = await db.getAllAsync<{
        day: string;
        revenue: number | null;
        cost: number | null;
      }>(
        `SELECT date(occurredAt, 'localtime') AS day,
                SUM(totalMinor) AS revenue,
                SUM(costTotalMinor) AS cost
         FROM sales
         WHERE deletedAt IS NULL AND occurredAt >= ?
         GROUP BY day
         ORDER BY day ASC`,
        start.toISOString(),
      );

      const byDay = new Map(rows.map((row) => [row.day, row]));

      const labels: string[] = [];
      const revenue: number[] = [];
      const cost: number[] = [];

      // Zero-filled so a quiet day shows as a visibly empty bar rather than
      // disappearing and making the week look shorter than it was.
      for (let offset = 0; offset < span; offset += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
        const row = byDay.get(localDateKey(date));

        labels.push(
          span > 7 ? String(date.getDate()) : WEEKDAYS[date.getDay()],
        );
        revenue.push(Number(row?.revenue ?? 0));
        cost.push(Number(row?.cost ?? 0));
      }

      const totalRevenueMinor = revenue.reduce((sum, value) => sum + value, 0);
      const totalCostMinor = cost.reduce((sum, value) => sum + value, 0);

      return {
        labels,
        revenue,
        cost,
        totalRevenueMinor,
        totalCostMinor,
        totalProfitMinor: totalRevenueMinor - totalCostMinor,
      };
    },
  });
}

export type ReconciliationRow = {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  counted: number;
  expected: number;
  occurredAt: string;
};

/**
 * Recent physical counts and what they revealed.
 *
 * `expected` is reconstructed by running the movement log forward to each count
 * with a window function, so the figure shown is what the books claimed at that
 * moment — not what they claim now. Using the current quantity here would make
 * every historical discrepancy drift as new sales come in.
 */
export function useReconciliation(limit = 20) {
  return useQuery({
    queryKey: queryKeys.reconciliation,
    queryFn: async (): Promise<ReconciliationRow[]> => {
      const db = await getDatabase();

      const rows = await db.getAllAsync<{
        id: string;
        productId: string;
        productName: string;
        delta: number;
        balanceAfter: number;
        occurredAt: string;
      }>(
        `WITH history AS (
           SELECT
             m.id,
             m.productId,
             m.delta,
             m.reason,
             m.occurredAt,
             SUM(m.delta) OVER (
               PARTITION BY m.productId
               ORDER BY m.occurredAt, m.id
               ROWS UNBOUNDED PRECEDING
             ) AS balanceAfter
           FROM stock_movements m
           WHERE m.deletedAt IS NULL
         )
         SELECT h.id, h.productId, p.name AS productName, h.delta, h.balanceAfter, h.occurredAt
         FROM history h
         JOIN products p ON p.id = h.productId
         WHERE h.reason = 'reconciliation'
         ORDER BY h.occurredAt DESC
         LIMIT ?`,
        limit,
      );

      return rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        productName: row.productName,
        delta: row.delta,
        counted: row.balanceAfter,
        expected: row.balanceAfter - row.delta,
        occurredAt: row.occurredAt,
      }));
    },
  });
}
