import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateSupplierSchema,
  NearbySupplierQuerySchema,
  NearbySupplierResultSchema,
  SupplierViewSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { SuppliersService } from './service.js';
import { createSupplierDirectory } from '../../providers/places.js';

export async function supplierRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new SuppliersService(app.db, createSupplierDirectory(app.env, app.redis));

  routes.addHook('onRequest', app.authenticate);

  routes.get(
    '/',
    { schema: { response: { 200: z.array(SupplierViewSchema) } } },
    async (request) => service.list(requireTenant(request.tenant)),
  );

  routes.get(
    '/nearby',
    {
      schema: {
        querystring: NearbySupplierQuerySchema,
        response: { 200: NearbySupplierResultSchema },
      },
      // The Places key is proxied here so it never reaches a device; the cache
      // absorbs repeat searches from the same stall, and this limit covers the
      // rest.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request) => service.nearby(requireTenant(request.tenant), request.query),
  );

  routes.post(
    '/',
    { schema: { body: CreateSupplierSchema, response: { 201: SupplierViewSchema } } },
    async (request, reply) => {
      const supplier = await service.save(requireTenant(request.tenant), request.body);
      return reply.status(201).send(supplier);
    },
  );

  routes.delete(
    '/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      await service.remove(requireTenant(request.tenant), request.params.id);
      return reply.status(204).send(null);
    },
  );
}
