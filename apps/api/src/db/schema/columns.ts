import { sql } from 'drizzle-orm';
import { bigint, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { shops } from './shops.js';

/**
 * These are functions rather than shared objects because a Drizzle column
 * builder carries per-table state; reusing one instance across tables silently
 * corrupts the schema.
 */

export const tenantColumns = () => ({
  shopId: uuid('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
});

/**
 * Attached to every replicated table. `deletedAt` is a tombstone rather than a
 * real delete: an offline device has to learn that a row disappeared, and a row
 * that is simply gone is indistinguishable from one it never received.
 */
export const syncColumns = () => ({
  serverSeq: bigint('server_seq', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  updatedByDeviceId: uuid('updated_by_device_id'),
});

/** Money is always an integer count of minor units. Never numeric, never float. */
export const moneyMinor = (name: string) => bigint(name, { mode: 'number' });

/**
 * Predicate for partial unique indexes. Uniqueness has to ignore tombstones, or
 * deleting a product would permanently reserve its SKU.
 */
export function notDeleted(column: AnyPgColumn) {
  return sql`${column} is null`;
}
