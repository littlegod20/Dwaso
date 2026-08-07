import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moneyMinor, syncColumns, tenantColumns } from './columns.js';
import { products } from './catalog.js';
import { suppliers } from './suppliers.js';
import { sales } from './sales.js';

export const stockMovementReasonEnum = pgEnum('stock_movement_reason', [
  'restock',
  'sale',
  'sale_reversal',
  'adjustment',
  'reconciliation',
  'opening_balance',
]);

/**
 * The append-only spine of the whole system. Every stock figure the trader sees
 * is a sum over this table, which is what makes offline merges trivial: two
 * devices appending movements while disconnected converge to the same total
 * regardless of arrival order, because addition commutes.
 *
 * Rows are never updated. A mistake is corrected by appending a compensating
 * movement, which also keeps the correction itself auditable.
 */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Negative for sales, positive for restocks. */
    delta: integer('delta').notNull(),
    reason: stockMovementReasonEnum('reason').notNull(),
    unitCostMinor: moneyMinor('unit_cost_minor'),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    saleId: uuid('sale_id').references(() => sales.id, { onDelete: 'set null' }),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('stock_movements_shop_seq_idx').on(table.shopId, table.serverSeq),
    // Drives both the stock fold and the restock log on the product screen.
    index('stock_movements_product_idx').on(table.shopId, table.productId, table.occurredAt),
    index('stock_movements_shop_occurred_idx').on(table.shopId, table.occurredAt),
  ],
);
