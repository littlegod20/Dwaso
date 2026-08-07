import { and, eq, isNull } from 'drizzle-orm';
import type { CreateSupplier, NearbySupplierQuery, SupplierView } from '@dwaso/shared-types';
import type { Database } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import {
  nextSeq,
  withTenantScope,
  withTenantTransaction,
  type TenantContext,
} from '../../lib/tenant.js';
import { distanceKm, type SupplierDirectory } from '../../providers/places.js';
import { products, suppliers } from '../../db/schema/index.js';

/**
 * Places knows a shop exists and roughly what it sells. It does not know whether
 * that stall has this product in stock today, and presenting results as if it
 * did would send a trader across town for nothing.
 */
const DISCLAIMER =
  'These are nearby businesses that may carry this product. Dwaso cannot confirm current stock or prices — call ahead before travelling.';

type SupplierRow = typeof suppliers.$inferSelect;

export class SuppliersService {
  constructor(
    private readonly db: Database,
    private readonly directory: SupplierDirectory,
  ) {}

  async list(tenant: TenantContext): Promise<SupplierView[]> {
    return withTenantScope(this.db, tenant, async (scoped) => {
      const rows = await scoped.db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.shopId, tenant.shopId), isNull(suppliers.deletedAt)))
        .orderBy(suppliers.name);

      return rows.map((row) => toView(row, null));
    });
  }

  /**
   * Merges saved suppliers with live directory results, saved ones first: a
   * trader's own relationships are more useful than anything a map can suggest,
   * and this is also what makes the Phase 3 marketplace a drop-in replacement
   * for the directory half rather than a new screen.
   */
  async nearby(tenant: TenantContext, query: NearbySupplierQuery) {
    const keyword = query.productId
      ? await this.productKeyword(tenant, query.productId)
      : undefined;

    const saved = await this.list(tenant);
    const savedIds = new Set(saved.map((supplier) => supplier.externalId).filter(Boolean));

    const discovered = await this.directory.search({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusMeters: query.radiusMeters,
      keyword,
      category: query.category,
      limit: query.limit,
    });

    const withDistance = (latitude: number | null, longitude: number | null): number | null =>
      latitude !== null && longitude !== null
        ? distanceKm(query.latitude, query.longitude, latitude, longitude)
        : null;

    const savedNearby = saved
      .map((supplier) => ({
        ...supplier,
        distanceKm: withDistance(supplier.latitude, supplier.longitude),
      }))
      .filter(
        (supplier) =>
          supplier.distanceKm === null || supplier.distanceKm * 1000 <= query.radiusMeters,
      );

    const now = new Date().toISOString();

    const directoryResults: SupplierView[] = discovered
      .filter((result) => !savedIds.has(result.externalId))
      .map((result) => ({
        // Not yet persisted: an id is minted so the client can key the list, and
        // the row is only written if the trader saves it.
        id: newId(),
        name: result.name,
        phone: result.phone,
        category: result.category,
        address: result.address,
        latitude: result.latitude,
        longitude: result.longitude,
        source: 'google_places' as const,
        externalId: result.externalId,
        createdAt: now,
        serverSeq: 0,
        updatedAt: now,
        deletedAt: null,
        updatedByDeviceId: null,
        distanceKm: withDistance(result.latitude, result.longitude),
      }));

    const all = [...savedNearby, ...directoryResults].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );

    return { suppliers: all.slice(0, query.limit), disclaimer: DISCLAIMER };
  }

  async save(tenant: TenantContext, input: CreateSupplier): Promise<SupplierView> {
    return withTenantTransaction(this.db, tenant, async (tx) => {
      const seq = await nextSeq(tx, tenant.shopId);

      const [row] = await tx
        .insert(suppliers)
        .values({
          id: input.id ?? newId(),
          shopId: tenant.shopId,
          name: input.name,
          phone: input.phone ?? null,
          category: input.category ?? null,
          address: input.address ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          source: input.source ?? 'manual',
          externalId: input.externalId ?? null,
          serverSeq: seq,
          updatedByDeviceId: tenant.deviceId,
        })
        .onConflictDoUpdate({
          target: suppliers.id,
          set: {
            name: input.name,
            phone: input.phone ?? null,
            serverSeq: seq,
            updatedAt: new Date(),
            updatedByDeviceId: tenant.deviceId,
          },
        })
        .returning();

      return toView(row, null);
    });
  }

  async remove(tenant: TenantContext, supplierId: string) {
    await withTenantTransaction(this.db, tenant, async (tx) => {
      const seq = await nextSeq(tx, tenant.shopId);

      const [row] = await tx
        .update(suppliers)
        .set({
          deletedAt: new Date(),
          serverSeq: seq,
          updatedAt: new Date(),
          updatedByDeviceId: tenant.deviceId,
        })
        .where(
          and(
            eq(suppliers.shopId, tenant.shopId),
            eq(suppliers.id, supplierId),
            isNull(suppliers.deletedAt),
          ),
        )
        .returning();

      if (!row) throw AppError.notFound('Supplier');
    });
  }

  private async productKeyword(tenant: TenantContext, productId: string) {
    const [product] = await tenant.db
      .select({ name: products.name, category: products.category })
      .from(products)
      .where(and(eq(products.shopId, tenant.shopId), eq(products.id, productId)))
      .limit(1);

    return product ? [product.category, product.name].filter(Boolean).join(' ') : undefined;
  }
}

function toView(row: SupplierRow, distance: number | null): SupplierView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    category: row.category,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    source: row.source,
    externalId: row.externalId,
    createdAt: row.createdAt.toISOString(),
    serverSeq: row.serverSeq,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    updatedByDeviceId: row.updatedByDeviceId,
    distanceKm: distance,
  };
}
