import Fastify, { type FastifyInstance } from 'fastify';
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { trace } from '@opentelemetry/api';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { corsOrigins, loadEnv, type Env } from './config/env.js';
import { loggerOptions } from './config/logger.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { databasePlugin } from './plugins/database.js';
import { redisPlugin } from './plugins/redis.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { shopRoutes } from './modules/shops/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { inventoryRoutes } from './modules/inventory/routes.js';
import { salesRoutes } from './modules/sales/routes.js';
import { creditRoutes } from './modules/credit/routes.js';
import { syncRoutes } from './modules/sync/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { scanRoutes } from './modules/scan/routes.js';
import { reminderRoutes } from './modules/reminders/routes.js';
import { supplierRoutes } from './modules/suppliers/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { privacyRoutes } from './modules/privacy/routes.js';

export type BuildAppOptions = {
  env?: Env;
  /** Skips connecting Redis, for tests that only exercise Postgres-backed routes. */
  withRedis?: boolean;
};

/**
 * Assembles the application without binding a port, so integration tests can
 * drive the real routing, validation and error handling in-process via
 * `app.inject()` instead of over a socket.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv();

  const app = Fastify({
    logger: loggerOptions(env),
    trustProxy: true,
    // Scan uploads are the largest payload; sync batches are capped by count.
    bodyLimit: 8 * 1024 * 1024,
    disableRequestLogging: env.NODE_ENV === 'test',
  });

  app.decorate('env', env);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  if (env.OTEL_ENABLED) {
    // Names spans after the route pattern rather than the URL, so /products/:id
    // aggregates instead of splitting into one span per product.
    const otel = new FastifyOtelInstrumentation({
      ignorePaths: (route) => route.url === '/healthz' || route.url === '/readyz',
    });
    await app.register(otel.plugin());

    // A slow request is only actionable once you know whose shop it was: the
    // shops with thousands of products behave nothing like a new one.
    // preHandler rather than onRequest: authentication is itself an onRequest
    // hook, so the shop is not known yet at that point.
    app.addHook('preHandler', async (request) => {
      if (request.auth?.shopId) {
        trace.getActiveSpan()?.setAttribute('dwaso.shop_id', request.auth.shopId);
      }
    });
  }

  await app.register(errorHandlerPlugin);
  await app.register(helmet, { contentSecurityPolicy: env.NODE_ENV === 'production' });
  await app.register(cors, { origin: corsOrigins(env), credentials: true });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Rate limiting is per authenticated shop where possible, so one trader on a
    // shared market wifi cannot exhaust another trader's budget by IP collision.
    keyGenerator: (request) => request.shopId ?? request.ip,
  });

  await app.register(databasePlugin);
  if (options.withRedis !== false) {
    await app.register(redisPlugin);
  }
  await app.register(authPlugin);

  await app.register(healthRoutes);

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(shopRoutes, { prefix: '/shops' });
      await api.register(catalogRoutes, { prefix: '/products' });
      await api.register(inventoryRoutes, { prefix: '/inventory' });
      await api.register(salesRoutes, { prefix: '/sales' });
      await api.register(creditRoutes, { prefix: '/creditors' });
      await api.register(syncRoutes, { prefix: '/sync' });
      await api.register(reportRoutes, { prefix: '/reports' });
      await api.register(scanRoutes, { prefix: '/scan' });
      await api.register(reminderRoutes, { prefix: '/reminders' });
      await api.register(supplierRoutes, { prefix: '/suppliers' });
      await api.register(notificationRoutes, { prefix: '/notifications' });
      await api.register(privacyRoutes, { prefix: '/privacy' });
    },
    { prefix: '/v1' },
  );

  return app;
}
