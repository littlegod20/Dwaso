import { date, index, integer, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moneyMinor, tenantColumns } from './columns.js';
import { products } from './catalog.js';
import { creditors } from './credit.js';

/**
 * Projections are caches of a fold over the event log, maintained in the same
 * transaction as the event that changed them. They exist so the inventory list
 * does not aggregate the entire movement history on every render.
 *
 * They are server-authoritative and pulled but never pushed: a client that could
 * write a stock level would be able to contradict the events that produced it.
 * Any projection can be dropped and rebuilt from the log at any time.
 */
export const productStock = pgTable(
  'product_stock',
  {
    ...tenantColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.productId] }),
    index('product_stock_shop_qty_idx').on(table.shopId, table.quantity),
  ],
);

export const creditorBalances = pgTable(
  'creditor_balances',
  {
    ...tenantColumns(),
    creditorId: uuid('creditor_id')
      .notNull()
      .references(() => creditors.id, { onDelete: 'cascade' }),
    balanceMinor: moneyMinor('balance_minor').notNull().default(0),
    lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.creditorId] }),
    index('creditor_balances_shop_balance_idx').on(table.shopId, table.balanceMinor),
  ],
);

/**
 * Pre-aggregated daily P&L. Reports read this instead of scanning sale items, so
 * a trader with two years of history opens the dashboard as fast as one on their
 * first day. The current day is recomputed on demand because it is still moving.
 */
export const dailyShopMetrics = pgTable(
  'daily_shop_metrics',
  {
    ...tenantColumns(),
    /** Bucketed in the shop's own timezone, not UTC, so "today" means the
     * trader's today rather than the server's. */
    date: date('date', { mode: 'string' }).notNull(),
    revenueMinor: moneyMinor('revenue_minor').notNull().default(0),
    costMinor: moneyMinor('cost_minor').notNull().default(0),
    profitMinor: moneyMinor('profit_minor').notNull().default(0),
    salesCount: integer('sales_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.shopId, table.date] })],
);
