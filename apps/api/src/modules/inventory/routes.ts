import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AdjustmentSchema,
  ReconciliationCountSchema,
  ReconciliationResultSchema,
  RestockSchema,
  ShrinkageReportEntrySchema,
  StockMovementSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { InventoryService } from './service.js';

const StockResultSchema = z.object({
  movementId: z.uuid(),
  productId: z.uuid(),
  quantity: z.number().int(),
  costChanged: z.boolean().optional(),
  previousCostMinor: z.number().int().optional(),
});

export async function inventoryRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new InventoryService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.post(
    '/restock',
    { schema: { body: RestockSchema, response: { 201: StockResultSchema } } },
    async (request, reply) => {
      const result = await service.restock(requireTenant(request.tenant), request.body);
      return reply.status(201).send(result);
    },
  );

  routes.post(
    '/adjust',
    { schema: { body: AdjustmentSchema, response: { 201: StockResultSchema } } },
    async (request, reply) => {
      const result = await service.adjust(requireTenant(request.tenant), request.body);
      return reply.status(201).send(result);
    },
  );

  routes.post(
    '/reconcile',
    { schema: { body: ReconciliationCountSchema, response: { 201: ReconciliationResultSchema } } },
    async (request, reply) => {
      const result = await service.reconcile(requireTenant(request.tenant), request.body);
      return reply.status(201).send(result);
    },
  );

  routes.get(
    '/movements/:productId',
    {
      schema: {
        params: z.object({ productId: z.uuid() }),
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
        response: { 200: z.array(StockMovementSchema) },
      },
    },
    async (request) => {
      const rows = await service.listMovements(
        requireTenant(request.tenant),
        request.params.productId,
        request.query.limit,
      );
      return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
    },
  );

  routes.get(
    '/shrinkage',
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
        response: { 200: z.array(ShrinkageReportEntrySchema) },
      },
    },
    async (request) => service.shrinkageReport(requireTenant(request.tenant), request.query.limit),
  );
}
