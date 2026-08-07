import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from './columns.js';

/**
 * The idempotency ledger for sync. A device generates `mutationId` before it
 * attempts a write, so the primary key here is what makes an aggressive retry
 * over a flaky market connection safe: replaying a batch cannot double-record a
 * sale, because the second insert collides with this key and is reported as a
 * duplicate instead of applied.
 *
 * Rows are retained for the tombstone window, which is also the maximum age of a
 * mutation a client could still be holding in its outbox.
 */
export const syncMutations = pgTable(
  'sync_mutations',
  {
    mutationId: uuid('mutation_id').primaryKey(),
    ...tenantColumns(),
    deviceId: uuid('device_id').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    op: text('op').notNull(),
    serverSeq: bigint('server_seq', { mode: 'number' }),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sync_mutations_shop_applied_idx').on(table.shopId, table.appliedAt),
    index('sync_mutations_entity_idx').on(table.shopId, table.entity, table.entityId),
  ],
);

/**
 * Per-device cursor. Stored server-side purely as diagnostics — the client owns
 * its own cursor — but it is what lets support answer "why has this phone not
 * seen the sale her assistant recorded".
 */
export const syncDeviceState = pgTable(
  'sync_device_state',
  {
    deviceId: uuid('device_id').primaryKey(),
    ...tenantColumns(),
    lastPulledSeq: bigint('last_pulled_seq', { mode: 'number' }).notNull().default(0),
    lastPushedAt: timestamp('last_pushed_at', { withTimezone: true }),
    lastPulledAt: timestamp('last_pulled_at', { withTimezone: true }),
  },
  (table) => [index('sync_device_state_shop_idx').on(table.shopId)],
);
