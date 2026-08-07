/**
 * The local mirror of the server's synced tables.
 *
 * Two things are deliberately absent. There are no `product_stock` or
 * `creditor_balances` tables, because those are server projections that are
 * never synced — the device folds its own copy of the event log to get the same
 * numbers, which is what lets a trader record a sale offline and immediately see
 * the stock level move. And every table keeps `serverSeq`, so the sync engine
 * can tell a row it has already seen from one it has not.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Mutable entities: metadata a trader edits, merged last-writer-wins.

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
  countryCode TEXT NOT NULL DEFAULT 'GH',
  lowStockThresholdDefault INTEGER NOT NULL DEFAULT 5,
  createdAt TEXT,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  costPriceMinor INTEGER NOT NULL DEFAULT 0,
  sellPriceMinor INTEGER NOT NULL DEFAULT 0,
  lowStockThreshold INTEGER NOT NULL DEFAULT 5,
  isLooseGood INTEGER NOT NULL DEFAULT 0,
  defaultSupplierId TEXT,
  imageUrl TEXT,
  createdAt TEXT,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name);
CREATE INDEX IF NOT EXISTS products_seq_idx ON products(serverSeq);

CREATE TABLE IF NOT EXISTS product_barcodes (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL,
  barcode TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'other',
  createdAt TEXT,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
-- Not unique: a tombstoned row must be allowed to coexist with its replacement
-- until the next pull prunes it.
CREATE INDEX IF NOT EXISTS product_barcodes_code_idx ON product_barcodes(barcode);

CREATE TABLE IF NOT EXISTS creditors (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  note TEXT,
  dueDate TEXT,
  remindersOptedOut INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  createdAt TEXT,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS creditors_name_idx ON creditors(name);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  category TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  externalId TEXT,
  createdAt TEXT,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS reminder_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  creditorId TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  rules TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);

-- Event entities: append-only, immutable, and therefore never in conflict.

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  unitCostMinor INTEGER,
  supplierId TEXT,
  saleId TEXT,
  note TEXT,
  occurredAt TEXT NOT NULL,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(productId, occurredAt);
CREATE INDEX IF NOT EXISTS stock_movements_reason_idx ON stock_movements(reason, occurredAt);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  totalMinor INTEGER NOT NULL DEFAULT 0,
  costTotalMinor INTEGER NOT NULL DEFAULT 0,
  paymentMethod TEXT NOT NULL DEFAULT 'cash',
  creditorId TEXT,
  note TEXT,
  occurredAt TEXT NOT NULL,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS sales_occurred_idx ON sales(occurredAt);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY NOT NULL,
  saleId TEXT NOT NULL,
  productId TEXT,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unitPriceMinor INTEGER NOT NULL DEFAULT 0,
  unitCostMinor INTEGER NOT NULL DEFAULT 0,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(saleId);

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  creditorId TEXT NOT NULL,
  amountMinor INTEGER NOT NULL,
  kind TEXT NOT NULL,
  saleId TEXT,
  note TEXT,
  occurredAt TEXT NOT NULL,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS credit_ledger_creditor_idx ON credit_ledger_entries(creditorId, occurredAt);

CREATE TABLE IF NOT EXISTS price_changes (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL,
  fromCostMinor INTEGER,
  toCostMinor INTEGER,
  fromSellMinor INTEGER,
  toSellMinor INTEGER,
  occurredAt TEXT NOT NULL,
  serverSeq INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS price_changes_product_idx ON price_changes(productId, occurredAt);

-- Local-only tables. These never sync; they are the machinery of syncing.

/*
 * The outbox. Every local write appends here in the same transaction as the row
 * it changed, so a mutation cannot be lost between "the trader saw it saved" and
 * "the server heard about it" — the two facts are committed together or not at
 * all.
 */
CREATE TABLE IF NOT EXISTS outbox (
  mutationId TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  op TEXT NOT NULL,
  entityId TEXT NOT NULL,
  payload TEXT NOT NULL,
  clientTimestamp TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  /* Set when the server permanently rejected it. Kept rather than deleted so the
   * trader can be shown what did not save instead of silently losing it. */
  rejectedAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(rejectedAt, createdAt);

/* Single-row key/value store for the sync cursor and session scoping. */
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
`;

/**
 * Tables holding synced rows, in the order they must be cleared during a
 * resync. Children first so a foreign-key-shaped dependency never dangles, even
 * though SQLite is not enforcing those relationships here.
 */
export const SYNCED_TABLES = [
  'sale_items',
  'sales',
  'credit_ledger_entries',
  'stock_movements',
  'price_changes',
  'product_barcodes',
  'products',
  'creditors',
  'suppliers',
  'reminder_schedules',
  'shops',
] as const;
