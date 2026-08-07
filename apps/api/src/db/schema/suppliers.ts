import {
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { notDeleted, syncColumns, tenantColumns } from './columns.js';

/**
 * Provenance is recorded from day one because the spec is explicit that Google
 * Places is a placeholder. When self-listed wholesalers arrive, existing rows
 * stay interpretable instead of being indistinguishable from real listings.
 */
export const supplierSourceEnum = pgEnum('supplier_source', [
  'manual',
  'google_places',
  'self_listed',
]);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    phone: text('phone'),
    category: text('category'),
    address: text('address'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    source: supplierSourceEnum('source').notNull().default('manual'),
    /** Places `place_id`, used to avoid re-saving the same stall twice. */
    externalId: text('external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('suppliers_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('suppliers_shop_category_idx').on(table.shopId, table.category),
    uniqueIndex('suppliers_shop_external_key')
      .on(table.shopId, table.externalId)
      .where(notDeleted(table.deletedAt)),
  ],
);
