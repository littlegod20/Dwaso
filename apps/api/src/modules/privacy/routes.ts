import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireTenant } from '../../lib/tenant.js';
import { AppError } from '../../lib/errors.js';
import { nextSeq, withTenantTransaction } from '../../lib/tenant.js';
import {
  auditLog,
  creditLedgerEntries,
  creditors,
  productBarcodes,
  products,
  saleItems,
  sales,
  shops,
  stockMovements,
  suppliers,
} from '../../db/schema/index.js';

/**
 * Data-protection endpoints.
 *
 * Under Ghana's Act 843 the trader is the data controller and Dwaso the
 * processor, and the most exposed records are the creditors — third parties who
 * never installed the app and never consented. These routes are what make the
 * trader's obligations to those people actionable rather than theoretical.
 */
export async function privacyRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.addHook('onRequest', app.authenticate);

  /** Full export of everything held for this shop, in one JSON document. */
  routes.get(
    '/export',
    { schema: { response: { 200: z.record(z.string(), z.unknown()) } } },
    async (request) => {
      const tenant = requireTenant(request.tenant);
      tenant.requireOwner('export shop data');

      const scoped = <T extends { shopId: unknown }>(table: T) => eq(table.shopId as never, tenant.shopId);

      const [shop, productRows, barcodeRows, movementRows, saleRows, saleItemRows, creditorRows, ledgerRows, supplierRows, auditRows] =
        await Promise.all([
          app.db.select().from(shops).where(eq(shops.id, tenant.shopId)),
          app.db.select().from(products).where(scoped(products)),
          app.db.select().from(productBarcodes).where(scoped(productBarcodes)),
          app.db.select().from(stockMovements).where(scoped(stockMovements)),
          app.db.select().from(sales).where(scoped(sales)),
          app.db.select().from(saleItems).where(scoped(saleItems)),
          app.db.select().from(creditors).where(scoped(creditors)),
          app.db.select().from(creditLedgerEntries).where(scoped(creditLedgerEntries)),
          app.db.select().from(suppliers).where(scoped(suppliers)),
          app.db.select().from(auditLog).where(scoped(auditLog)),
        ]);

      return {
        exportedAt: new Date().toISOString(),
        shop: shop[0] ?? null,
        products: productRows,
        productBarcodes: barcodeRows,
        stockMovements: movementRows,
        sales: saleRows,
        saleItems: saleItemRows,
        creditors: creditorRows,
        creditLedgerEntries: ledgerRows,
        suppliers: supplierRows,
        auditLog: auditRows,
      };
    },
  );

  /**
   * Erases one creditor's personal details while keeping the ledger.
   *
   * A subject-access erasure request cannot be allowed to delete the record of a
   * debt — that would let anyone wipe what they owe by invoking privacy law. The
   * resolution is to strip the identifying fields and keep the amounts, so the
   * trader's books stay intact and the person stops being identifiable.
   */
  routes.post(
    '/creditors/:id/erase',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: z.object({ erased: z.boolean(), ledgerEntriesRetained: z.number() }) },
      },
    },
    async (request) => {
      const tenant = requireTenant(request.tenant);
      tenant.requireOwner('erase customer details');

      return withTenantTransaction(app.db, tenant, async (tx) => {
        const seq = await nextSeq(tx, tenant.shopId);

        const [erased] = await tx
          .update(creditors)
          .set({
            name: 'Erased customer',
            phone: null,
            email: null,
            note: null,
            remindersOptedOut: true,
            serverSeq: seq,
            updatedAt: new Date(),
            updatedByDeviceId: tenant.deviceId,
          })
          .where(
            and(
              eq(creditors.shopId, tenant.shopId),
              eq(creditors.id, request.params.id),
              isNull(creditors.deletedAt),
            ),
          )
          .returning();

        if (!erased) throw AppError.notFound('Creditor');

        const retained = await tx
          .select({ id: creditLedgerEntries.id })
          .from(creditLedgerEntries)
          .where(
            and(
              eq(creditLedgerEntries.shopId, tenant.shopId),
              eq(creditLedgerEntries.creditorId, request.params.id),
            ),
          );

        await tx.insert(auditLog).values({
          shopId: tenant.shopId,
          userId: tenant.userId,
          deviceId: tenant.deviceId,
          action: 'creditor.erased',
          entity: 'creditor',
          entityId: request.params.id,
        });

        return { erased: true, ledgerEntriesRetained: retained.length };
      });
    },
  );

  /** Opt a customer out of every reminder channel. */
  routes.post(
    '/creditors/:id/opt-out',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const tenant = requireTenant(request.tenant);

      await withTenantTransaction(app.db, tenant, async (tx) => {
        const seq = await nextSeq(tx, tenant.shopId);

        const [row] = await tx
          .update(creditors)
          .set({
            remindersOptedOut: true,
            serverSeq: seq,
            updatedAt: new Date(),
            updatedByDeviceId: tenant.deviceId,
          })
          .where(
            and(
              eq(creditors.shopId, tenant.shopId),
              eq(creditors.id, request.params.id),
              isNull(creditors.deletedAt),
            ),
          )
          .returning();

        if (!row) throw AppError.notFound('Creditor');
      });

      return reply.status(204).send(null);
    },
  );

  /**
   * Deletes the shop and everything under it. Cascades handle the rest, which is
   * why every tenant table declares `on delete cascade` against `shops`.
   */
  routes.delete(
    '/shop',
    {
      schema: {
        body: z.object({ confirmName: z.string() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const tenant = requireTenant(request.tenant);
      tenant.requireOwner('delete the shop');

      const [shop] = await app.db.select().from(shops).where(eq(shops.id, tenant.shopId)).limit(1);
      if (!shop) throw AppError.notFound('Shop');

      // Typing the business name is the confirmation step: this destroys the
      // trader's entire ledger and cannot be undone.
      if (request.body.confirmName !== shop.name) {
        throw AppError.badRequest('Type the business name exactly to confirm deletion');
      }

      await app.db.delete(shops).where(eq(shops.id, tenant.shopId));
      return reply.status(204).send(null);
    },
  );
}
