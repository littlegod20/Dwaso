import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  EMBEDDING_DIMENSIONS,
  type ScanMatchRequest,
  type ScanMatchResponse,
} from '@dwaso/shared-types';
import type { Database } from '../../db/client.js';
import { newId, sha256 } from '../../lib/ids.js';
import { todayInShop } from '../../lib/time.js';
import { withTenantTransaction, nextSeq, type TenantContext } from '../../lib/tenant.js';
import type { VisionProvider } from '../../providers/vision.js';
import type { ObjectStorage } from '../../providers/storage.js';
import type { Env } from '../../config/env.js';
import {
  barcodeCatalog,
  productBarcodes,
  productEmbeddings,
  productImages,
  products,
  saleItems,
  sales,
  scanEvents,
  scanQuotaUsage,
  shops,
  stockMovements,
} from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { rebuildProductStock } from '../projections/service.js';

/**
 * The scan cascade, server side.
 *
 * Tiers 1 and 2 (barcode and on-device embedding) run on the device and never
 * reach here. This class handles what is left: the barcode lookups the device
 * could not resolve locally, and the paid vision tier.
 *
 * Two invariants shape everything below:
 *
 * 1. A sale is never blocked on recognition. Every failure path returns
 *    candidates the trader can pick from rather than an error.
 * 2. Tier 3 is self-eliminating. Every vision call enrols the product — barcode
 *    pairing and reference image — so the next sighting resolves in a free,
 *    offline tier. If that stops happening, `scan_events` will show it.
 */
export class ScanService {
  constructor(
    private readonly db: Database,
    private readonly vision: VisionProvider,
    private readonly storage: ObjectStorage,
    private readonly env: Env,
  ) {}

