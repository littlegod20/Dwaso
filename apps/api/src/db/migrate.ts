import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadEnv } from '../config/env.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Run as a release command before new containers take traffic. Migrations must
 * stay backward-compatible with the previous deployed version so a rollback does
 * not land on a schema it cannot read.
 */
async function main() {
  const env = loadEnv();

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  // A single connection: migrations are serial by nature and a pool would only
  // add the chance of two of them racing during a rolling deploy.
  const client = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    // The embedding tier of the scan cascade needs pgvector, and the generated
    // migrations reference vector columns, so the extension has to exist first.
    await client`create extension if not exists vector`;

    await migrate(db, { migrationsFolder: resolve(here, '../../drizzle') });
    console.warn('Migrations applied');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
