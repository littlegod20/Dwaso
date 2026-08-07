import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GlobalSetupContext } from 'vitest/node';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));

declare module 'vitest' {
  interface ProvidedContext {
    /** Connects as the unprivileged role the API uses in production. */
    databaseUrl: string;
    /** Connects as the owner, for setup and truncation that RLS would block. */
    adminUrl: string;
  }
}

/**
 * Brings up a real Postgres for the test run.
 *
 * A stub or an in-memory substitute would not exercise the parts most likely to
 * be wrong: row-level security, the row lock behind the sync sequence, and the
 * window functions in the reports. Those are the reasons these tests exist, and
 * none of them survive being mocked.
 */
export default async function setup({ provide }: GlobalSetupContext) {
  // pgvector rather than stock Postgres: the scan cascade stores embeddings, and
  // the generated migrations reference vector columns.
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'pgvector/pgvector:pg17',
  )
    .withDatabase('dwaso_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const adminUrl = container.getConnectionUri();
  const admin = postgres(adminUrl, { max: 1, prepare: false, onnotice: () => {} });

  try {
    await admin`create extension if not exists vector`;
    await migrate(drizzle(admin), { migrationsFolder: resolve(here, '../../drizzle') });

    // Tests connect as a role that cannot bypass RLS. Running them as the owner
    // would make the isolation tests pass no matter what the policies said,
    // which is precisely the failure they exist to catch.
    await admin.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dwaso_test') THEN
          CREATE ROLE dwaso_test LOGIN PASSWORD 'dwaso_test';
        END IF;
      END $$;
    `);
    await admin`grant dwaso_app to dwaso_test`;
    await admin`grant usage, select on all sequences in schema public to dwaso_app`;
  } finally {
    await admin.end();
  }

  provide('adminUrl', adminUrl);
  provide(
    'databaseUrl',
    `postgres://dwaso_test:dwaso_test@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`,
  );

  return async () => {
    await container.stop();
  };
}
