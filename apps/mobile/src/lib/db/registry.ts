import type { SyncEntity } from '@dwaso/shared-types';

/**
 * SQLite has no boolean and no JSON type, so every value crossing between the
 * API's JSON and the local database needs a declared shape. Spelling the columns
 * out here rather than writing whatever arrives also means a compromised or
 * simply newer server cannot inject unexpected column names into the SQL this
 * module builds.
 */
export type ColumnType = 'text' | 'int' | 'real' | 'bool' | 'json';

export type EntityTable = {
  table: string;
  columns: Record<string, ColumnType>;
};

const SYNC_COLUMNS: Record<string, ColumnType> = {
  serverSeq: 'int',
  updatedAt: 'text',
  deletedAt: 'text',
};

const entity = (table: string, columns: Record<string, ColumnType>): EntityTable => ({
  table,
  columns: { id: 'text', ...columns, ...SYNC_COLUMNS },
});

export const ENTITY_TABLES: Record<SyncEntity, EntityTable> = {
  shop: entity('shops', {
    name: 'text',
    currency: 'text',
    timezone: 'text',
    countryCode: 'text',
    lowStockThresholdDefault: 'int',
    createdAt: 'text',
  }),
  product: entity('products', {
    name: 'text',
    category: 'text',
    sku: 'text',
    unit: 'text',
    costPriceMinor: 'int',
    sellPriceMinor: 'int',
    lowStockThreshold: 'int',
    isLooseGood: 'bool',
    defaultSupplierId: 'text',
    imageUrl: 'text',
    createdAt: 'text',
  }),
  product_barcode: entity('product_barcodes', {
    productId: 'text',
    barcode: 'text',
    format: 'text',
    createdAt: 'text',
  }),
  creditor: entity('creditors', {
    name: 'text',
    phone: 'text',
    email: 'text',
    note: 'text',
    dueDate: 'text',
    remindersOptedOut: 'bool',
    source: 'text',
    createdAt: 'text',
  }),
  supplier: entity('suppliers', {
    name: 'text',
    phone: 'text',
    category: 'text',
    address: 'text',
    latitude: 'real',
    longitude: 'real',
    source: 'text',
    externalId: 'text',
    createdAt: 'text',
  }),
  reminder_schedule: entity('reminder_schedules', {
    creditorId: 'text',
    channel: 'text',
    rules: 'json',
    enabled: 'bool',
    createdAt: 'text',
  }),
  stock_movement: entity('stock_movements', {
    productId: 'text',
    delta: 'int',
    reason: 'text',
    unitCostMinor: 'int',
    supplierId: 'text',
    saleId: 'text',
    note: 'text',
    occurredAt: 'text',
  }),
  sale: entity('sales', {
    totalMinor: 'int',
    costTotalMinor: 'int',
    paymentMethod: 'text',
    creditorId: 'text',
    note: 'text',
    occurredAt: 'text',
  }),
  sale_item: entity('sale_items', {
    saleId: 'text',
    productId: 'text',
    description: 'text',
    quantity: 'int',
    unitPriceMinor: 'int',
    unitCostMinor: 'int',
  }),
  credit_ledger_entry: entity('credit_ledger_entries', {
    creditorId: 'text',
    amountMinor: 'int',
    kind: 'text',
    saleId: 'text',
    note: 'text',
    occurredAt: 'text',
  }),
  price_change: entity('price_changes', {
    productId: 'text',
    fromCostMinor: 'int',
    toCostMinor: 'int',
    fromSellMinor: 'int',
    toSellMinor: 'int',
    occurredAt: 'text',
  }),
};

/** Converts an API value into something SQLite can bind. */
export function toSqlite(value: unknown, type: ColumnType): string | number | null {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'bool':
      return value ? 1 : 0;
    case 'int':
      return Math.trunc(Number(value));
    case 'real':
      return Number(value);
    case 'json':
      return JSON.stringify(value);
    case 'text':
      return typeof value === 'string' ? value : String(value);
  }
}

/** Converts a stored value back into the shape the app's types expect. */
export function fromSqlite(value: unknown, type: ColumnType): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'bool':
      return value === 1 || value === true;
    case 'json':
      try {
        return JSON.parse(String(value));
      } catch {
        return null;
      }
    default:
      return value;
  }
}
