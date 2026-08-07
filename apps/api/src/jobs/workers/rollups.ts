import type { FastifyInstance } from 'fastify';
import { shops } from '../../db/schema/index.js';
import { dayBoundsUtc, addDays, todayInShop } from '../../lib/time.js';
import { systemTenant, withTenantTransaction } from '../../lib/tenant.js';
import { rebuildDailyMetrics } from '../../modules/projections/service.js';

/**
 * Rebuilds yesterday's metrics row for every shop.
 *
 * Yesterday rather than today because a shop's day closes at its own local
 * midnight, and this runs on one global schedule. Recomputing the finished day
 * is also the repair mechanism: a sale that arrived late from an offline device
 * lands in the right day here, without anyone noticing the report was briefly
 * wrong.
 */
export async function rollupDailyMetrics(app: FastifyInstance): Promise<number> {
  const allShops = await app.db.select().from(shops);
  let rebuilt = 0;

  for (const shop of allShops) {
    try {
      const tenant = systemTenant(shop.id, app.db);
      const date = addDays(todayInShop(shop.timezone), -1);
      const { start, end } = dayBoundsUtc(date, shop.timezone);

      await withTenantTransaction(app.db, tenant, async (tx) => {
        await rebuildDailyMetrics(tx, shop.id, date, start, end);
      });

      rebuilt += 1;
    } catch (error) {
      app.log.error({ err: error, shopId: shop.id }, 'Daily rollup failed for shop');
    }
  }

  return rebuilt;
}