  async match(tenant: TenantContext, request: ScanMatchRequest): Promise<ScanMatchResponse> {
    const scanEventId = request.scanEventId ?? newId();
    const image = Buffer.from(request.imageBase64, 'base64');
    const imageHash = sha256(image);

    // Content-hash dedupe. The same frame — a trader scanning the same tin twice
    // in a row, or a retry after a timeout — must never bill twice.
    const cached = await this.findByImageHash(tenant, imageHash);
    if (cached) {
      await this.recordScan(tenant, {
        id: scanEventId,
        tier: 'embedding',
        matchedProductId: cached.productId,
        confidence: 1,
        latencyMs: 0,
        costMicros: 0,
        imageHash,
      });

      return this.respond(scanEventId, 'embedding', cached.productId, 1, [], null, false);
    }

    if (request.barcode) {
      const matched = await this.lookupBarcode(tenant, request.barcode);
      if (matched) {
        await this.recordScan(tenant, {
          id: scanEventId,
          tier: 'barcode',
          matchedProductId: matched,
          confidence: 1,
          latencyMs: 0,
          costMicros: 0,
          barcode: request.barcode,
          imageHash,
        });

        return this.respond(scanEventId, 'barcode', matched, 1, [], null, false);
      }
    }

    const withinQuota = await this.consumeQuota(tenant);

    if (!withinQuota) {
      // Degrade rather than fail: the trader picks from recent products and the
      // sale completes. An error here would stop the shop from selling.
      const candidates = await this.recentProducts(tenant);
      await this.recordScan(tenant, {
        id: scanEventId,
        tier: 'manual',
        matchedProductId: null,
        confidence: 0,
        latencyMs: 0,
        costMicros: 0,
        imageHash,
      });

      return this.respond(scanEventId, 'manual', null, 0, candidates, null, true);
    }

    const catalogue = await this.shopCatalogue(tenant);

    let vision;
    try {
      vision = await this.vision.identify({
        imageBase64: request.imageBase64,
        mediaType: 'image/jpeg',
        candidates: catalogue.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
        })),
      });
    } catch {
      const candidates = await this.recentProducts(tenant);
      await this.recordScan(tenant, {
        id: scanEventId,
        tier: 'manual',
        matchedProductId: null,
        confidence: 0,
        latencyMs: 0,
        costMicros: 0,
        imageHash,
      });

      return this.respond(scanEventId, 'manual', null, 0, candidates, null, false);
    }

    const { result } = vision;

    await this.enrol(tenant, {
      imageHash,
      image,
      matchedProductId: result.matchedProductId,
      barcode: result.visibleBarcode ?? request.barcode ?? null,
      extractedName: result.extractedName,
      category: result.category,
    });

    await this.recordScan(tenant, {
      id: scanEventId,
      tier: 'vision',
      matchedProductId: result.matchedProductId,
      confidence: result.confidence,
      latencyMs: vision.latencyMs,
      costMicros: vision.costMicros,
      barcode: result.visibleBarcode ?? request.barcode ?? null,
      imageHash,
    });

    const candidates = result.matchedProductId ? [] : await this.recentProducts(tenant);

    return this.respond(
      scanEventId,
      'vision',
      result.matchedProductId,
      result.confidence,
      candidates,
      result.matchedProductId
        ? null
        : {
            name: result.extractedName,
            category: result.category,
            barcode: result.visibleBarcode,
          },
      false,
    );
  }

  /** Tier 1 lookup for a device whose local barcode cache missed. */
  async lookupBarcode(tenant: TenantContext, barcode: string): Promise<string | null> {
    const [own] = await tenant.db
      .select({ productId: productBarcodes.productId })
      .from(productBarcodes)
      .innerJoin(products, eq(products.id, productBarcodes.productId))
      .where(
        and(
          eq(productBarcodes.shopId, tenant.shopId),
          eq(productBarcodes.barcode, barcode),
          isNull(productBarcodes.deletedAt),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);

    return own?.productId ?? null;
  }

  /**
   * The cross-shop catalog: generic identity only, never anyone's prices, costs
   * or volumes. Once one trader enrols Peak Milk Tin 400g, every other trader's
   * first scan of it resolves instantly and for free.
   */
  async lookupGlobalBarcode(barcode: string) {
    const [entry] = await this.db
      .select()
      .from(barcodeCatalog)
      .where(eq(barcodeCatalog.barcode, barcode))
      .limit(1);

    return entry ?? null;
  }

  /** Barcodes the device caches for offline tier-1 resolution. */
  async deviceCatalogue(tenant: TenantContext) {
    return tenant.db
      .select({
        barcode: productBarcodes.barcode,
        productId: productBarcodes.productId,
        name: products.name,
        category: products.category,
      })
      .from(productBarcodes)
      .innerJoin(products, eq(products.id, productBarcodes.productId))
      .where(
        and(
          eq(productBarcodes.shopId, tenant.shopId),
          isNull(productBarcodes.deletedAt),
          isNull(products.deletedAt),
        ),
      );
  }

  /**
   * Links what the vision tier learned back onto the catalog, which is what
   * makes the tier self-eliminating rather than a recurring per-scan charge.
   */
  private async enrol(
    tenant: TenantContext,
    input: {
      imageHash: string;
      image: Buffer;
      matchedProductId: string | null;
      barcode: string | null;
      extractedName: string | null;
      category: string | null;
    },
  ) {
    const storageKey = `scans/${tenant.shopId}/${input.imageHash}.jpg`;

    await this.storage.put(storageKey, input.image, 'image/jpeg').catch(() => {
      // Losing the reference image costs a future free match, not a sale.
    });

    await withTenantTransaction(this.db, tenant, async (tx) => {
      await tx
        .insert(productImages)
        .values({
          shopId: tenant.shopId,
          productId: input.matchedProductId,
          storageKey,
          contentHash: input.imageHash,
        })
        .onConflictDoNothing();

      if (input.barcode && input.matchedProductId) {
        const seq = await nextSeq(tx, tenant.shopId);

        await tx
          .insert(productBarcodes)
          .values({
            id: newId(),
            shopId: tenant.shopId,
            productId: input.matchedProductId,
            barcode: input.barcode,
            serverSeq: seq,
            updatedByDeviceId: tenant.deviceId,
          })
          .onConflictDoNothing();
      }

      // The global catalog only ever receives generic identity. `confirmations`
      // tracks how many distinct shops have agreed, so a single mistaken pairing
      // stays a suggestion rather than becoming a fact for everyone.
      if (input.barcode && input.extractedName) {
        await tx
          .insert(barcodeCatalog)
          .values({
            barcode: input.barcode,
            name: input.extractedName,
            category: input.category,
          })
          .onConflictDoUpdate({
            target: barcodeCatalog.barcode,
            set: {
              confirmations: sql`${barcodeCatalog.confirmations} + 1`,
              updatedAt: new Date(),
            },
          });
      }
    });
  }

  private async findByImageHash(tenant: TenantContext, imageHash: string) {
    const [row] = await tenant.db
      .select({ productId: productImages.productId })
      .from(productImages)
      .where(and(eq(productImages.shopId, tenant.shopId), eq(productImages.contentHash, imageHash)))
      .limit(1);

    return row?.productId ? { productId: row.productId } : null;
  }

  /**
   * Per-shop daily budget for the paid tier. Enforced with an atomic increment
   * so a client firing concurrent scans cannot slip past the ceiling.
   */
  private async consumeQuota(tenant: TenantContext): Promise<boolean> {
    const [shop] = await tenant.db
      .select({ timezone: shops.timezone })
      .from(shops)
      .where(eq(shops.id, tenant.shopId))
      .limit(1);

    const date = todayInShop(shop?.timezone ?? 'Africa/Accra');

    const [row] = await this.db
      .insert(scanQuotaUsage)
      .values({ shopId: tenant.shopId, date, visionCalls: 1 })
      .onConflictDoUpdate({
        target: [scanQuotaUsage.shopId, scanQuotaUsage.date],
        set: { visionCalls: sql`${scanQuotaUsage.visionCalls} + 1` },
      })
      .returning({ visionCalls: scanQuotaUsage.visionCalls });

    return row.visionCalls <= this.env.SCAN_DAILY_QUOTA_PER_SHOP;
  }

  private async shopCatalogue(tenant: TenantContext) {
    return tenant.db
      .select({ id: products.id, name: products.name, category: products.category })
      .from(products)
      .where(and(eq(products.shopId, tenant.shopId), isNull(products.deletedAt)))
      .limit(200);
  }

  /** The shortlist shown whenever recognition misses. Ordered by what this shop
   * actually sells, because the right answer is usually in the last ten items. */
  private async recentProducts(tenant: TenantContext, limit = 10) {
    const rows = await tenant.db
      .select({
        productId: saleItems.productId,
        name: products.name,
        lastSoldAt: sql<Date>`max(${sales.occurredAt})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(and(eq(saleItems.shopId, tenant.shopId), isNull(products.deletedAt)))
      .groupBy(saleItems.productId, products.name)
      .orderBy(desc(sql`max(${sales.occurredAt})`))
      .limit(limit);

    return rows
      .filter((row): row is typeof row & { productId: string } => Boolean(row.productId))
      .map((row) => ({ productId: row.productId, name: row.name, confidence: 0 }));
  }

  private async recordScan(
    tenant: TenantContext,
    input: {
      id: string;
      tier: 'barcode' | 'embedding' | 'vision' | 'manual';
      matchedProductId: string | null;
      confidence: number;
      latencyMs: number;
      costMicros: number;
      barcode?: string | null;
      imageHash?: string | null;
    },
  ) {
    await this.db
      .insert(scanEvents)
      .values({
        id: input.id,
        shopId: tenant.shopId,
        tier: input.tier,
        matchedProductId: input.matchedProductId,
        confidence: input.confidence,
        latencyMs: input.latencyMs,
        costMicros: input.costMicros,
        barcode: input.barcode ?? null,
        imageHash: input.imageHash ?? null,
      })
      .onConflictDoNothing();
  }

  /**
   * Resolves a scan that was captured while the device was offline and links the
   * result back onto the specific sale line logged without a product.
   *
   * The line is named explicitly rather than inferred from "unlinked lines in
   * this shop": a trader can have several unidentified items outstanding, and
   * attaching a resolution to the wrong one would silently misattribute both the
   * stock movement and the margin.
   */
  async resolveQueued(
    tenant: TenantContext,
    input: { scanEventId: string; saleItemId: string } & ScanMatchRequest,
  ): Promise<ScanMatchResponse> {
    const response = await this.match(tenant, { ...input, scanEventId: input.scanEventId });

    if (!response.matchedProductId) return response;

    await withTenantTransaction(this.db, tenant, async (tx) => {
      const [line] = await tx
        .update(saleItems)
        .set({ productId: response.matchedProductId })
        .where(
          and(
            eq(saleItems.shopId, tenant.shopId),
            eq(saleItems.id, input.saleItemId),
            // Only ever fills a gap; never re-points a line the trader already
            // attributed to a product.
            isNull(saleItems.productId),
          ),
        )
        .returning();

      if (!line) return;

      // The original sale decremented nothing for this line, because it named no
      // product. Now that it does, the stock it consumed has to be recorded.
      const seq = await nextSeq(tx, tenant.shopId);

      await tx.insert(stockMovements).values({
        id: newId(),
        shopId: tenant.shopId,
        productId: response.matchedProductId!,
        delta: -line.quantity,
        reason: 'sale',
        unitCostMinor: line.unitCostMinor,
        saleId: line.saleId,
        occurredAt: new Date(),
        serverSeq: seq,
        updatedByDeviceId: tenant.deviceId,
      });

      await rebuildProductStock(tx, tenant.shopId, response.matchedProductId!);

      await tx
        .update(scanEvents)
        .set({ resolvedLater: new Date() })
        .where(and(eq(scanEvents.shopId, tenant.shopId), eq(scanEvents.id, input.scanEventId)));
    });

    return response;
  }

  /**
   * Stores a reference embedding computed on the device.
   *
   * The vector is produced by the device rather than the server so that query
   * and reference always come from the identical model export. A server-side
   * encoder that drifted from the client's would still return plausible cosine
   * scores — just wrong ones — which is the kind of failure that is very hard to
   * notice and very easy to avoid by construction.
   */
  async enrolEmbedding(tenant: TenantContext, productId: string, vector: number[]) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw AppError.badRequest(
        `Embedding must have exactly ${EMBEDDING_DIMENSIONS} dimensions, received ${vector.length}`,
      );
    }

    const [product] = await tenant.db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.shopId, tenant.shopId),
          eq(products.id, productId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);

    if (!product) throw AppError.notFound('Product');

    await this.db
      .insert(productEmbeddings)
      .values({ shopId: tenant.shopId, productId, embedding: vector })
      .onConflictDoUpdate({
        target: [productEmbeddings.shopId, productEmbeddings.productId],
        set: { embedding: vector, updatedAt: new Date() },
      });
  }

  /** Reference vectors a device downloads so it can match locally and offline. */
  async listEmbeddings(tenant: TenantContext) {
    const rows = await tenant.db
      .select({
        productId: productEmbeddings.productId,
        embedding: productEmbeddings.embedding,
        updatedAt: productEmbeddings.updatedAt,
      })
      .from(productEmbeddings)
      .where(eq(productEmbeddings.shopId, tenant.shopId));

    return rows.map((row) => ({
      productId: row.productId,
      vector: row.embedding as number[],
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /** Cascade economics: the share of scans still reaching the paid tier. If this
   * is not falling over time, enrolment is not working. */
  async telemetry(tenant: TenantContext) {
    const rows = await tenant.db
      .select({
        tier: scanEvents.tier,
        count: sql<number>`count(*)::int`,
        costMicros: sql<number>`coalesce(sum(${scanEvents.costMicros}), 0)::int`,
      })
      .from(scanEvents)
      .where(eq(scanEvents.shopId, tenant.shopId))
      .groupBy(scanEvents.tier);

    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const vision = rows.find((row) => row.tier === 'vision');

    return {
      total,
      byTier: rows,
      paidTierShare: total ? (vision?.count ?? 0) / total : 0,
      totalCostMicros: rows.reduce((sum, row) => sum + row.costMicros, 0),
    };
  }

  private respond(
    scanEventId: string,
    tier: 'barcode' | 'embedding' | 'vision' | 'manual',
    matchedProductId: string | null,
    confidence: number,
    candidates: { productId: string; name: string; confidence: number }[],
    suggestion: { name: string | null; category: string | null; barcode: string | null } | null,
    quotaExceeded: boolean,
  ): ScanMatchResponse {
    return {
      scanEventId,
      tier,
      matchedProductId,
      confidence,
      candidates,
      suggestion,
      quotaExceeded,
    };
  }
}

export { AppError };
