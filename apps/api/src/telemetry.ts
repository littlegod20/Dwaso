import { register } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/**
 * Tracing bootstrap.
 *
 * This module is loaded through `node --import`, before anything else, because
 * instrumentation works by replacing the exports of modules like `ioredis` and
 * `undici` — which it can only do if it gets there first. Importing it from
 * `server.ts` would be too late: the app would already be holding the original
 * unpatched functions.
 *
 * What we are buying with this: when a trader in a market with bad signal says
 * a sync took forty seconds, the trace says whether it was our sequence lock,
 * Postgres, or the phone's network. Logs alone cannot separate those.
 */

let sdk: NodeSDK | undefined;

function start(): void {
  if (process.env.OTEL_ENABLED !== 'true') return;

  // Node's ESM loader resolves imports once and caches the result, so patching
  // has to happen through the loader hook rather than by mutating exports after
  // the fact.
  register('import-in-the-middle/hook.mjs', import.meta.url);

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'dwaso-api',
      [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? 'dev',
      'deployment.environment.name': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 60_000,
    }),
    instrumentations: [
      new HttpInstrumentation({
        // Health probes fire every few seconds and would otherwise be most of
        // the trace volume while telling us nothing.
        ignoreIncomingRequestHook: (request) =>
          request.url === '/healthz' || request.url === '/readyz',
      }),
      // Covers the outbound calls that can actually stall a request: Claude
      // Vision on a scan, Google Places on supplier search, the SMS gateway on
      // login.
      new UndiciInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();
}

/**
 * Flushes buffered spans. The server exits explicitly after shutdown, which
 * would otherwise discard the traces from whatever went wrong immediately
 * before — the ones worth having.
 */
export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}

start();
