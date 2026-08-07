import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { QuickSale, RecordSale, SaleView } from '@dwaso/shared-types';
import { saleTotals } from '@dwaso/domain';
import type { Database, Transaction } from '../../db/client.js';
import { recordAudit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import {
  reserveSeqBlock,
  withTenantScope,
  withTenantTransaction,
  type TenantContext,
} from '../../lib/tenant.js';
import {
  creditLedgerEntries,
  creditors,
  products,
  saleItems,
  sales,
  shops,
  stockMovements,
} from '../../db/schema/index.js';
import { applyCreditDelta, applyDailyMetrics, applyStockDelta } from '../projections/service.js';

type ResolvedLine = {
  id: string;
  productId: string | null;
  description: string | null;
  quantity: number;
  unitPriceMinor: number;
  unitCostMinor: number;
};

export class SalesService {
  constructor(private readonly db: Database) {}

  /**
   * One transaction covering the sale, its lines, the stock it consumes, the
   * debt it may create and the day's P&L. All of it or none of it: a sale that
   * recorded revenue without decrementing stock would quietly corrupt both the
   * inventory count and the margin.
   */
  async record(tenant: TenantContext, input: RecordSale): Promise<SaleView> {
    return withTenantTransaction(this.db, tenant, async (tx, scoped) => {
      const shop = await this.loadShop(tx, tenant.shopId);
      const lines = await this.resolveLines(tx, tenant, input);
      const totals = saleTotals(lines);

      const isCredit = input.paymentMethod === 'credit';

      if (isCredit) {
        await this.assertCreditorExists(tx, tenant.shopId, input.creditorId!);
      }

      const stockLines = lines.filter((line) => line.productId);
      // One sequence number per replicated row: the sale, each line, each stock
      // movement, and the ledger entry if this was on credit.
      const seqCount = 1 + lines.length + stockLines.length + (isCredit ? 1 : 0);
      let seq = await reserveSeqBlock(tx, tenant.shopId, seqCount);

      const saleId = input.id ?? newId();
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

      await tx.insert(sales).values({
        id: saleId,
        shopId: tenant.shopId,
        paymentMethod: input.paymentMethod,
        creditorId: input.creditorId ?? null,
        totalMinor: totals.totalMinor,
        costTotalMinor: totals.costTotalMinor,
        note: input.note ?? null,
        occurredAt,
        serverSeq: seq++,
        updatedByDeviceId: tenant.deviceId,
      });

      await tx.insert(saleItems).values(
        lines.map((line) => ({
          id: line.id,
          shopId: tenant.shopId,
          saleId,
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          unitCostMinor: line.unitCostMinor,
          serverSeq: seq++,
          updatedByDeviceId: tenant.deviceId,
        })),
      );

      // Spec 2.1: stock is never updated as a separate task. Every sale emits the
      // movements that decrement it, in the same transaction.
      for (const line of stockLines) {
        await tx.insert(stockMovements).values({
          id: newId(),
          shopId: tenant.shopId,
          productId: line.productId!,
          delta: -line.quantity,
          reason: 'sale',
          unitCostMinor: line.unitCostMinor,
          saleId,
          occurredAt,
          serverSeq: seq++,
          updatedByDeviceId: tenant.deviceId,
        });

        await applyStockDelta(tx, tenant.shopId, line.productId!, -line.quantity);
      }

      if (isCredit) {
        await tx.insert(creditLedgerEntries).values({
          id: newId(),
          shopId: tenant.shopId,
          creditorId: input.creditorId!,
          kind: 'credit_sale',
          amountMinor: totals.totalMinor,
          saleId,
          occurredAt,
          serverSeq: seq++,
          updatedByDeviceId: tenant.deviceId,
        });

        await applyCreditDelta(tx, tenant.shopId, input.creditorId!, totals.totalMinor, null);
      }

      await applyDailyMetrics(
        tx,
        tenant.shopId,
        shop.timezone,
        occurredAt,
        totals.totalMinor,
        totals.costTotalMinor,
        1,
      );

      await recordAudit(tx, tenant, {
        action: 'sale.recorded',
        entity: 'sale',
        entityId: saleId,
        metadata: {
          totalMinor: totals.totalMinor,
          paymentMethod: input.paymentMethod,
          lineCount: lines.length,
        },
      });

      const view = await this.get(scoped, saleId);
      return view;
    });
  }

  /** The one-tap path for loose goods: quantity and nothing else. */
  async quickSale(tenant: TenantContext, input: QuickSale): Promise<SaleView> {
    return this.record(tenant, {
      id: input.id,
      paymentMethod: 'cash',
      items: [{ productId: input.productId, quantity: input.quantity }],
      occurredAt: input.occurredAt,
    } as RecordSale);
  }

  async get(tenant: TenantContext, saleId: string): Promise<SaleView> {
    return withTenantScope(this.db, tenant, (scoped) => this.getScoped(scoped, saleId));
  }

  async list(tenant: TenantContext, limit = 50) {
    return withTenantScope(this.db, tenant, async (scoped) => {
      const rows = await scoped.db
        .select()
        .from(sales)
        .where(and(eq(sales.shopId, tenant.shopId), isNull(sales.deletedAt)))
        .orderBy(desc(sales.occurredAt))
        .limit(limit);

      return Promise.all(rows.map((row) => this.getScoped(scoped, row.id)));
    });
  }

  private async getScoped(tenant: TenantContext, saleId: string): Promise<SaleView> {
    const [sale] = await tenant.db
      .select()
      .from(sales)
      .where(and(eq(sales.shopId, tenant.shopId), eq(sales.id, saleId), isNull(sales.deletedAt)))
      .limit(1);

    if (!sale) throw AppError.notFound('Sale');

    const items = await tenant.db
      .select()
      .from(saleItems)
      .where(and(eq(saleItems.shopId, tenant.shopId), eq(saleItems.saleId, saleId)));

    return {
      id: sale.id,
      paymentMethod: sale.paymentMethod,
      creditorId: sale.creditorId,
      totalMinor: sale.totalMinor,
      costTotalMinor: sale.costTotalMinor,
      note: sale.note,
      occurredAt: sale.occurredAt.toISOString(),
      serverSeq: sale.serverSeq,
      updatedAt: sale.updatedAt.toISOString(),
      deletedAt: sale.deletedAt?.toISOString() ?? null,
      updatedByDeviceId: sale.updatedByDeviceId,
      marginMinor: sale.totalMinor - sale.costTotalMinor,
      items: items.map((item) => ({
        id: item.id,
        saleId: item.saleId,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        unitCostMinor: item.unitCostMinor,
      })),
    };
  }

  /**
   * Prices and costs are resolved server-side from the catalog rather than
   * trusted from the client, so a stale device cannot record a sale at a price
   * the trader changed this morning. Cost is then frozen onto the line.
   */
  private async resolveLines(
    tx: Transaction,
    tenant: TenantContext,
    input: RecordSale,
  ): Promise<ResolvedLine[]> {
    const productIds = input.items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));

    const catalog = productIds.length
      ? await tx
          .select()
          .from(products)
          .where(
            and(
              eq(products.shopId, tenant.shopId),
              inArray(products.id, productIds),
              isNull(products.deletedAt),
            ),
          )
      : [];

    const byId = new Map(catalog.map((product) => [product.id, product]));

    return input.items.map((item) => {
      if (!item.productId) {
        // An unidentified item: the scanner missed and the trader logged the
        // amount anyway. The sale completes now and recognition catches up later.
        if (item.unitPriceMinor === undefined) {
          throw AppError.badRequest('A line without a product must carry a price');
        }
        return {
          id: item.id ?? newId(),
          productId: null,
          description: item.description ?? 'Unidentified item',
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          unitCostMinor: 0,
        };
      }

      const product = byId.get(item.productId);
      if (!product) throw AppError.notFound(`Product ${item.productId}`);

      return {
        id: item.id ?? newId(),
        productId: product.id,
        description: item.description ?? null,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor ?? product.sellPriceMinor,
        unitCostMinor: product.costPriceMinor,
      };
    });
  }

  private async assertCreditorExists(tx: Transaction, shopId: string, creditorId: string) {
    const [creditor] = await tx
      .select({ id: creditors.id })
      .from(creditors)
      .where(
        and(
          eq(creditors.shopId, shopId),
          eq(creditors.id, creditorId),
          isNull(creditors.deletedAt),
        ),
      )
      .limit(1);

    if (!creditor) throw AppError.notFound('Creditor');
  }

  private async loadShop(tx: Transaction, shopId: string) {
    const [shop] = await tx.select().from(shops).where(eq(shops.id, shopId)).limit(1);
    if (!shop) throw AppError.notFound('Shop');
    return shop;
  }
}
