import { bigint, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.js';

export const currencyEnum = pgEnum('currency', ['GHS', 'NGN', 'USD', 'EUR']);
export const shopRoleEnum = pgEnum('shop_role', ['owner', 'staff']);

export const shops = pgTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /**
   * One currency per business account, never per transaction. Mixing currencies
   * inside a shop's ledger would make every total and margin meaningless.
   */
  currency: currencyEnum('currency').notNull().default('GHS'),
  timezone: text('timezone').notNull().default('Africa/Accra'),
  countryCode: text('country_code').notNull().default('GH'),
  lowStockThresholdDefault: integer('low_stock_threshold_default').notNull().default(5),

  /**
   * The gapless per-shop sync cursor. Every replicated write increments this
   * inside its own transaction via `UPDATE ... RETURNING`, which takes a row
   * lock and therefore serialises sequence assignment for this shop.
   *
   * A global bigserial would not work: concurrent transactions can commit out of
   * order, so a client that had already advanced past a lower number would never
   * be told about the row carrying it.
   */
  seq: bigint('seq', { mode: 'number' }).notNull().default(0),

  /**
   * The oldest sequence number still safely pullable. The retention job raises
   * this as it purges expired tombstones, and a device asking for anything below
   * it is told to resync — because the rows that recorded those deletions are
   * gone, and silently omitting them would leave the device with rows the trader
   * deleted months ago.
   */
  tombstoneFloorSeq: bigint('tombstone_floor_seq', { mode: 'number' }).notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const shopMembers = pgTable(
  'shop_members',
  {
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: shopRoleEnum('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.userId] }),
    index('shop_members_user_idx').on(table.userId),
  ],
);
