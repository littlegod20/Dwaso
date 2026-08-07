import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { todayInShop } from '../../lib/time.js';
import { systemTenant } from '../../lib/tenant.js';
import { createPushSender, type PushMessage } from '../../providers/push.js';
import {
  lowStockAlerts,
  productStock,
  products,
  pushTokens,
  shops,
} from '../../db/schema/index.js';

/**
 * Notifies traders about products that have fallen to or below their reorder
 * point.
 *
 * The debounce table is the load-bearing part. A trader selling from a
 * near-empty shelf crosses the threshold on every single sale; without a
 * per-product daily lock she would get a notification each time, and the
 * rational response to that is to turn notifications off entirely — which
 * silences the alerts that actually matter.
 */
export async function evaluateLowStock(app: FastifyInstance): Promise<number> {
  const push = createPushSender(app.env);
  const allShops = await app.db.select().from(shops);
  let notified = 0;

  for (const shop of allShops) {
    try {
      const tenant = systemTenant(shop.id, app.db);
      const today = todayInShop(shop.timezone);

      const breached = await tenant.db
        .select({
          productId: products.id,
          name: products.name,
          quantity: productStock.quantity,
          threshold: products.lowStockThreshold,
        })
        .from(products)
        .innerJoin(
          productStock,
          and(eq(productStock.productId, products.id), eq(productStock.shopId, products.shopId)),
        )
        .where(
          and(
            eq(products.shopId, shop.id),
            isNull(products.deletedAt),
            sql`${products.lowStockThreshold} > 0`,
            lte(productStock.quantity, products.lowStockThreshold),
          ),
        );

      if (!breached.length) continue;

      // Claiming the debounce rows first means a concurrent run of this job
      // cannot also claim them, so the notification is sent at most once even if
      // two instances evaluate the same shop at the same moment.
      const claimed = await app.db
        .insert(lowStockAlerts)
        .values(
          breached.map((row) => ({
            shopId: shop.id,
            productId: row.productId,
            alertedOn: today,
          })),
        )
        .onConflictDoNothing()
        .returning({ productId: lowStockAlerts.productId });

      if (!claimed.length) continue;

      const claimedIds = new Set(claimed.map((row) => row.productId));
      const toAnnounce = breached.filter((row) => claimedIds.has(row.productId));

      const tokens = await app.db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(and(eq(pushTokens.shopId, shop.id), isNull(pushTokens.disabledAt)));

      if (!tokens.length) continue;

      const messages: PushMessage[] = [];

      for (const { token } of tokens) {
        if (toAnnounce.length === 1) {
          const item = toAnnounce[0]!;
          messages.push({
            to: token,
            title: 'Running low',
            body: `${item.name} is down to ${item.quantity}. Tap to find a supplier.`,
            // The deep link is what turns an alert into an action: it opens
            // supplier search already filtered for the product that ran out.
            data: { type: 'low_stock', productId: item.productId, screen: 'suppliers' },
          });
        } else {
          messages.push({
            to: token,
            title: `${toAnnounce.length} products running low`,
            body: toAnnounce
              .slice(0, 3)
              .map((item) => item.name)
              .join(', '),
            data: { type: 'low_stock', screen: 'inventory' },
          });
        }
      }

      const tickets = await push.send(messages);
      notified += tickets.filter((ticket) => ticket.ok).length;

      const dead = tickets.filter((ticket) => ticket.unregistered).map((ticket) => ticket.token);
      if (dead.length) {
        await app.db
          .update(pushTokens)
          .set({ disabledAt: new Date() })
          .where(inArray(pushTokens.token, dead));
      }
    } catch (error) {
      app.log.error({ err: error, shopId: shop.id }, 'Low-stock evaluation failed for shop');
    }
  }

  return notified;
}
