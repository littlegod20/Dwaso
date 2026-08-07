import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';

/**
 * Liveness and readiness are deliberately different checks. `/healthz` answers
 * "is this process alive" and must never touch a dependency, or a brief database
 * blip would make the orchestrator kill healthy containers. `/readyz` answers
 * "can this instance serve traffic" and does check dependencies.
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', { logLevel: 'silent' }, async () => ({ status: 'ok' }));

  app.get('/readyz', { logLevel: 'silent' }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await app.db.execute(sql`select 1`);
      checks.database = 'ok';
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed: database');
      checks.database = 'error';
    }

    if (app.hasDecorator('redis')) {
      try {
        await app.redis.ping();
        checks.redis = 'ok';
      } catch (error) {
        app.log.error({ err: error }, 'Readiness check failed: redis');
        checks.redis = 'error';
      }
    }

    const ready = Object.values(checks).every((status) => status === 'ok');
    return reply.status(ready ? 200 : 503).send({ status: ready ? 'ready' : 'degraded', checks });
  });
}
