import { boolean, date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moneyMinor, syncColumns, tenantColumns } from './columns.js';

export const creditorSourceEnum = pgEnum('creditor_source', ['manual', 'contact_import']);

export const ledgerEntryKindEnum = pgEnum('ledger_entry_kind', [
  'credit_sale',
  'payment',
  'adjustment',
  'write_off',
]);

/**
 * A creditor is a third party who never installed the app and never consented to
 * being in it. Under Ghana's Act 843 the trader is the controller and Dwaso the
 * processor, so this table holds the minimum needed to chase a debt and carries
 * its own opt-out flag rather than relying on a global setting.
 */
export const creditors = pgTable(
  'creditors',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    dueDate: date('due_date', { mode: 'string' }),
    note: text('note'),
    /** Set when the person asks not to be contacted; suppresses every reminder. */
    remindersOptedOut: boolean('reminders_opted_out').notNull().default(false),
    source: creditorSourceEnum('source').notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('creditors_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('creditors_shop_due_idx').on(table.shopId, table.dueDate),
  ],
);

/**
 * Append-only. A balance is the sum of these entries, never a stored number:
 * two devices cannot disagree about a sum, and a trader disputing a balance can
 * be shown exactly which entries produced it.
 */
export const creditLedgerEntries = pgTable(
  'credit_ledger_entries',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    creditorId: uuid('creditor_id')
      .notNull()
      .references(() => creditors.id, { onDelete: 'cascade' }),
    kind: ledgerEntryKindEnum('kind').notNull(),
    /** Positive increases the debt; payments are negative. */
    amountMinor: moneyMinor('amount_minor').notNull(),
    saleId: uuid('sale_id'),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('credit_ledger_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('credit_ledger_creditor_idx').on(table.shopId, table.creditorId, table.occurredAt),
  ],
);
