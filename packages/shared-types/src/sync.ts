import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

/**
 * Entities are split by how they merge, not by how they are stored.
 *
 * Event entities are append-only and immutable, so a replayed mutation is a
 * no-op and two devices can never conflict. Mutable entities are metadata a
 * trader edits, resolved last-writer-wins. Projections are server-computed and
 * are pulled but never pushed.
 */
export const EVENT_ENTITIES = [
  'stock_movement',
  'sale',
  'sale_item',
  'credit_ledger_entry',
  'price_change',
] as const;

export const MUTABLE_ENTITIES = [
  'shop',
  'product',
  'product_barcode',
  'creditor',
  'supplier',
  'reminder_schedule',
] as const;

export const SYNC_ENTITIES = [...EVENT_ENTITIES, ...MUTABLE_ENTITIES] as const;

export const SyncEntitySchema = z.enum(SYNC_ENTITIES);
export type SyncEntity = z.infer<typeof SyncEntitySchema>;

export type EventEntity = (typeof EVENT_ENTITIES)[number];
export type MutableEntity = (typeof MUTABLE_ENTITIES)[number];

export function isEventEntity(entity: SyncEntity): entity is EventEntity {
  return (EVENT_ENTITIES as readonly string[]).includes(entity);
}

export const SyncOpSchema = z.enum(['upsert', 'delete']);
export type SyncOp = z.infer<typeof SyncOpSchema>;

/**
 * `mutationId` is generated on the device and is the idempotency key. It is what
 * lets a client on a flaky connection retry the same batch as aggressively as it
 * likes without double-recording a sale.
 */
export const SyncMutationSchema = z.object({
  mutationId: IdSchema,
  entity: SyncEntitySchema,
  op: SyncOpSchema,
  entityId: IdSchema,
  payload: z.record(z.string(), z.unknown()),
  clientTimestamp: TimestampSchema,
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncPushRequestSchema = z.object({
  deviceId: IdSchema,
  mutations: z.array(SyncMutationSchema).min(1).max(500),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncMutationStatusSchema = z.enum([
  /** Written for the first time. */
  'applied',
  /** Already present under this mutationId; the retry was a no-op. */
  'duplicate',
  /** A newer write won; the client should adopt the server's row. */
  'superseded',
  /** Permanently invalid. Retrying will not help, so the client must drop it. */
  'rejected',
]);
export type SyncMutationStatus = z.infer<typeof SyncMutationStatusSchema>;

export const SyncMutationResultSchema = z.object({
  mutationId: IdSchema,
  status: SyncMutationStatusSchema,
  serverSeq: z.number().int().nonnegative().nullable().default(null),
  message: z.string().nullable().default(null),
});
export type SyncMutationResult = z.infer<typeof SyncMutationResultSchema>;

export const SyncPushResponseSchema = z.object({
  results: z.array(SyncMutationResultSchema),
  cursor: z.number().int().nonnegative(),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;

export const SyncPullQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

/**
 * Changes arrive as a flat, `serverSeq`-ordered stream rather than grouped by
 * entity, so the client can apply them in causal order — a sale item never lands
 * before the sale that owns it.
 */
export const SyncChangeSchema = z.object({
  entity: SyncEntitySchema,
  id: IdSchema,
  serverSeq: z.number().int().nonnegative(),
  deletedAt: TimestampSchema.nullable().default(null),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type SyncChange = z.infer<typeof SyncChangeSchema>;

export const SyncPullResponseSchema = z.object({
  changes: z.array(SyncChangeSchema),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  /**
   * True when the requested cursor predates the tombstone retention window. The
   * device cannot be told what it missed, so it must rebuild from scratch.
   */
  resyncRequired: z.boolean().default(false),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;
