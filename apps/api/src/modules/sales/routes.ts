import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { QuickSaleSchema, RecordSaleSchema, SaleViewSchema } from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { SalesService } from './service.js';

export async function salesRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new SalesService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.post(
    '/',
    { schema: { body: RecordSaleSchema, response: { 201: SaleViewSchema } } },
    async (request, reply) => {
      const sale = await service.record(requireTenant(request.tenant), request.body);
      return reply.status(201).send(sale);
    },
  );

  routes.post(
    '/quick',
    { schema: { body: QuickSaleSchema, response: { 201: SaleViewSchema } } },
    async (request, reply) => {
      const sale = await service.quickSale(requireTenant(request.tenant), request.body);
      return reply.status(201).send(sale);
    },
  );

  routes.get(
    '/',
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }),
        response: { 200: z.array(SaleViewSchema) },
      },
    },
    async (request) => service.list(requireTenant(request.tenant), request.query.limit),
  );

  routes.get(
    '/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: SaleViewSchema } } },
    async (request) => service.get(requireTenant(request.tenant), request.params.id),
  );
}
