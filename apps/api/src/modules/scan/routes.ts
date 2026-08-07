import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  BarcodeCatalogEntrySchema,
  EMBEDDING_DIMENSIONS,
  ProductEmbeddingSchema,
  ScanMatchRequestSchema,
  ScanMatchResponseSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { ScanService } from './service.js';
import { createVisionProvider } from '../../providers/vision.js';
import { createObjectStorage } from '../../providers/storage.js';

export async function scanRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new ScanService(
    app.db,
    createVisionProvider(app.env),
    createObjectStorage(app.env),
    app.env,
  );

  routes.addHook('onRequest', app.authenticate);

  routes.post(
    '/match',
    {
      schema: { body: ScanMatchRequestSchema, response: { 200: ScanMatchResponseSchema } },
      config: {
        // Much tighter than other routes because this one bills per call. The
        // per-shop daily quota in the service is the real ceiling; this stops a
        // loop from burning through it in seconds.
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request) => service.match(requireTenant(request.tenant), request.body),
  );

  routes.post(
    '/resolve',
    {
      schema: {
        body: ScanMatchRequestSchema.extend({
          scanEventId: z.uuid(),
          saleItemId: z.uuid(),
        }),
        response: { 200: ScanMatchResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request) => service.resolveQueued(requireTenant(request.tenant), request.body),
  );

  routes.get(
    '/barcode/:code',
    {
      schema: {
        params: z.object({ code: z.string().min(6).max(32) }),
        response: {
          200: z.object({
            productId: z.uuid().nullable(),
            global: BarcodeCatalogEntrySchema.nullable(),
          }),
        },
      },
    },
    async (request) => {
      const tenant = requireTenant(request.tenant);
      const productId = await service.lookupBarcode(tenant, request.params.code);
      const global = productId ? null : await service.lookupGlobalBarcode(request.params.code);

      return {
        productId,
        global: global
          ? { barcode: global.barcode, name: global.name, category: global.category }
          : null,
      };
    },
  );

  /** Cached on the device so tier 1 resolves without a round trip. */
  routes.get(
    '/catalog',
    {
      schema: {
        response: {
          200: z.array(
            z.object({
              barcode: z.string(),
              productId: z.uuid(),
              name: z.string(),
              category: z.string().nullable(),
            }),
          ),
        },
      },
    },
    async (request) => service.deviceCatalogue(requireTenant(request.tenant)),
  );

  routes.post(
    '/enroll',
    {
      schema: {
        body: z.object({
          productId: z.uuid(),
          vector: z.array(z.number()).length(EMBEDDING_DIMENSIONS),
        }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.enrolEmbedding(
        requireTenant(request.tenant),
        request.body.productId,
        request.body.vector,
      );
      return reply.status(204).send(null);
    },
  );

  routes.get(
    '/embeddings',
    { schema: { response: { 200: z.array(ProductEmbeddingSchema) } } },
    async (request) => service.listEmbeddings(requireTenant(request.tenant)),
  );

  /**
   * The number that tells you whether the cascade is working: the share of scans
   * still reaching the paid tier. It should fall as a shop's catalog is enrolled.
   */
  routes.get(
    '/telemetry',
    {
      schema: {
        response: {
          200: z.object({
            total: z.number().int(),
            byTier: z.array(
              z.object({ tier: z.string(), count: z.number().int(), costMicros: z.number().int() }),
            ),
            paidTierShare: z.number(),
            totalCostMicros: z.number().int(),
          }),
        },
      },
    },
    async (request) => service.telemetry(requireTenant(request.tenant)),
  );
}
