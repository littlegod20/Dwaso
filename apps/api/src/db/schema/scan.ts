import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { tenantColumns } from './columns.js';
import { products } from './catalog.js';
import { EMBEDDING_DIMENSIONS } from '@dwaso/shared-types';

export const scanTierEnum = pgEnum('scan_tier', ['barcode', 'embedding', 'vision', 'manual']);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...tenantColumns(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    /** SHA-256 of the image bytes. Re-uploading an identical frame reuses the
     * stored object and, more importantly, the cached recognition result, so the
     * same frame is never billed to the vision model twice. */
    contentHash: text('content_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('product_images_shop_hash_key').on(table.shopId, table.contentHash),
    index('product_images_product_idx').on(table.shopId, table.productId),
  ],
);

/**
 * Reference embeddings for the second tier of the scan cascade. These sync down
 * to the device — 512 floats is about 2KB, so a 50-SKU shop carries roughly
 * 100KB and can match locally, offline, for free.
 *
 * Device and server share this vector space, so a product enrolled once is
 * recognisable by both without a second enrolment step.
 */
export const productEmbeddings = pgTable(
  'product_embeddings',
  {
    ...tenantColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.productId] }),
    index('product_embeddings_vector_idx').using(
      'ivfflat',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

/**
 * Cross-shop and deliberately generic: barcode, name, category and a reference
 * embedding, never anyone's prices, costs or volumes. Once one trader enrols
 * Peak Milk Tin 400g, every other trader's first scan of it resolves instantly
 * and for free, which is the one part of the moat that compounds from day one.
 */
export const barcodeCatalog = pgTable(
  'barcode_catalog',
  {
    barcode: text('barcode').primaryKey(),
    name: text('name').notNull(),
    category: text('category'),
    /** How many distinct shops have confirmed this pairing; low counts are
     * treated as suggestions rather than facts. */
    confirmations: integer('confirmations').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('barcode_catalog_name_idx').on(table.name)],
);

/**
 * Telemetry for the cascade's economics. If the share of `vision` scans is not
 * falling over time, enrolment is not working and every scan is still costing
 * money — that is the number this table exists to expose.
 */
export const scanEvents = pgTable(
  'scan_events',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    tier: scanTierEnum('tier').notNull(),
    matchedProductId: uuid('matched_product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence'),
    latencyMs: integer('latency_ms'),
    /** Vision spend in millionths of a currency unit, so per-scan costs stay
     * representable as integers. */
    costMicros: integer('cost_micros').notNull().default(0),
    barcode: text('barcode'),
    imageHash: text('image_hash'),
    /** Set when recognition was deferred because the device was offline. */
    resolvedLater: timestamp('resolved_later', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('scan_events_shop_created_idx').on(table.shopId, table.createdAt),
    index('scan_events_tier_idx').on(table.shopId, table.tier, table.createdAt),
  ],
);

/** Daily vision budget per shop, enforced so a runaway client cannot spend an
 * unbounded amount on inference. */
export const scanQuotaUsage = pgTable(
  'scan_quota_usage',
  {
    ...tenantColumns(),
    date: date('date', { mode: 'string' }).notNull(),
    visionCalls: integer('vision_calls').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.shopId, table.date] })],
);
