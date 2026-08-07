import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

export const redisPlugin = fp(async function redisPlugin(app: FastifyInstance) {
  const url = app.env.REDIS_URL;

  if (!url) {
    throw new Error('REDIS_URL is not configured; OTP delivery and job queues require Redis');
  }

  const redis = new Redis(url, {
    // BullMQ requires this, and it is the right setting anyway: a command that
    // queues forever behind a dead Redis turns a cache outage into a hang.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on('error', (error) => {
    app.log.error({ err: error }, 'Redis connection error');
  });

  await redis.connect();

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
