import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/setup/postgres.ts'],
    // Every test file talks to the same Postgres container, so they share one
    // process rather than opening a connection pool per worker against a
    // database sized for one.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    // Pulling and starting the container on a cold machine is slow, and a
    // timeout here reads as a mysterious failure rather than a slow download.
    hookTimeout: 180_000,
    teardownTimeout: 60_000,
  },
});
