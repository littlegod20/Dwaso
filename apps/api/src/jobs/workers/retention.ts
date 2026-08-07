import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { messageOutbox, productImages } from '../../db/schema/index.js';
import { createObjectStorage } from '../../providers/storage.js';

const DAY_MS = 86_400_000;

/**
 * Deletes data past its retention window and advances the tombstone floor.
 *
 * Two unrelated obligations happen to share a schedule. The first is legal:
 * scan images are photographs taken inside someone's business and delivery logs
 * name third parties, so neither should be kept indefinitely just because
 * storage is cheap. The second is protocol: tombstones cannot be pruned without
 * telling clients, because a device whose cursor predates the pruned range would
 * silently never learn about the deletions. Raising `tombstoneFloorSeq` first is
 * what converts that silent corruption into an explicit resync.
 */
export async function purgeExpiredData(app: FastifyInstance): Promise<{
  scanImages: number;
  deliveries: number;
  shopsAdvanced: number;
}> {
  const storage = createObjectStorage(app.env);
  const now = Date.now();
  const scanCutoff = new Date(now - app.env.SCAN_IMAGE_RETENTION_DAYS * DAY_MS);
  const deliveryCutoff = new Date(now - app.env.MESSAGE_LOG_RETENTION_DAYS * DAY_MS);
  const tombstoneCutoff = new Date(now - app.env.TOMBSTONE_RETENTION_DAYS * DAY_MS);

  // Only images that never became a reference for a product. A photo attached to
  // a live product is still doing work — it is how the next scan of that item
  // resolves for free — whereas one that matched nothing is just a photograph of
  // the inside of someone's business sitting in a bucket.
  const orphanImages = await app.db
    .select({ id: productImages.id, storageKey: productImages.storageKey })
    .from(productImages)
    .where(and(lt(productImages.createdAt, scanCutoff), isNull(productImages.productId)))
    .limit(1_000);

  let purgedImages = 0;

  for (const image of orphanImages) {
    try {
      // The object goes first. Deleting the row first would strand the object
      // with nothing left pointing at it, which is the one outcome no later run
      // can repair.
      await storage.delete(image.storageKey);
      await app.db.delete(productImages).where(eq(productImages.id, image.id));
      purgedImages += 1;
    } catch (error) {
      app.log.warn({ err: error, imageId: image.id }, 'Failed to purge scan image');
    }
  }

  const purgedDeliveries = await app.db
    .delete(messageOutbox)
    .where(
      and(
        lt(messageOutbox.createdAt, deliveryCutoff),
        sql`${messageOutbox.status} in ('sent', 'delivered', 'suppressed', 'failed')`,
      ),
    )
    .returning({ id: messageOutbox.id });

  const advanced = await advanceTombstoneFloor(app, tombstoneCutoff);

  app.log.info(
    { scanImages: purgedImages, deliveries: purgedDeliveries.length, shopsAdvanced: advanced },
    'Retention purge completed',
  );

  return {
    scanImages: purgedImages,
    deliveries: purgedDeliveries.length,
    shopsAdvanced: advanced,
  };
}

/**
 * Moves each shop's tombstone floor up to the highest sequence number that is
 * now older than the retention window.
 *
 * A client pulling with a cursor below the floor gets `resync_required` instead
 * of an incomplete answer. That is a deliberately loud failure: a wrong-but-quiet
 * sync is far worse for a trader than a slow one, because she would be selling
 * against stock levels that no longer exist.
 */
async function advanceTombstoneFloor(app: FastifyInstance, cutoff: Date): Promise<number> {
  const rows = await app.db.execute<{ id: string }>(sql`
    with floors as (
      select
        s.id,
        coalesce(
          (
            select max(seq) from (
              select max(server_seq) as seq from products
                where shop_id = s.id and updated_at < ${cutoff}
              union all
              select max(server_seq) from creditors
                where shop_id = s.id and updated_at < ${cutoff}
              union all
              select max(server_seq) from stock_movements
                where shop_id = s.id and updated_at < ${cutoff}
              union all
              select max(server_seq) from sales
                where shop_id = s.id and updated_at < ${cutoff}
            ) as per_table
          ),
          s.tombstone_floor_seq
        ) as new_floor
      from shops s
    )
    update shops
    set tombstone_floor_seq = floors.new_floor
    from floors
    where shops.id = floors.id
      and floors.new_floor > shops.tombstone_floor_seq
    returning shops.id
  `);

  return rows.length;
}
