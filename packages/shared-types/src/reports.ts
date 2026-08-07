import { z } from 'zod';
import { DateOnlySchema, IdSchema, MoneyMinorSchema, TimestampSchema } from './common.js';
import { ActivityEntrySchema } from './sales.js';

export const ReportPeriodSchema = z.enum(['daily', 'weekly', 'monthly']);
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;

export const DailyMetricsSchema = z.object({
  date: DateOnlySchema,
  revenueMinor: MoneyMinorSchema,
  costMinor: MoneyMinorSchema,
  profitMinor: MoneyMinorSchema,
  salesCount: z.number().int().nonnegative(),
});
export type DailyMetrics = z.infer<typeof DailyMetricsSchema>;

export const ReportQuerySchema = z.object({
  period: ReportPeriodSchema.default('weekly'),
  /** Defaults to the period ending today in the shop's timezone. */
  endDate: DateOnlySchema.optional(),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const ReportSummarySchema = z.object({
  period: ReportPeriodSchema,
  startDate: DateOnlySchema,
  endDate: DateOnlySchema,
  buckets: z.array(DailyMetricsSchema),
  revenueMinor: MoneyMinorSchema,
  costMinor: MoneyMinorSchema,
  profitMinor: MoneyMinorSchema,
  marginPercent: z.number(),
  /** Same-length previous period, so the UI can show "+12% vs yesterday"
   * without a second request. */
  previous: z.object({
    revenueMinor: MoneyMinorSchema,
    costMinor: MoneyMinorSchema,
    profitMinor: MoneyMinorSchema,
    marginPercent: z.number(),
  }),
  revenueChangePercent: z.number().nullable(),
  profitChangePercent: z.number().nullable(),
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/**
 * The home screen in one request. Spec 2.5 requires P&L, overdue credit and low
 * stock on the same view, and three round trips over a market connection would
 * make the first screen the slowest.
 */
export const DashboardSchema = z.object({
  businessName: z.string(),
  currency: z.string(),
  today: z.object({
    revenueMinor: MoneyMinorSchema,
    costMinor: MoneyMinorSchema,
    profitMinor: MoneyMinorSchema,
    changeVsYesterdayPercent: z.number().nullable(),
  }),
  lowStock: z.object({
    count: z.number().int().nonnegative(),
    productNames: z.array(z.string()),
  }),
  overdueCredit: z.object({
    totalMinor: MoneyMinorSchema,
    creditorCount: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(ActivityEntrySchema),
});
export type Dashboard = z.infer<typeof DashboardSchema>;

export const ShrinkageReportEntrySchema = z.object({
  productId: IdSchema,
  productName: z.string(),
  countedAt: TimestampSchema,
  expected: z.number().int(),
  counted: z.number().int(),
  delta: z.number().int(),
  valueMinor: MoneyMinorSchema,
});
export type ShrinkageReportEntry = z.infer<typeof ShrinkageReportEntrySchema>;
