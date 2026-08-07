import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { creditors, messageOutbox } from '../../db/schema/index.js';
import { createMessageSenders } from '../../providers/messaging.js';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

/**
 * Drains the transactional outbox.
 *
 * Claiming rows with `FOR UPDATE SKIP LOCKED` is what makes this safe to run on
 * every instance at once: two workers can drain concurrently and will never pick
 * the same message, so a duplicate reminder cannot be produced by scaling out.
 */
export async function drainMessageOutbox(app: FastifyInstance): Promise<number> {
  const senders = createMessageSenders(app.env, app.log);
  let sent = 0;

  const claimed = await app.db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(messageOutbox)
      .where(
        and(eq(messageOutbox.status, 'pending'), lte(messageOutbox.scheduledFor, new Date())),
      )
      .orderBy(asc(messageOutbox.scheduledFor))
      .limit(BATCH_SIZE)
      .for('update', { skipLocked: true });

    if (!rows.length) return [];

    await tx
      .update(messageOutbox)
      .set({ status: 'sending', attempts: sql`${messageOutbox.attempts} + 1` })
      .where(
        sql`${messageOutbox.id} = any(${sql.param(rows.map((row) => row.id))}::uuid[])`,
      );

    return rows;
  });

  for (const message of claimed) {
    // Opt-out is re-checked at send time, not just at queue time: someone may
    // have asked to be left alone in the minutes since the reminder was queued,
    // and honouring that late is much better than honouring it never.
    const [creditor] = await app.db
      .select({ optedOut: creditors.remindersOptedOut })
      .from(creditors)
      .where(eq(creditors.id, message.creditorId))
      .limit(1);

    if (!creditor || creditor.optedOut) {
      await app.db
        .update(messageOutbox)
        .set({ status: 'suppressed', lastError: 'Recipient has opted out' })
        .where(eq(messageOutbox.id, message.id));
      continue;
    }

    try {
      const result = await senders[message.channel].send({
        to: message.recipient,
        body: message.body,
      });

      await app.db
        .update(messageOutbox)
        .set({
          status: 'sent',
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
          lastError: null,
        })
        .where(eq(messageOutbox.id, message.id));

      sent += 1;
    } catch (error) {
      const attempts = message.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;

      await app.db
        .update(messageOutbox)
        .set({
          // Back to pending so the next drain retries, unless the budget is
          // spent — at which point it stays failed for a human to look at
          // rather than retrying forever.
          status: exhausted ? 'failed' : 'pending',
          lastError: error instanceof Error ? error.message : 'Unknown send failure',
          scheduledFor: new Date(Date.now() + 2 ** attempts * 5_000),
        })
        .where(eq(messageOutbox.id, message.id));

      app.log.warn(
        { err: error, messageId: message.id, attempts },
        exhausted ? 'Message send permanently failed' : 'Message send failed, will retry',
      );
    }
  }

  return sent;
}
