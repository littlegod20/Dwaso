import { z } from 'zod';
import {
  IdSchema,
  MoneyMinorSchema,
  PositiveMoneyMinorSchema,
  SyncMetaSchema,
  TimestampSchema,
} from './common.js';

export const PaymentMethodSchema = z.enum(['cash', 'credit', 'mobile_money', 'bank']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * Cost is copied onto the line at the moment of sale rather than joined from the
 * product later. Without this, editing a product's cost price would silently
 * rewrite the margin on every sale already made at the old cost.
 */
export const SaleItemSchema = z.object({
  id: IdSchema,
  saleId: IdSchema,
  /**
   * Null when the trader logged a sale the scanner could not identify. The sale
   * still completes; a background job back-fills the link once recognition
   * resolves, because blocking a sale on the network defeats the product.
   */
  productId: IdSchema.nullable().default(null),
  description: z.string().max(160).nullable().default(null),
  quantity: z.number().int().positive(),
  unitPriceMinor: PositiveMoneyMinorSchema,
  unitCostMinor: PositiveMoneyMinorSchema,
});
export type SaleItem = z.infer<typeof SaleItemSchema>;

export const SaleSchema = z.object({
  id: IdSchema,
  paymentMethod: PaymentMethodSchema,
  /** Required when paymentMethod is `credit`: someone has to owe the money. */
  creditorId: IdSchema.nullable().default(null),
  totalMinor: PositiveMoneyMinorSchema,
  costTotalMinor: PositiveMoneyMinorSchema,
  note: z.string().max(500).nullable().default(null),
  occurredAt: TimestampSchema,
});
export type Sale = z.infer<typeof SaleSchema>;

export const SaleViewSchema = SaleSchema.extend({
  ...SyncMetaSchema.shape,
  items: z.array(SaleItemSchema),
  marginMinor: MoneyMinorSchema,
});
export type SaleView = z.infer<typeof SaleViewSchema>;

export const RecordSaleItemSchema = z.object({
  id: IdSchema.optional(),
  productId: IdSchema.nullable().optional(),
  description: z.string().max(160).optional(),
  quantity: z.number().int().positive(),
  /** Defaults to the product's current sell price when omitted, so the fast path
   * (scan, confirm, done) needs no price entry at all. */
  unitPriceMinor: PositiveMoneyMinorSchema.optional(),
});
export type RecordSaleItem = z.infer<typeof RecordSaleItemSchema>;

export const RecordSaleSchema = z
  .object({
    id: IdSchema.optional(),
    paymentMethod: PaymentMethodSchema.default('cash'),
    creditorId: IdSchema.nullable().optional(),
    items: z.array(RecordSaleItemSchema).min(1),
    note: z.string().max(500).optional(),
    occurredAt: TimestampSchema.optional(),
    scanEventId: IdSchema.nullable().optional(),
  })
  .refine((sale) => sale.paymentMethod !== 'credit' || Boolean(sale.creditorId), {
    message: 'A credit sale must name the creditor who owes the balance',
    path: ['creditorId'],
  })
  .refine(
    (sale) => sale.items.every((item) => item.productId || item.description || item.unitPriceMinor),
    {
      message: 'Each line needs a product, a description, or a price',
      path: ['items'],
    },
  );
export type RecordSale = z.infer<typeof RecordSaleSchema>;

/**
 * The one-tap path for loose goods. The trader taps "sold 3" on a product and
 * nothing else — spec 2.1's requirement that logging disappear into an action
 * the trader already wants to take.
 */
export const QuickSaleSchema = z.object({
  id: IdSchema.optional(),
  productId: IdSchema,
  quantity: z.number().int().positive().default(1),
  occurredAt: TimestampSchema.optional(),
});
export type QuickSale = z.infer<typeof QuickSaleSchema>;

export const ActivityEntrySchema = z.object({
  id: IdSchema,
  kind: z.enum(['sale', 'restock', 'payment', 'adjustment', 'reconciliation']),
  title: z.string(),
  amountMinor: MoneyMinorSchema,
  direction: z.enum(['in', 'out']),
  occurredAt: TimestampSchema,
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;
