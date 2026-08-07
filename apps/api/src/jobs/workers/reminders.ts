import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { MessageChannel, ReminderRule } from '@dwaso/shared-types';
import { formatMoney } from '@dwaso/domain';
import { composeReminder } from '../../providers/messaging.js';
import { todayInShop } from '../../lib/time.js';
import { systemTenant } from '../../lib/tenant.js';
import {
  creditorBalances,
  creditors,
  messageOutbox,
  reminderSchedules,
  shops,
} from '../../db/schema/index.js';

type ShopRow = typeof shops.$inferSelect;

/**
 * Decides whether a rule fires today.
 *
 * `daysOverdue` is positive once the due date has passed and negative before it,
 * so a single number covers both the "three days before" and "three days after"
 * cases without a second branch.
 */
function ruleFiresToday(rule: ReminderRule, daysOverdue: number | null): boolean {
  if (daysOverdue === null) {
    // No due date on file. Only the open-ended weekly nudge makes sense, and
    // only on one fixed weekday so it does not become a daily nag.
    return rule.trigger === 'weekly_until_paid' && new Date().getUTCDay() === 1;
  }

  switch (rule.trigger) {
    case 'days_before_due':
      return daysOverdue === -rule.offsetDays;
    case 'on_due_date':
      return daysOverdue === 0;
    case 'days_after_due':
      return daysOverdue === rule.offsetDays;
    case 'weekly_until_paid':
      return daysOverdue > 0 && daysOverdue % 7 === 0;
  }
}

function daysBetweenDates(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Evaluates every shop's reminder schedules and queues what is due.
 *
 * Queueing rather than sending is the whole point: this function only ever
 * writes outbox rows, so it can crash, retry, or run twice without producing a
 * duplicate message — the dedupe key absorbs the repeat.
 */
export async function sweepReminders(app: FastifyInstance): Promise<number> {
  const allShops = await app.db.select().from(shops);
  let queued = 0;

  for (const shop of allShops) {
    try {
      queued += await sweepShop(app, shop);
    } catch (error) {
      // One trader's bad data must not stop every other trader's reminders.
      app.log.error({ err: error, shopId: shop.id }, 'Reminder sweep failed for shop');
    }
  }

  return queued;
}

async function sweepShop(app: FastifyInstance, shop: ShopRow): Promise<number> {
  const tenant = systemTenant(shop.id, app.db);
  const today = todayInShop(shop.timezone);

  const schedules = await tenant.db
    .select()
    .from(reminderSchedules)
    .where(
      and(
        eq(reminderSchedules.shopId, shop.id),
        eq(reminderSchedules.enabled, true),
        isNull(reminderSchedules.deletedAt),
      ),
    );

  if (!schedules.length) return 0;

  const globalSchedule = schedules.find((row) => row.creditorId === null) ?? null;
  const perCreditor = new Map(
    schedules.filter((row) => row.creditorId).map((row) => [row.creditorId!, row]),
  );

  const outstanding = await tenant.db
    .select({
      creditor: creditors,
      balanceMinor: creditorBalances.balanceMinor,
    })
    .from(creditors)
    .innerJoin(
      creditorBalances,
      and(
        eq(creditorBalances.creditorId, creditors.id),
        eq(creditorBalances.shopId, creditors.shopId),
      ),
    )
    .where(
      and(
        eq(creditors.shopId, shop.id),
        isNull(creditors.deletedAt),
        eq(creditors.remindersOptedOut, false),
        gt(creditorBalances.balanceMinor, 0),
      ),
    );

  const rows: {
    shopId: string;
    creditorId: string;
    channel: MessageChannel;
    recipient: string;
    body: string;
    dedupeKey: string;
  }[] = [];

  for (const { creditor, balanceMinor } of outstanding) {
    // A schedule naming this customer wins outright over the shop default,
    // rather than layering on top of it — two overlapping schedules would
    // otherwise mean two messages.
    const schedule = perCreditor.get(creditor.id) ?? globalSchedule;
    if (!schedule) continue;

    const daysOverdue = creditor.dueDate ? daysBetweenDates(creditor.dueDate, today) : null;
    if (!schedule.rules.some((rule) => ruleFiresToday(rule, daysOverdue))) continue;

    const channel = schedule.channel;
    const recipient = channel === 'email' ? creditor.email : creditor.phone;
    if (!recipient) continue;

    rows.push({
      shopId: shop.id,
      creditorId: creditor.id,
      channel,
      recipient,
      body: composeReminder({
        businessName: shop.name,
        creditorName: creditor.name,
        amountFormatted: formatMoney(Number(balanceMinor), shop.currency),
        dueDate: creditor.dueDate,
        daysOverdue,
      }),
      dedupeKey: `${shop.id}:${creditor.id}:${channel}:${today}`,
    });
  }

  if (!rows.length) return 0;

  const inserted = await app.db
    .insert(messageOutbox)
    .values(rows)
    // Silently skips anyone the trader already messaged by hand today, which is
    // the same guarantee the manual send path relies on.
    .onConflictDoNothing({ target: messageOutbox.dedupeKey })
    .returning({ id: messageOutbox.id });

  app.log.info(
    { shopId: shop.id, candidates: rows.length, queued: inserted.length },
    'Reminder sweep completed for shop',
  );

  return inserted.length;
}

/** Marks messages stuck in `sending` as pending again after a crash mid-send. */
export async function requeueStalledMessages(app: FastifyInstance): Promise<number> {
  const rows = await app.db
    .update(messageOutbox)
    .set({ status: 'pending' })
    .where(
      and(
        eq(messageOutbox.status, 'sending'),
        sql`${messageOutbox.scheduledFor} < now() - interval '10 minutes'`,
      ),
    )
    .returning({ id: messageOutbox.id });

  return rows.length;
}
