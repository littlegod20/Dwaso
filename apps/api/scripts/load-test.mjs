#!/usr/bin/env node
/**
 * A short, honest load check for the sync path.
 *
 * This is not a marketing benchmark. It answers one question before a deploy:
 * can a few dozen devices catch up at once without the sequence lock turning
 * into a queue that looks like an outage? Run it against a staging database
 * that looks like production, not against an empty one.
 *
 *   BASE_URL=https://dwaso-api.fly.dev ACCESS_TOKEN=... DEVICE_ID=... \
 *     node scripts/load-test.mjs
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const DEVICE_ID = process.env.DEVICE_ID;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const ROUNDS = Number(process.env.ROUNDS ?? 5);

if (!ACCESS_TOKEN || !DEVICE_ID) {
  console.error('ACCESS_TOKEN and DEVICE_ID are required');
  process.exit(1);
}

async function pull() {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}/v1/sync/pull?since=0&limit=100`, {
    headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  const elapsed = performance.now() - started;
  if (!response.ok) {
    throw new Error(`pull ${response.status}: ${await response.text()}`);
  }
  return elapsed;
}

async function health() {
  const response = await fetch(`${BASE_URL}/readyz`);
  if (!response.ok) throw new Error(`readyz ${response.status}`);
}

const samples = [];

await health();
console.log(`Hitting ${BASE_URL} with ${CONCURRENCY} concurrent pulls × ${ROUNDS} rounds`);

for (let round = 0; round < ROUNDS; round += 1) {
  const batch = await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      try {
        return { ok: true, ms: await pull() };
      } catch (error) {
        return { ok: false, ms: 0, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );

  for (const result of batch) samples.push(result);
}

const ok = samples.filter((sample) => sample.ok).map((sample) => sample.ms);
const failed = samples.length - ok.length;
ok.sort((a, b) => a - b);

const percentile = (p) => ok[Math.min(ok.length - 1, Math.floor((p / 100) * ok.length))] ?? 0;

console.log(
  JSON.stringify(
    {
      total: samples.length,
      failed,
      p50Ms: Math.round(percentile(50)),
      p95Ms: Math.round(percentile(95)),
      p99Ms: Math.round(percentile(99)),
      maxMs: Math.round(ok[ok.length - 1] ?? 0),
    },
    null,
    2,
  ),
);

if (failed > 0) process.exit(1);
