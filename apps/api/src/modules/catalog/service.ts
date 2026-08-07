import type { CreateProduct, ProductView, UpdatePrice, UpdateProduct } from '@dwaso/shared-types';
import type { Database } from '../../db/client.js';
import { recordAudit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import {
  nextSeq,
  reserveSeqBlock,
  withTenantTransaction,
  type TenantContext,
} from '../../lib/tenant.js';
import { applyStockDelta } from '../projections/service.js';
import { products, stockMovements } from '../../db/schema/index.js';
import * as repo from './repo.js';

export class CatalogService {
  constructor(private readonly db: Database) {}

  async list(tenant: TenantContext, filter: repo.ProductFilter) {
    return repo.listProducts(tenant, filter);
  }

  async get(tenant: TenantContext, productId: string): Promise<ProductView> {
    const product = await repo.getProduct(tenant, productId);
    if (!product) throw AppError.notFound('Product');
    return product;
  }

  /**
   * Creating a product with an opening quantity writes a movement rather than
   * setting a counter, so the very first number in a shop's history is already
   * part of the audit trail and folds like every later one.
   */
  async create(
    tenant: TenantContext,
    input: CreateProduct & { openingQuantity?: number },
  ): Promise<ProductView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      if (input.sku) {
        const clash = await repo.findProductBySku(scoped, input.sku);
        if (clash) throw AppError.conflict(`SKU ${input.sku} is already used by another product`);
      }

      const opening = input.openingQuantity ?? 0;
      const seqCount = opening !== 0 ? 2 : 1;
      const firstSeq = await reserveSeqBlock(tx, tenant.shopId, seqCount);

      const productId = input.id ?? newId();

      await repo.insertProduct(scoped, {
        id: productId,
        shopId: tenant.shopId,
        name: input.name,
        category: input.category ?? null,
        sku: input.sku ?? null,
        unit: input.unit ?? 'unit',
        costPriceMinor: input.costPriceMinor,
        sellPriceMinor: input.sellPriceMinor,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        isLooseGood: input.isLooseGood ?? false,
        defaultSupplierId: input.defaultSupplierId ?? null,
        imageUrl: input.imageUrl ?? null,
        serverSeq: firstSeq,
        updatedByDeviceId: tenant.deviceId,
      });

      if (opening !== 0) {
        await tx.insert(stockMovements).values({
          id: newId(),
          shopId: tenant.shopId,
          productId,
          delta: opening,
          reason: 'opening_balance',
          unitCostMinor: input.costPriceMinor,
          occurredAt: new Date(),
          serverSeq: firstSeq + 1,
          updatedByDeviceId: tenant.deviceId,
        });

        await applyStockDelta(tx, tenant.shopId, productId, opening);
      }

      const created = await repo.getProduct(scoped, productId);
      if (!created) throw AppError.notFound('Product');
      return created;
    });
  }

  async update(
    tenant: TenantContext,
    productId: string,
    input: UpdateProduct,
  ): Promise<ProductView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const seq = await nextSeq(tx, tenant.shopId);

      const updated = await repo.updateProduct(scoped, productId, {
        ...input,
        serverSeq: seq,
        updatedAt: new Date(),
        updatedByDeviceId: tenant.deviceId,
      });

      if (!updated) throw AppError.notFound('Product');

      const view = await repo.getProduct(scoped, productId);
      if (!view) throw AppError.notFound('Product');
      return view;
    });
  }

  /**
   * Price edits append a `price_changes` event alongside the update. Without the
   * event the product screen's price history would be a straight line and the
   * margin on past sales would silently follow the new price.
   */
  async updatePrice(
    tenant: TenantContext,
    productId: string,
    input: UpdatePrice,
  ): Promise<ProductView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const current = await repo.getProduct(scoped, productId);
      if (!current) throw AppError.notFound('Product');

      const nextCost = input.costPriceMinor ?? current.costPriceMinor;
      const nextSell = input.sellPriceMinor ?? current.sellPriceMinor;

      if (nextCost === current.costPriceMinor && nextSell === current.sellPriceMinor) {
        return current;
      }

      const firstSeq = await reserveSeqBlock(tx, tenant.shopId, 2);

      await repo.updateProduct(scoped, productId, {
        costPriceMinor: nextCost,
        sellPriceMinor: nextSell,
        serverSeq: firstSeq,
        updatedAt: new Date(),
        updatedByDeviceId: tenant.deviceId,
      });

      await repo.insertPriceChange(scoped, {
        id: newId(),
        shopId: tenant.shopId,
        productId,
        fromCostMinor: current.costPriceMinor,
        toCostMinor: nextCost,
        fromSellMinor: current.sellPriceMinor,
        toSellMinor: nextSell,
        occurredAt: new Date(),
        serverSeq: firstSeq + 1,
        updatedByDeviceId: tenant.deviceId,
      });

      await recordAudit(tx, tenant, {
        action: 'price.changed',
        entity: 'product',
        entityId: productId,
        metadata: {
          fromCostMinor: current.costPriceMinor,
          toCostMinor: nextCost,
          fromSellMinor: current.sellPriceMinor,
          toSellMinor: nextSell,
        },
      });

      const view = await repo.getProduct(scoped, productId);
      if (!view) throw AppError.notFound('Product');
      return view;
    });
  }

  /**
   * Soft delete only. A hard delete would orphan the sales and movements that
   * reference the product, and would leave offline devices unable to learn the
   * product is gone.
   */
  async remove(tenant: TenantContext, productId: string): Promise<void> {
    await withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const seq = await nextSeq(tx, tenant.shopId);

      const removed = await repo.updateProduct(scoped, productId, {
        deletedAt: new Date(),
        serverSeq: seq,
        updatedAt: new Date(),
        updatedByDeviceId: tenant.deviceId,
      });

      if (!removed) throw AppError.notFound('Product');
    });
  }

  async priceHistory(tenant: TenantContext, productId: string) {
    return repo.listPriceHistory(tenant, productId);
  }
}

export { products };
