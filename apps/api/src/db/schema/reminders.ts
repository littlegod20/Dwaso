import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { syncColumns, tenantColumns } from './columns.js';
import { creditors } from './credit.js';
import type { ReminderRule } from '@dwaso/shared-types';

export const messageChannelEnum = pgEnum('message_channel', ['whatsapp', 'sms', 'email']);

export const messageStatusEnum = pgEnum('message_status', [
  'pending',
  'sending',
  'sent',
  'delivered',
  'failed',
  'suppressed',
]);

/**
 * A null `creditorId` is the shop-wide default; a row naming a creditor
 * overrides it for that person, which is exactly the "This customer / Global
 * default" toggle in the UI.
 */
export const reminderSchedules = pgTable(
  'reminder_schedules',
  {
    id: uuid('id').primaryKey(),
    ...tenantColumns(),
    creditorId: uuid('creditor_id').references(() => creditors.id, { onDelete: 'cascade' }),
    channel: messageChannelEnum('channel').notNull().default('whatsapp'),
    rules: jsonb('rules').$type<ReminderRule[]>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (table) => [
    index('reminder_schedules_shop_seq_idx').on(table.shopId, table.serverSeq),
    index('reminder_schedules_creditor_idx').on(table.shopId, table.creditorId),
  ],
);

/**
 * Transactional outbox for every outbound message. A row is written in the same
 * transaction as the decision to send, and a worker drains it afterwards, so a
 * crash between "decide" and "send" loses nothing.
 *
 * `dedupeKey` is what stops a duplicate reminder. That matters more than a
 * typical double-write bug: sending the same debt reminder twice is a real
 * social problem between a trader and her customer, not just noise.
 */
export const messageOutbox = pgTable(
  'message_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...tenantColumns(),
    creditorId: uuid('creditor_id')
      .notNull()
      .references(() => creditors.id, { onDelete: 'cascade' }),
    channel: messageChannelEnum('channel').notNull(),
    recipient: text('recipient').notNull(),
    body: text('body').notNull(),
    status: messageStatusEnum('status').notNull().default('pending'),
    dedupeKey: text('dedupe_key').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('message_outbox_dedupe_key').on(table.dedupeKey),
    index('message_outbox_pending_idx').on(table.status, table.scheduledFor),
    index('message_outbox_creditor_idx').on(table.shopId, table.creditorId, table.createdAt),
  ],
);
