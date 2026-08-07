import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  SyncPullQuerySchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { SyncService } from './service.js';

export async function syncRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new SyncService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.post(
    '/push',
    {
      schema: { body: SyncPushRequestSchema, response: { 200: SyncPushResponseSchema } },
      config: {
        // Sync is chatty by design and already idempotent, so it gets a higher
        // ceiling than ordinary routes: throttling a device catching up after a
        // week offline would only make it take longer while holding a connection.
        rateLimit: { max: 600, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      service.onRejection = (mutation, error) => {
        request.log.warn(
          { err: error, entity: mutation.entity, mutationId: mutation.mutationId },
          'Sync mutation rejected',
        );
      };

      return service.push(requireTenant(request.tenant), request.body);
    },
  );

  routes.get(
    '/pull',
    {
      schema: { querystring: SyncPullQuerySchema, response: { 200: SyncPullResponseSchema } },
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (request) => {
      const tenant = requireTenant(request.tenant);
      const result = await service.pull(tenant, request.query.since, request.query.limit);

      await service.recordPull(tenant, tenant.deviceId, result.nextCursor);
      return result;
    },
  );
}
