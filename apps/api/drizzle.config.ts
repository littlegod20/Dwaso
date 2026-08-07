import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/dwaso',
  },
  // Every table is shop-scoped and reachable through the API only; nothing here
  // should ever be dropped implicitly by a generated migration.
  strict: true,
  verbose: true,
});
