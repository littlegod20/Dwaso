import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { startWorkers } from './jobs/workers/index.js';
import { shutdownTelemetry } from './telemetry.js';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const FORCED_SHUTDOWN_MS = 15_000;

async function main() {
  const env = loadEnv();
  const app = await buildApp({ env });
  const workers = await startWorkers(app);

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, 'Shutting down');

    // If a job or connection refuses to settle, exiting non-zero is better than
    // hanging: the orchestrator will replace the instance either way, and a stuck
    // container keeps taking traffic on some platforms.
    const forced = setTimeout(() => {
      app.log.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, FORCED_SHUTDOWN_MS);
    forced.unref();

    try {
      await workers.stop();
      await app.close();
      await shutdownTelemetry();
      clearTimeout(forced);
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => void shutdown(signal));
  }

  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'Unhandled promise rejection');
  });

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
