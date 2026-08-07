import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Either a pooled connection or an open transaction. Repositories accept this
 * so the same function works inside and outside a transaction. */
export type Executor = Database | Transaction;

export function createDatabase(url: string, poolMax: number) {
  const client = postgres(url, {
    max: poolMax,
    // Neon's pooler and pgbouncer run in transaction mode, where server-side
    // prepared statements do not survive between checkouts.
    prepare: false,
    // Fail fast rather than queue behind a dead database; the readiness probe
    // should take the instance out of rotation instead of requests piling up.
    connect_timeout: 10,
    idle_timeout: 30,
    onnotice: () => {},
  });

  return drizzle(client, { schema, casing: 'snake_case' });
}

export { schema };
