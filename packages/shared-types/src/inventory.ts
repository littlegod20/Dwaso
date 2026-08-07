import { z } from 'zod';
import { IdSchema, MoneyMinorSchema, SyncMetaSchema, TimestampSchema } from './common.js';

/**
 * Why a movement happened, which is what turns the log into a report. A
 * `reconciliation` movement is a physical count correcting the running total,
 * and its delta is exactly the shrinkage signal the spec asks for in Phase 3 —
 * no separate bookkeeping required.
 */
export const StockMovementReasonSchema = z.enum([
  'restock',
  'sale',
  'sale_reversal',
  'adjustment',
  'reconciliation',
  'opening_balance',
]);
export type StockMovementReason = z.infer<typeof StockMovementReasonSchema>;

/**
 * Append-only and immutable. Two devices that each append a movement while
 * offline merge without conflict, because addition commutes — this is the
 * property the whole offline-first design rests on.
 */
export const StockMovementSchema = z.object({
  id: IdSchema,
  productId: IdSchema,
  /** Signed: negative for sales, positive for restocks. */
  delta: z.number().int(),
  reason: StockMovementReasonSchema,
  unitCostMinor: MoneyMinorSchema.nullable().default(null),
  supplierId: IdSchema.nullable().default(null),
  saleId: IdSchema.nullable().default(null),
  note: z.string().max(500).nullable().default(null),
  occurredAt: TimestampSchema,
});
export type StockMovement = z.infer<typeof StockMovementSchema>;

export const StockMovementViewSchema = StockMovementSchema.extend(SyncMetaSchema.shape);
export type StockMovementView = z.infer<typeof StockMovementViewSchema>;

export const RestockSchema = z.object({
  id: IdSchema.optional(),
  productId: IdSchema,
  quantity: z.number().int().positive(),
  unitCostMinor: MoneyMinorSchema.nonnegative(),
  supplierId: IdSchema.nullable().optional(),
  occurredAt: TimestampSchema.optional(),
});
export type Restock = z.infer<typeof RestockSchema>;

export const AdjustmentSchema = z.object({
  id: IdSchema.optional(),
  productId: IdSchema,
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0, 'Adjustment cannot be zero'),
  note: z.string().max(500).optional(),
  occurredAt: TimestampSchema.optional(),
});
export type Adjustment = z.infer<typeof AdjustmentSchema>;

/**
 * A physical count. The client sends what it counted, not a delta, because the
 * trader counts items on a shelf and should never be asked to do the
 * subtraction — the server derives the correction from its own expected total.
 */
export const ReconciliationCountSchema = z.object({
  id: IdSchema.optional(),
  productId: IdSchema,
  countedQuantity: z.number().int().nonnegative(),
  note: z.string().max(500).optional(),
  occurredAt: TimestampSchema.optional(),
});
export type ReconciliationCount = z.infer<typeof ReconciliationCountSchema>;

export const ReconciliationResultSchema = z.object({
  productId: IdSchema,
  productName: z.string(),
  expected: z.number().int(),
  counted: z.number().int(),
  delta: z.number().int(),
  shrinkageValueMinor: MoneyMinorSchema,
});
export type ReconciliationResult = z.infer<typeof ReconciliationResultSchema>;
