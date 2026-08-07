import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateProductSchema,
  PriceChangeSchema,
  ProductViewSchema,
  UpdatePriceSchema,
  UpdateProductSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { CatalogService } from './service.js';

const ProductParams = z.object({ id: z.uuid() });

const ListQuery = z.object({
  search: z.string().max(120).optional(),
  status: z.enum(['all', 'in-stock', 'low', 'out-of-stock']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function catalogRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new CatalogService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.get(
    '/',
    { schema: { querystring: ListQuery, response: { 200: z.array(ProductViewSchema) } } },
    async (request) => service.list(requireTenant(request.tenant), request.query),
  );

  routes.post(
    '/',
    {
      schema: {
        body: CreateProductSchema.extend({
          openingQuantity: z.number().int().nonnegative().optional(),
        }),
        response: { 201: ProductViewSchema },
      },
    },
    async (request, reply) => {
      const product = await service.create(requireTenant(request.tenant), request.body);
      return reply.status(201).send(product);
    },
  );

  routes.get(
    '/:id',
    { schema: { params: ProductParams, response: { 200: ProductViewSchema } } },
    async (request) => service.get(requireTenant(request.tenant), request.params.id),
  );

  routes.patch(
    '/:id',
    {
      schema: {
        params: ProductParams,
        body: UpdateProductSchema,
        response: { 200: ProductViewSchema },
      },
    },
    async (request) =>
      service.update(requireTenant(request.tenant), request.params.id, request.body),
  );

  routes.put(
    '/:id/price',
    {
      schema: {
        params: ProductParams,
        body: UpdatePriceSchema,
        response: { 200: ProductViewSchema },
      },
    },
    async (request) =>
      service.updatePrice(requireTenant(request.tenant), request.params.id, request.body),
  );

  routes.get(
    '/:id/price-history',
    { schema: { params: ProductParams, response: { 200: z.array(PriceChangeSchema) } } },
    async (request) => {
      const rows = await service.priceHistory(requireTenant(request.tenant), request.params.id);
      return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
    },
  );

  routes.delete(
    '/:id',
    { schema: { params: ProductParams, response: { 204: z.null() } } },
    async (request, reply) => {
      await service.remove(requireTenant(request.tenant), request.params.id);
      return reply.status(204).send(null);
    },
  );
}
