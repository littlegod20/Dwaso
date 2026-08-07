import { z } from 'zod';
import { IdSchema, SyncMetaSchema, TimestampSchema } from './common.js';

/**
 * Where a supplier record came from. The spec is explicit that Google Places is
 * a placeholder for the MVP, so provenance is stored from day one: when
 * self-listed wholesalers arrive, existing rows do not need reinterpreting.
 */
export const SupplierSourceSchema = z.enum(['manual', 'google_places', 'self_listed']);
export type SupplierSource = z.infer<typeof SupplierSourceSchema>;

export const SupplierSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(160),
  phone: z.string().nullable().default(null),
  category: z.string().max(80).nullable().default(null),
  address: z.string().max(300).nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  source: SupplierSourceSchema.default('manual'),
  externalId: z.string().max(200).nullable().default(null),
  createdAt: TimestampSchema,
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const SupplierViewSchema = SupplierSchema.extend({
  ...SyncMetaSchema.shape,
  distanceKm: z.number().nullable(),
});
export type SupplierView = z.infer<typeof SupplierViewSchema>;

export const CreateSupplierSchema = SupplierSchema.omit({ createdAt: true }).partial({
  id: true,
  phone: true,
  category: true,
  address: true,
  latitude: true,
  longitude: true,
  source: true,
  externalId: true,
});
export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;

export const NearbySupplierQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(100).max(50_000).default(5_000),
  /** Narrows the search to wholesalers plausibly carrying a specific product,
   * which is how a low-stock alert deep-links straight into sourcing. */
  productId: IdSchema.optional(),
  category: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NearbySupplierQuery = z.infer<typeof NearbySupplierQuerySchema>;

export const NearbySupplierResultSchema = z.object({
  suppliers: z.array(SupplierViewSchema),
  /**
   * Surfaced to the UI so it can repeat the spec's caveat honestly: Places does
   * not know whether a stall actually has the product in stock today.
   */
  disclaimer: z.string(),
});
export type NearbySupplierResult = z.infer<typeof NearbySupplierResultSchema>;
