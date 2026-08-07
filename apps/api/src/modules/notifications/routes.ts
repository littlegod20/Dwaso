import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireTenant } from '../../lib/tenant.js';
import { pushTokens } from '../../db/schema/index.js';

export async function notificationRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.addHook('onRequest', app.authenticate);

  routes.put(
    '/token',
    {
      schema: {
        body: z.object({
          token: z.string().min(10),
          platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
        }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const tenant = requireTenant(request.tenant);

      await app.db
        .insert(pushTokens)
        .values({
          shopId: tenant.shopId,
          deviceId: tenant.deviceId,
          token: request.body.token,
          platform: request.body.platform,
        })
        // Expo rotates tokens, and a handset that was retired and reinstated
        // should come back to life rather than stay disabled.
        .onConflictDoUpdate({
          target: pushTokens.token,
          set: {
            shopId: tenant.shopId,
            deviceId: tenant.deviceId,
            platform: request.body.platform,
            disabledAt: null,
          },
        });

      return reply.status(204).send(null);
    },
  );

  routes.delete(
    '/token',
    {
      schema: { body: z.object({ token: z.string() }), response: { 204: z.null() } },
    },
    async (request, reply) => {
      const tenant = requireTenant(request.tenant);

      await app.db
        .update(pushTokens)
        .set({ disabledAt: new Date() })
        .where(and(eq(pushTokens.shopId, tenant.shopId), eq(pushTokens.token, request.body.token)));

      return reply.status(204).send(null);
    },
  );
}
