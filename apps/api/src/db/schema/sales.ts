import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moneyMinor, syncColumns, tenantColumns } from './columns.js';
import { products } from './catalog.js';
import { creditors } from './credit.js';

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'credit',
  'mobile_money',
  'bank',
]);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
    creditorId: uuid('creditor_id').references(() => creditors.id, { onDelete: 'set null' }),
    totalMinor: moneyMinor('total_minor').notNull(),
    costTotalMinor: moneyMinor('cost_total_minor').notNull(),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('sales_shop_seq_idx').on(table.shopId, table.serverSeq),
    // The reporting workhorse: every P&L bucket is a range scan on this.
    index('sales_shop_occurred_idx').on(table.shopId, table.occurredAt),
    index('sales_creditor_idx').on(table.shopId, table.creditorId),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    /**
     * Null when the scanner could not identify the item. The sale still
     * completes and a background job back-fills the link once recognition
     * resolves — blocking a sale on the network would defeat the product.
     */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description'),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: moneyMinor('unit_price_minor').notNull(),
    /**
     * Copied from the product at the moment of sale rather than joined later.
     * Without this, editing a cost price would silently rewrite the margin on
     * every sale already made at the old cost.
     */
    unitCostMinor: moneyMinor('unit_cost_minor').notNull(),
    ...syncColumns(),
  },
  (table) => [
    index('sale_items_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('sale_items_sale_idx').on(table.saleId),
    index('sale_items_product_idx').on(table.shopId, table.productId),
  ],
);
