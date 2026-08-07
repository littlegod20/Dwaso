import { getTableColumns } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  CreditLedgerEntrySchema,
  CreditorSchema,
  PriceChangeSchema,
  ProductBarcodeSchema,
  ProductSchema,
  ReminderScheduleSchema,
  SaleItemSchema,
  SaleSchema,
  StockMovementSchema,
  SupplierSchema,
  UpdateShopSchema,
  type SyncEntity,
} from '@dwaso/shared-types';
import type { z } from 'zod';
import {
  creditLedgerEntries,
  creditors,
  priceChanges,
  productBarcodes,
  products,
  reminderSchedules,
  saleItems,
  sales,
  shops,
  stockMovements,
  suppliers,
} from '../../db/schema/index.js';

type EntityConfig = {
  table: PgTable;
  /** Validates an inbound payload. Anything not described here is dropped
   * rather than written, so a client cannot invent columns. */
  schema: z.ZodType;
  /** Projections and derived values are never accepted from a device. */
  readOnlyFields?: readonly string[];
};

/**
 * The single place that maps a sync entity name onto a table and a contract.
 *
 * Push and pull both read from here, so an entity can never be pullable but not
 * pushable, or validated with one schema and written with another.
 */
export const ENTITY_REGISTRY: Record<SyncEntity, EntityConfig> = {
  shop: { table: shops, schema: UpdateShopSchema },
  product: { table: products, schema: ProductSchema.partial({ createdAt: true }) },
  product_barcode: {
    table: productBarcodes,
    schema: ProductBarcodeSchema.partial({ createdAt: true }),
  },
  creditor: { table: creditors, schema: CreditorSchema.partial({ createdAt: true }) },
  supplier: { table: suppliers, schema: SupplierSchema.partial({ createdAt: true }) },
  reminder_schedule: {
    table: reminderSchedules,
    schema: ReminderScheduleSchema.partial({ createdAt: true }),
  },
  stock_movement: { table: stockMovements, schema: StockMovementSchema },
  sale: { table: sales, schema: SaleSchema },
  sale_item: { table: saleItems, schema: SaleItemSchema },
  credit_ledger_entry: { table: creditLedgerEntries, schema: CreditLedgerEntrySchema },
  price_change: { table: priceChanges, schema: PriceChangeSchema },
};

/**
 * Columns the server owns. A device that tried to push its own `serverSeq` could
 * rewrite its position in every other device's change stream, so these are
 * stripped before anything is written regardless of what arrived.
 */
const SERVER_OWNED_COLUMNS = new Set([
  'shopId',
  'serverSeq',
  'updatedAt',
  'deletedAt',
  'updatedByDeviceId',
]);

/**
 * Pulls the replication columns off a table as typed references.
 *
 * Sync is inherently generic — it treats eleven tables the same way — so it
 * needs to build predicates without knowing which table it holds. Narrowing the
 * lookup to exactly these six columns keeps that generic code honest instead of
 * casting whole tables to `any`.
 */
export type SyncColumns = {
  id: AnyPgColumn;
  shopId: AnyPgColumn;
  serverSeq: AnyPgColumn;
  updatedAt: AnyPgColumn;
  deletedAt: AnyPgColumn;
  updatedByDeviceId: AnyPgColumn;
};

/**
 * Returns the replication columns, or `null` when the table is not a normal
 * synced entity.
 *
 * The shop row is the tenant itself: it has no `shop_id`, and its `seq` column
 * is the change-stream cursor rather than a version of the shop. Shop identity
 * travels with the session, not the pull stream, so callers must skip it.
 */
export function syncColumnsOf(table: PgTable): SyncColumns | null {
  const columns = getTableColumns(table) as unknown as Record<string, AnyPgColumn>;

  if (
    !columns.id ||
    !columns.shopId ||
    !columns.serverSeq ||
    !columns.updatedAt ||
    !columns.deletedAt ||
    !columns.updatedByDeviceId
  ) {
    return null;
  }

  return {
    id: columns.id,
    shopId: columns.shopId,
    serverSeq: columns.serverSeq,
    updatedAt: columns.updatedAt,
    deletedAt: columns.deletedAt,
    updatedByDeviceId: columns.updatedByDeviceId,
  };
}

/** Converts a database row into the JSON a client receives. */
export function serialiseRow(row: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    // shopId is implicit: a device only ever syncs one shop, and echoing it
    // would invite a client to think it could change it.
    if (key === 'shopId') continue;

    // postgres.js returns `bigint` columns as JS BigInt. JSON cannot encode
    // those, and Fastify would 500 the whole pull for one money column. Minor
    // units fit in a Number for every currency we support.
    if (typeof value === 'bigint') {
      data[key] = Number(value);
    } else if (value instanceof Date) {
      data[key] = value.toISOString();
    } else {
      data[key] = value;
    }
  }

  return data;
}

/**
 * Converts an inbound payload into column values, coercing ISO strings back into
 * Dates for timestamp columns.
 *
 * Driving this from the table's own column metadata rather than a hand-written
 * mapper per entity means adding a column cannot silently produce an entity that
 * syncs in one direction only.
 */
export function deserialisePayload(
  table: PgTable,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const columns = getTableColumns(table);
  const values: Record<string, unknown> = {};

  for (const [key, column] of Object.entries(columns)) {
    if (SERVER_OWNED_COLUMNS.has(key)) continue;
    if (!(key in payload)) continue;

    const value = payload[key];

    // `dataType: 'date'` is a timestamp column; `date` columns declared with
    // mode 'string' report as strings and pass through untouched.
    if (typeof value === 'string' && column.dataType === 'date') {
      values[key] = new Date(value);
    } else {
      values[key] = value;
    }
  }

  return values;
}
