import { and, desc, eq, isNull } from 'drizzle-orm';
import type { SendReminder, UpsertReminderSchedule } from '@dwaso/shared-types';
import { formatMoney } from '@dwaso/domain';
import type { Database } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { nextSeq, withTenantTransaction, type TenantContext } from '../../lib/tenant.js';
import { todayInShop } from '../../lib/time.js';
import { composeReminder } from '../../providers/messaging.js';
import {
  creditorBalances,
  creditors,
  messageOutbox,
  reminderSchedules,
  shops,
} from '../../db/schema/index.js';

export class RemindersService {
  constructor(private readonly db: Database) {}

  async listSchedules(tenant: TenantContext) {
    return tenant.db
      .select()
      .from(reminderSchedules)
      .where(
        and(eq(reminderSchedules.shopId, tenant.shopId), isNull(reminderSchedules.deletedAt)),
      )
      .orderBy(desc(reminderSchedules.createdAt));
  }

  async upsertSchedule(tenant: TenantContext, input: UpsertReminderSchedule) {
    return withTenantTransaction(this.db, tenant, async (tx) => {
      const seq = await nextSeq(tx, tenant.shopId);
      const id = input.id ?? newId();

      const [row] = await tx
        .insert(reminderSchedules)
        .values({
          id,
          shopId: tenant.shopId,
          creditorId: input.creditorId ?? null,
          channel: input.channel,
          rules: input.rules,
          enabled: input.enabled ?? true,
          serverSeq: seq,
          updatedByDeviceId: tenant.deviceId,
        })
        .onConflictDoUpdate({
          target: reminderSchedules.id,
          set: {
            channel: input.channel,
            rules: input.rules,
            enabled: input.enabled ?? true,
            creditorId: input.creditorId ?? null,
            serverSeq: seq,
            updatedAt: new Date(),
            updatedByDeviceId: tenant.deviceId,
          },
        })
        .returning();

      return row;
    });
  }

  async deleteSchedule(tenant: TenantContext, id: string) {
    await withTenantTransaction(this.db, tenant, async (tx) => {
      const seq = await nextSeq(tx, tenant.shopId);

      const [row] = await tx
        .update(reminderSchedules)
        .set({
          deletedAt: new Date(),
          serverSeq: seq,
          updatedAt: new Date(),
          updatedByDeviceId: tenant.deviceId,
        })
        .where(
          and(
            eq(reminderSchedules.shopId, tenant.shopId),
            eq(reminderSchedules.id, id),
            isNull(reminderSchedules.deletedAt),
          ),
        )
        .returning();

      if (!row) throw AppError.notFound('Reminder schedule');
    });
  }

  /**
   * Queues a reminder rather than sending it inline.
   *
   * The row is written in the same transaction as the decision to send, and a
   * worker drains it afterwards, so a crash between deciding and sending loses
   * nothing. The dedupe key is what stops a duplicate — and a duplicate debt
   * reminder is a real social problem between a trader and her customer, not
   * just a noisy log line.
   */
  async queueReminder(tenant: TenantContext, input: SendReminder) {
    const shop = await this.loadShop(tenant);

    const [row] = await tenant.db
      .select({
        creditor: creditors,
        balanceMinor: creditorBalances.balanceMinor,
      })
      .from(creditors)
      .leftJoin(
        creditorBalances,
        and(
          eq(creditorBalances.creditorId, creditors.id),
          eq(creditorBalances.shopId, tenant.shopId),
        ),
      )
      .where(
        and(
          eq(creditors.shopId, tenant.shopId),
          eq(creditors.id, input.creditorId),
          isNull(creditors.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw AppError.notFound('Creditor');

    if (row.creditor.remindersOptedOut) {
      throw AppError.forbidden('This customer has asked not to receive reminders');
    }

    const recipient = input.channel === 'email' ? row.creditor.email : row.creditor.phone;
    if (!recipient) {
      throw AppError.badRequest(`This customer has no ${input.channel} contact on file`);
    }

    const balanceMinor = Number(row.balanceMinor ?? 0);
    if (balanceMinor <= 0) {
      throw AppError.badRequest('This customer has nothing outstanding');
    }

    const today = todayInShop(shop.timezone);

    const body =
      // A custom message still gets the sender identity and opt-out appended,
      // because those are legal requirements rather than defaults.
      input.body
        ? `${input.body}\n\nSent by ${shop.name}. Reply STOP to stop receiving these reminders.`
        : composeReminder({
            businessName: shop.name,
            creditorName: row.creditor.name,
            amountFormatted: formatMoney(balanceMinor, shop.currency),
            dueDate: row.creditor.dueDate,
            daysOverdue: null,
          });

    // One reminder per creditor per channel per day, whoever asks for it.
    const dedupeKey = `${tenant.shopId}:${input.creditorId}:${input.channel}:${today}`;

    const [queued] = await this.db
      .insert(messageOutbox)
      .values({
        shopId: tenant.shopId,
        creditorId: input.creditorId,
        channel: input.channel,
        recipient,
        body,
        dedupeKey,
      })
      .onConflictDoNothing({ target: messageOutbox.dedupeKey })
      .returning();

    return {
      queued: Boolean(queued),
      messageId: queued?.id ?? null,
      reason: queued ? null : 'A reminder was already queued for this customer today',
    };
  }

  async listDeliveries(tenant: TenantContext, limit = 50) {
    return tenant.db
      .select()
      .from(messageOutbox)
      .where(eq(messageOutbox.shopId, tenant.shopId))
      .orderBy(desc(messageOutbox.createdAt))
      .limit(limit);
  }

  private async loadShop(tenant: TenantContext) {
    const [shop] = await tenant.db
      .select()
      .from(shops)
      .where(eq(shops.id, tenant.shopId))
      .limit(1);

    if (!shop) throw AppError.notFound('Shop');
    return shop;
  }
}
