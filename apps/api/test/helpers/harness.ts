import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { inject } from 'vitest';
import postgres from 'postgres';
import { buildApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { shopMembers, shops, users } from '../../src/db/schema/index.js';
import { TenantContext } from '../../src/lib/tenant.js';

export function testEnv(): Env {
  return loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: inject('databaseUrl'),
    // Long enough to satisfy the schema; the value is irrelevant because no test
    // token outlives the process that signed it.
    JWT_SECRET: 'test-secret-that-is-long-enough-to-pass-validation',
    SMS_PROVIDER: 'console',
    OTEL_ENABLED: 'false',
  });
}

/** Redis is skipped: none of these tests exercise OTP or job queues. */
export async function startTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ env: testEnv(), withRedis: false });
  await app.ready();
  return app;
}

export type TestShop = {
  shopId: string;
  userId: string;
  deviceId: string;
  token: string;
  tenant: TenantContext;
};

/**
 * Creates a shop with an owner and a signed token for it.
 *
 * Tests drive the real HTTP surface with this token rather than calling services
 * directly, so authentication, validation and the tenant plumbing are all under
 * test rather than assumed.
 */
export async function createShop(
  app: FastifyInstance,
  overrides: { name?: string; timezone?: string; currency?: 'GHS' | 'NGN' | 'USD' | 'EUR' } = {},
): Promise<TestShop> {
  const [user] = await app.db
    .insert(users)
    .values({ phone: `+2332${Math.floor(10_000_000 + Math.random() * 89_999_999)}` })
    .returning();

  const [shop] = await app.db
    .insert(shops)
    .values({
      name: overrides.name ?? 'Test Shop',
      currency: overrides.currency ?? 'GHS',
      timezone: overrides.timezone ?? 'Africa/Accra',
    })
    .returning();

  await app.db.insert(shopMembers).values({ shopId: shop.id, userId: user.id, role: 'owner' });

  const deviceId = randomUUID();
  const token = app.jwt.sign({
    sub: user.id,
    shopId: shop.id,
    deviceId,
    role: 'owner',
  });

  return {
    shopId: shop.id,
    userId: user.id,
    deviceId,
    token,
    tenant: new TenantContext(
      { shopId: shop.id, userId: user.id, deviceId, role: 'owner' },
      app.db,
    ),
  };
}

export function authHeaders(shop: TestShop) {
  return { authorization: `Bearer ${shop.token}` };
}

/**
 * Empties every table between test files.
 *
 * Connects as the owner because RLS would otherwise hide the very rows that need
 * clearing, and a leftover row from a previous file is the kind of shared state
 * that makes a suite fail only when run in a particular order.
 */
export async function truncateAll(): Promise<void> {
  const sql = postgres(inject('adminUrl'), { max: 1, prepare: false, onnotice: () => {} });

  try {
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables
      where schemaname = 'public' and tablename <> '__drizzle_migrations'
    `;

    if (!tables.length) return;

    const list = tables.map((row) => `"${row.tablename}"`).join(', ');
    await sql.unsafe(`truncate table ${list} restart identity cascade`);
  } finally {
    await sql.end();
  }
}
