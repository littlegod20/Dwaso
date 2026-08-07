import {
  date,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantColumns } from './columns.js';
import { platformEnum } from './identity.js';
import { products } from './catalog.js';

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...tenantColumns(),
    deviceId: uuid('device_id').notNull(),
    token: text('token').notNull(),
    platform: platformEnum('platform').notNull().default('unknown'),
    /** Set when Expo reports the token as dead, so a retired handset stops
     * consuming send attempts. */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('push_tokens_token_key').on(table.token),
    index('push_tokens_shop_idx').on(table.shopId),
  ],
);

/**
 * Debounce ledger for low-stock alerts, keyed by day. A trader selling from a
 * near-empty shelf crosses the threshold on every sale, and without this she
 * would get a notification each time and turn them all off.
 */
export const lowStockAlerts = pgTable(
  'low_stock_alerts',
  {
    ...tenantColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    alertedOn: date('alerted_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.shopId, table.productId, table.alertedOn] })],
);
