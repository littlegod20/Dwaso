import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

/**
 * Which tier of the cascade resolved a scan. Recorded on every scan so the
 * economics stay visible: if tier 3 is not falling as a share of scans over
 * time, enrolment is not working and every scan is still costing money.
 */
export const ScanTierSchema = z.enum([
  /** On-device barcode. Free, offline, exact. */
  'barcode',
  /** On-device embedding match against this shop's enrolled products. Free, offline. */
  'embedding',
  /** Server vision model. Costs money, needs network, and enrols the product so
   * the next sighting resolves in a cheaper tier. */
  'vision',
  /** Nothing matched; the trader picked manually or logged an unidentified item. */
  'manual',
]);
export type ScanTier = z.infer<typeof ScanTierSchema>;

export const ScanMatchRequestSchema = z.object({
  /** Client-generated so the scan can be recorded offline and reconciled later. */
  scanEventId: IdSchema.optional(),
  /** Base64 JPEG, already downscaled on the device to keep upload and inference cheap. */
  imageBase64: z.string().min(1),
  /** Detected on-device but unmatched locally; lets the server enrol the pairing. */
  barcode: z.string().max(32).nullable().optional(),
  capturedAt: TimestampSchema.optional(),
});
export type ScanMatchRequest = z.infer<typeof ScanMatchRequestSchema>;

export const ScanCandidateSchema = z.object({
  productId: IdSchema,
  name: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ScanCandidate = z.infer<typeof ScanCandidateSchema>;

/**
 * What the vision model is allowed to return. Validated with this schema before
 * anything is written, so a hallucinated product id can never enter the catalog.
 */
export const VisionResultSchema = z.object({
  matchedProductId: IdSchema.nullable(),
  confidence: z.number().min(0).max(1),
  extractedName: z.string().max(160).nullable(),
  category: z.string().max(80).nullable(),
  size: z.string().max(40).nullable(),
  visibleBarcode: z.string().max(32).nullable(),
});
export type VisionResult = z.infer<typeof VisionResultSchema>;

export const ScanMatchResponseSchema = z.object({
  scanEventId: IdSchema,
  tier: ScanTierSchema,
  matchedProductId: IdSchema.nullable(),
  confidence: z.number().min(0).max(1),
  candidates: z.array(ScanCandidateSchema),
  /** Populated when the item is new, to pre-fill the "add product" form. */
  suggestion: z
    .object({
      name: z.string().nullable(),
      category: z.string().nullable(),
      barcode: z.string().nullable(),
    })
    .nullable(),
  /** True when the shop's daily vision budget is spent; the client falls back to
   * manual selection rather than showing an error. */
  quotaExceeded: z.boolean().default(false),
});
export type ScanMatchResponse = z.infer<typeof ScanMatchResponseSchema>;

/** Cached on the device so tier 1 resolves without a round trip. */
export const BarcodeCatalogEntrySchema = z.object({
  barcode: z.string(),
  name: z.string(),
  category: z.string().nullable(),
});
export type BarcodeCatalogEntry = z.infer<typeof BarcodeCatalogEntrySchema>;

export const ProductEmbeddingSchema = z.object({
  productId: IdSchema,
  vector: z.array(z.number()),
  updatedAt: TimestampSchema,
});
export type ProductEmbedding = z.infer<typeof ProductEmbeddingSchema>;

export const EMBEDDING_DIMENSIONS = 512;

/** Below this, a local match is not trusted and the cascade falls through. */
export const EMBEDDING_MATCH_THRESHOLD = 0.82;
