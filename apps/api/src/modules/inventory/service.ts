import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type {
  Adjustment,
  ReconciliationCount,
  ReconciliationResult,
  Restock,
} from '@dwaso/shared-types';
import { reconciliationDelta, shrinkageValueMinor } from '@dwaso/domain';
import type { Database } from '../../db/client.js';
import { AppError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { nextSeq, withTenantTransaction, type TenantContext } from '../../lib/tenant.js';
import { productStock, products, stockMovements } from '../../db/schema/index.js';
import { applyStockDelta } from '../projections/service.js';
import * as catalogRepo from '../catalog/repo.js';

export class InventoryService {
  constructor(private readonly db: Database) {}

  async restock(tenant: TenantContext, input: Restock) {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const product = await catalogRepo.getProduct(scoped, input.productId);
      if (!product) throw AppError.notFound('Product');

      const seq = await nextSeq(tx, tenant.shopId);
      const movementId = input.id ?? newId();

      await tx.insert(stockMovements).values({
        id: movementId,
        shopId: tenant.shopId,
        productId: input.productId,
        delta: input.quantity,
        reason: 'restock',
        // The cost of *this* delivery, kept on the movement rather than written
        // back to the product: overwriting the product cost would rewrite the
        // margin on every sale already recorded at the old cost.
        unitCostMinor: input.unitCostMinor,
        supplierId: input.supplierId ?? null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        serverSeq: seq,
        updatedByDeviceId: tenant.deviceId,
      });

      const quantity = await applyStockDelta(tx, tenant.shopId, input.productId, input.quantity);

      return {
        movementId,
        productId: input.productId,
        quantity,
        // Surfaced so the client can prompt about a price rise rather than
        // letting margin quietly erode across restocks.
        costChanged: input.unitCostMinor !== product.costPriceMinor,
        previousCostMinor: product.costPriceMinor,
      };
    });
  }

  async adjust(tenant: TenantContext, input: Adjustment) {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const product = await catalogRepo.getProduct(scoped, input.productId);
      if (!product) throw AppError.notFound('Product');

      const seq = await nextSeq(tx, tenant.shopId);
      const movementId = input.id ?? newId();

      await tx.insert(stockMovements).values({
        id: movementId,
        shopId: tenant.shopId,
        productId: input.productId,
        delta: input.delta,
        reason: 'adjustment',
        note: input.note ?? null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        serverSeq: seq,
        updatedByDeviceId: tenant.deviceId,
      });

      const quantity = await applyStockDelta(tx, tenant.shopId, input.productId, input.delta);
      return { movementId, productId: input.productId, quantity };
    });
  }

  /**
   * A physical count. The trader reports what is on the shelf and the correction
   * is derived here, because asking someone to compute a delta at the end of a
   * market day is how counts stop happening.
   *
   * The resulting movement carries `reason = 'reconciliation'`, which means the
   * shrinkage report is a query over data that already exists rather than a
   * separate feature.
   */
  async reconcile(
    tenant: TenantContext,
    input: ReconciliationCount,
  ): Promise<ReconciliationResult> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const product = await catalogRepo.getProduct(scoped, input.productId);
      if (!product) throw AppError.notFound('Product');

      const expected = product.quantity;
      const delta = reconciliationDelta(expected, input.countedQuantity);

      if (delta !== 0) {
        const seq = await nextSeq(tx, tenant.shopId);

        await tx.insert(stockMovements).values({
          id: input.id ?? newId(),
          shopId: tenant.shopId,
          productId: input.productId,
          delta,
          reason: 'reconciliation',
          unitCostMinor: product.costPriceMinor,
          note: input.note ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          serverSeq: seq,
          updatedByDeviceId: tenant.deviceId,
        });

        await applyStockDelta(tx, tenant.shopId, input.productId, delta);
      }

      return {
        productId: input.productId,
        productName: product.name,
        expected,
        counted: input.countedQuantity,
        delta,
        shrinkageValueMinor: shrinkageValueMinor(delta, product.costPriceMinor),
      };
    });
  }

  async listMovements(tenant: TenantContext, productId: string, limit = 50) {
    return tenant.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.shopId, tenant.shopId),
          eq(stockMovements.productId, productId),
          isNull(stockMovements.deletedAt),
        ),
      )
      .orderBy(desc(stockMovements.occurredAt))
      .limit(limit);
  }

  /**
   * Every physical count with the discrepancy it revealed.
   *
   * The expected figure has to be the running total *at the moment of the
   * count*, not the product's stock today — sales after the count would
   * otherwise make historical discrepancies drift every time the report is
   * opened. A window over the full movement history gives the balance as it
   * stood, so a count from three weeks ago still reads the way it did then.
   */
  async shrinkageReport(tenant: TenantContext, limit = 50) {
    const rows = await tenant.db.execute<{
      product_id: string;
      product_name: string;
      delta: number;
      unit_cost_minor: string | number | null;
      occurred_at: Date;
      balance_after: string | number;
    }>(sql`
      with movement_history as (
        select
          m.id,
          m.product_id,
          m.delta,
          m.reason,
          m.unit_cost_minor,
          m.occurred_at,
          sum(m.delta) over (
            partition by m.product_id
            order by m.occurred_at, m.id
            rows unbounded preceding
          ) as balance_after
        from stock_movements m
        where m.shop_id = ${tenant.shopId}
          and m.deleted_at is null
      )
      select
        h.product_id,
        p.name as product_name,
        h.delta,
        h.unit_cost_minor,
        h.occurred_at,
        h.balance_after
      from movement_history h
      join products p on p.id = h.product_id
      where h.reason = 'reconciliation'
      order by h.occurred_at desc
      limit ${limit}
    `);

    return rows.map((row) => {
      const counted = Number(row.balance_after);
      return {
        productId: row.product_id,
        productName: row.product_name,
        countedAt: new Date(row.occurred_at).toISOString(),
        expected: counted - row.delta,
        counted,
        delta: row.delta,
        valueMinor: shrinkageValueMinor(row.delta, Number(row.unit_cost_minor ?? 0)),
      };
    });
  }
}
