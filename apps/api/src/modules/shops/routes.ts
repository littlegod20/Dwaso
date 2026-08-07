import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { BusinessSetupSchema, ShopSchema, UpdateShopSchema } from '@dwaso/shared-types';
import { shopMembers, shops } from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { requireTenant } from '../../lib/tenant.js';
import { newId } from '../../lib/ids.js';

const ShopResponseSchema = ShopSchema.extend({ createdAt: z.string() });

/** Setup mints a fresh access token because the previous one was issued before a
 * shop existed and therefore carries no shopId. */
const SetupResponseSchema = z.object({
  shop: ShopResponseSchema,
  accessToken: z.string(),
});

export async function shopRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post(
    '/',
    {
      onRequest: [app.authenticate],
      schema: { body: BusinessSetupSchema, response: { 201: SetupResponseSchema } },
    },
    async (request, reply) => {
      const auth = request.auth!;

      if (auth.shopId) {
        throw AppError.conflict('This account already has a shop');
      }

      const shop = await app.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(shops)
          .values({
            id: newId(),
            name: request.body.name,
            currency: request.body.currency,
            timezone: request.body.timezone ?? 'Africa/Accra',
          })
          .returning();

        await tx.insert(shopMembers).values({
          shopId: created.id,
          userId: auth.userId,
          role: 'owner',
        });

        return created;
      });

      const accessToken = app.jwt.sign({
        sub: auth.userId,
        shopId: shop.id,
        deviceId: auth.deviceId,
        role: 'owner',
      });

      return reply.status(201).send({
        shop: { ...shop, createdAt: shop.createdAt.toISOString() },
        accessToken,
      });
    },
  );

  routes.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: { response: { 200: ShopResponseSchema } },
    },
    async (request) => {
      const tenant = requireTenant(request.tenant);

      const [shop] = await app.db
        .select()
        .from(shops)
        .where(and(eq(shops.id, tenant.shopId), isNull(shops.deletedAt)))
        .limit(1);

      if (!shop) throw AppError.notFound('Shop');
      return { ...shop, createdAt: shop.createdAt.toISOString() };
    },
  );

  routes.patch(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: { body: UpdateShopSchema, response: { 200: ShopResponseSchema } },
    },
    async (request) => {
      const tenant = requireTenant(request.tenant);
      // Currency changes reinterpret every stored figure, and staff should not
      // be able to rename the business either.
      tenant.requireOwner('change shop settings');

      const [shop] = await app.db
        .update(shops)
        .set({ ...request.body })
        .where(and(eq(shops.id, tenant.shopId), isNull(shops.deletedAt)))
        .returning();

      if (!shop) throw AppError.notFound('Shop');
      return { ...shop, createdAt: shop.createdAt.toISOString() };
    },
  );
}
