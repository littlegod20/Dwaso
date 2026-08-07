import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { QUEUE_NAMES, createQueues, registerSchedules, type Queues } from '../queues.js';
import { drainMessageOutbox } from './messages.js';
import { requeueStalledMessages, sweepReminders } from './reminders.js';
import { evaluateLowStock } from './low-stock.js';
import { rollupDailyMetrics } from './rollups.js';
import { purgeExpiredData } from './retention.js';

export type WorkerRuntime = {
  queues: Queues;
  stop: () => Promise<void>;
};

/**
 * Starts the background workers alongside the API.
 *
 * Co-locating them is a deliberate early-stage choice: one process to deploy,
 * one set of credentials, one log stream. The seam that makes it reversible is
 * that every handler here is a plain function of the app instance, so moving
 * them to a dedicated worker process later is a change to this file only.
 *
 * Concurrency is 1 per queue. These jobs sweep every shop and mostly wait on
 * network calls to SMS and push providers; running several at once would
 * multiply database connections without finishing the sweep meaningfully sooner.
 */
export async function startWorkers(app: FastifyInstance): Promise<WorkerRuntime> {
  const connection = app.redis;
  const queues = createQueues(connection);
  const workers: Worker[] = [];

  const register = (name: string, handler: () => Promise<unknown>) => {
    const worker = new Worker(
      name,
      async (job) => {
        const startedAt = Date.now();
        const result = await handler();
        app.log.info(
          { queue: name, job: job.name, durationMs: Date.now() - startedAt, result },
          'Background job completed',
        );
        return result;
      },
      { connection, concurrency: 1 },
    );

    worker.on('failed', (job, error) => {
      app.log.error(
        { queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: error },
        'Background job failed',
      );
    });

    workers.push(worker);
  };

  register(QUEUE_NAMES.messages, async () => {
    // Reclaiming stalled sends first means a crash mid-drain costs one cycle of
    // delay rather than a message that never arrives.
    const requeued = await requeueStalledMessages(app);
    const queued = await sweepReminders(app);
    const sent = await drainMessageOutbox(app);
    return { requeued, queued, sent };
  });

  register(QUEUE_NAMES.lowStock, async () => ({ notified: await evaluateLowStock(app) }));
  register(QUEUE_NAMES.rollups, async () => ({ shops: await rollupDailyMetrics(app) }));
  register(QUEUE_NAMES.retention, () => purgeExpiredData(app));

  await registerSchedules(queues);

  app.log.info({ queues: Object.values(QUEUE_NAMES) }, 'Background workers started');

  return {
    queues,
    async stop() {
      // Workers close before queues so an in-flight job finishes against a live
      // connection instead of failing on a closed one.
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(Object.values(queues).map((queue) => queue.close()));
    },
  };
}
