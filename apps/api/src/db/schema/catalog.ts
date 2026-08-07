import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { moneyMinor, notDeleted, syncColumns, tenantColumns } from './columns.js';
import { suppliers } from './suppliers.js';

export const barcodeFormatEnum = pgEnum('barcode_format', [
  'ean13',
  'ean8',
  'upca',
  'upce',
  'code128',
  'qr',
  'other',
]);

/**
 * Note the absence of a quantity column. Stock lives in `product_stock` as a
 * projection folded from `stock_movements`; storing a mutable counter here would
 * be unmergeable the moment two devices sold the same item offline.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    category: text('category'),
    sku: text('sku'),
    unit: text('unit').notNull().default('unit'),
    costPriceMinor: moneyMinor('cost_price_minor').notNull().default(0),
    sellPriceMinor: moneyMinor('sell_price_minor').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    /** Produce and goods sold by weight skip scanning and use the quick-log path. */
    isLooseGood: boolean('is_loose_good').notNull().default(false),
    defaultSupplierId: uuid('default_supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('products_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('products_shop_name_idx').on(table.shopId, table.name),
    // Partial so a tombstoned product does not block reusing its SKU.
    uniqueIndex('products_shop_sku_key')
      .on(table.shopId, table.sku)
      .where(notDeleted(table.deletedAt)),
  ],
);

export const productBarcodes = pgTable(
  'product_barcodes',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    barcode: text('barcode').notNull(),
    format: barcodeFormatEnum('format').notNull().default('other'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('product_barcodes_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('product_barcodes_product_idx').on(table.productId),
    uniqueIndex('product_barcodes_shop_code_key')
      .on(table.shopId, table.barcode)
      .where(notDeleted(table.deletedAt)),
  ],
);

/**
 * Price changes are events, not overwrites, so the price-history sparkline and
 * the margin on past sales stay truthful after a trader adjusts a price.
 */
export const priceChanges = pgTable(
  'price_changes',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    fromCostMinor: moneyMinor('from_cost_minor'),
    toCostMinor: moneyMinor('to_cost_minor'),
    fromSellMinor: moneyMinor('from_sell_minor'),
    toSellMinor: moneyMinor('to_sell_minor'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('price_changes_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('price_changes_product_idx').on(table.shopId, table.productId, table.occurredAt),
  ],
);
