import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createDatabase } from '../db/client.js';

export const databasePlugin = fp(async function databasePlugin(app: FastifyInstance) {
  const url = app.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not configured; the API cannot start without a database');
  }

  const db = createDatabase(url, app.env.DATABASE_POOL_MAX);
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    // Drizzle keeps the postgres.js client on the session property; closing it
    // lets in-flight queries finish before the process exits.
    await db.$client.end({ timeout: 5 });
  });
});
