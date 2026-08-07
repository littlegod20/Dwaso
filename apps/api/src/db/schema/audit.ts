import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from './columns.js';

/**
 * Records actions that move money or destroy data. This is separate from the
 * event log: the events say what the books now claim, this says who caused the
 * claim and from which device — the question that actually gets asked when a
 * trader and her assistant disagree about a balance.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...tenantColumns(),
    userId: uuid('user_id'),
    deviceId: uuid('device_id'),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_shop_created_idx').on(table.shopId, table.createdAt),
    index('audit_log_entity_idx').on(table.shopId, table.entity, table.entityId),
  ],
);
