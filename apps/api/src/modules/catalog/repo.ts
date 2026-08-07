import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import type { ProductView } from '@dwaso/shared-types';
import { marginMinor, marginPercent, productStatus } from '@dwaso/domain';
import type { TenantContext } from '../../lib/tenant.js';
import { priceChanges, productStock, products } from '../../db/schema/index.js';

/**
 * Every function here takes a TenantContext as its first argument. That is the
 * only way to reach the database from a module, so a query that forgets its shop
 * filter does not compile rather than quietly returning another trader's stock.
 */

type ProductRow = typeof products.$inferSelect;

function toView(row: ProductRow, quantity: number): ProductView {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sku: row.sku,
    unit: row.unit,
    costPriceMinor: row.costPriceMinor,
    sellPriceMinor: row.sellPriceMinor,
    lowStockThreshold: row.lowStockThreshold,
    isLooseGood: row.isLooseGood,
    defaultSupplierId: row.defaultSupplierId,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
    serverSeq: row.serverSeq,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    updatedByDeviceId: row.updatedByDeviceId,
    quantity,
    status: productStatus(quantity, row.lowStockThreshold),
    marginMinor: marginMinor(row.sellPriceMinor, row.costPriceMinor),
    marginPercent: marginPercent(row.sellPriceMinor, row.costPriceMinor),
  };
}

export type ProductFilter = {
  search?: string;
  status?: 'all' | 'in-stock' | 'low' | 'out-of-stock';
  limit: number;
  offset: number;
};

export async function listProducts(
  tenant: TenantContext,
  filter: ProductFilter,
): Promise<ProductView[]> {
  const conditions = [eq(products.shopId, tenant.shopId), isNull(products.deletedAt)];

  if (filter.search) {
    conditions.push(ilike(products.name, `%${filter.search}%`));
  }

  // Left join so a product with no movements yet still appears, at zero.
  const rows = await tenant.db
    .select({
      product: products,
      quantity: sql<number>`coalesce(${productStock.quantity}, 0)::int`,
    })
    .from(products)
    .leftJoin(
      productStock,
      and(eq(productStock.productId, products.id), eq(productStock.shopId, tenant.shopId)),
    )
    .where(and(...conditions))
    .orderBy(products.name)
    .limit(filter.limit)
    .offset(filter.offset);

  const views = rows.map((row) => toView(row.product, row.quantity));

  // Status is derived from a projection and a per-product threshold, so it is
  // filtered here rather than in SQL where the two would have to be duplicated.
  if (!filter.status || filter.status === 'all') return views;
  return views.filter((view) => view.status === filter.status);
}

export async function getProduct(
  tenant: TenantContext,
  productId: string,
): Promise<ProductView | null> {
  const [row] = await tenant.db
    .select({
      product: products,
      quantity: sql<number>`coalesce(${productStock.quantity}, 0)::int`,
    })
    .from(products)
    .leftJoin(
      productStock,
      and(eq(productStock.productId, products.id), eq(productStock.shopId, tenant.shopId)),
    )
    .where(
      and(
        eq(products.shopId, tenant.shopId),
        eq(products.id, productId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);

  return row ? toView(row.product, row.quantity) : null;
}

export async function findProductBySku(tenant: TenantContext, sku: string) {
  const [row] = await tenant.db
    .select()
    .from(products)
    .where(
      and(eq(products.shopId, tenant.shopId), eq(products.sku, sku), isNull(products.deletedAt)),
    )
    .limit(1);
  return row ?? null;
}

export async function insertProduct(
  tenant: TenantContext,
  values: typeof products.$inferInsert,
): Promise<ProductRow> {
  const [row] = await tenant.db.insert(products).values(values).returning();
  return row;
}

export async function updateProduct(
  tenant: TenantContext,
  productId: string,
  values: Partial<typeof products.$inferInsert>,
): Promise<ProductRow | null> {
  const [row] = await tenant.db
    .update(products)
    .set(values)
    .where(
      and(
        eq(products.shopId, tenant.shopId),
        eq(products.id, productId),
        isNull(products.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listPriceHistory(tenant: TenantContext, productId: string, limit = 30) {
  return tenant.db
    .select()
    .from(priceChanges)
    .where(
      and(
        eq(priceChanges.shopId, tenant.shopId),
        eq(priceChanges.productId, productId),
        isNull(priceChanges.deletedAt),
      ),
    )
    .orderBy(desc(priceChanges.occurredAt))
    .limit(limit);
}

export async function insertPriceChange(
  tenant: TenantContext,
  values: typeof priceChanges.$inferInsert,
) {
  const [row] = await tenant.db.insert(priceChanges).values(values).returning();
  return row;
}

export async function countLowStock(tenant: TenantContext) {
  const rows = await tenant.db
    .select({ name: products.name })
    .from(products)
    .leftJoin(
      productStock,
      and(eq(productStock.productId, products.id), eq(productStock.shopId, tenant.shopId)),
    )
    .where(
      and(
        eq(products.shopId, tenant.shopId),
        isNull(products.deletedAt),
        sql`coalesce(${productStock.quantity}, 0) <= ${products.lowStockThreshold}`,
      ),
    )
    .orderBy(products.name);

  return rows.map((row) => row.name);
}
