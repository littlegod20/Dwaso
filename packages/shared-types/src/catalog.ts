import { z } from 'zod';
import {
  IdSchema,
  MoneyMinorSchema,
  PositiveMoneyMinorSchema,
  SyncMetaSchema,
  TimestampSchema,
} from './common.js';

/**
 * The writable product record. Note what is absent: quantity. Stock is a fold
 * over `stock_movements`, never a stored counter, because two offline devices
 * cannot merge conflicting values of a mutable number.
 */
export const ProductSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(160),
  category: z.string().max(80).nullable().default(null),
  sku: z.string().max(64).nullable().default(null),
  unit: z.string().max(24).default('unit'),
  costPriceMinor: PositiveMoneyMinorSchema,
  sellPriceMinor: PositiveMoneyMinorSchema,
  lowStockThreshold: z.number().int().nonnegative().default(5),
  /** Loose goods (produce, fabric by the yard) skip scanning and use quick-log. */
  isLooseGood: z.boolean().default(false),
  defaultSupplierId: IdSchema.nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  createdAt: TimestampSchema,
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductStatusSchema = z.enum(['in-stock', 'low', 'out-of-stock']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

/** Product plus the server-computed projections. Clients read these; the sync
 * protocol rejects any attempt to write them. */
export const ProductViewSchema = ProductSchema.extend({
  ...SyncMetaSchema.shape,
  quantity: z.number().int(),
  status: ProductStatusSchema,
  marginMinor: MoneyMinorSchema,
  marginPercent: z.number(),
});
export type ProductView = z.infer<typeof ProductViewSchema>;

export const CreateProductSchema = ProductSchema.omit({ createdAt: true }).partial({
  id: true,
  category: true,
  sku: true,
  unit: true,
  lowStockThreshold: true,
  isLooseGood: true,
  defaultSupplierId: true,
  imageUrl: true,
});
export type CreateProduct = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.omit({ id: true }).partial();
export type UpdateProduct = z.infer<typeof UpdateProductSchema>;

/**
 * Price changes are recorded as events rather than by overwriting the product,
 * so the price-history sparkline and historical margin stay truthful.
 */
export const PriceChangeSchema = z.object({
  id: IdSchema,
  productId: IdSchema,
  fromCostMinor: MoneyMinorSchema.nullable(),
  toCostMinor: MoneyMinorSchema.nullable(),
  fromSellMinor: MoneyMinorSchema.nullable(),
  toSellMinor: MoneyMinorSchema.nullable(),
  occurredAt: TimestampSchema,
});
export type PriceChange = z.infer<typeof PriceChangeSchema>;

export const UpdatePriceSchema = z
  .object({
    costPriceMinor: PositiveMoneyMinorSchema.optional(),
    sellPriceMinor: PositiveMoneyMinorSchema.optional(),
  })
  .refine((value) => value.costPriceMinor !== undefined || value.sellPriceMinor !== undefined, {
    message: 'At least one of costPriceMinor or sellPriceMinor must be provided',
  });
export type UpdatePrice = z.infer<typeof UpdatePriceSchema>;

/**
 * Barcodes are the free, offline, exact tier of the scan cascade. A product can
 * carry several: multipacks and regional variants of the same item scan
 * differently but are one line of stock to the trader.
 */
export const ProductBarcodeSchema = z.object({
  id: IdSchema,
  productId: IdSchema,
  barcode: z.string().min(6).max(32),
  format: z.enum(['ean13', 'ean8', 'upca', 'upce', 'code128', 'qr', 'other']).default('other'),
  createdAt: TimestampSchema,
});
export type ProductBarcode = z.infer<typeof ProductBarcodeSchema>;
