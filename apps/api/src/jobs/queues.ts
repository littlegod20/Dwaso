import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';

export const QUEUE_NAMES = {
  messages: 'dwaso:messages',
  lowStock: 'dwaso:low-stock',
  rollups: 'dwaso:rollups',
  retention: 'dwaso:retention',
} as const;

/**
 * Bounded retries with exponential backoff, then the job stops.
 *
 * Retrying forever is worse than failing here: the payloads are reminders and
 * alerts, and a message that finally lands three days late is more confusing to
 * a trader's customer than one that never arrives. Failed jobs are kept so they
 * can be inspected rather than silently discarded.
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

export type Queues = ReturnType<typeof createQueues>;

export function createQueues(connection: Redis) {
  const make = (name: string) =>
    new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });

  return {
    messages: make(QUEUE_NAMES.messages),
    lowStock: make(QUEUE_NAMES.lowStock),
    rollups: make(QUEUE_NAMES.rollups),
    retention: make(QUEUE_NAMES.retention),
  };
}

/**
 * Schedulers are upserted by a stable key, so redeploying does not accumulate
 * duplicate repeat entries — which would silently multiply how often every
 * trader's customers get reminded.
 */
export async function registerSchedules(queues: Queues) {
  await queues.messages.upsertJobScheduler(
    'drain-outbox',
    { every: 60_000 },
    { name: 'drain', data: {} },
  );

  await queues.lowStock.upsertJobScheduler(
    'evaluate-low-stock',
    { pattern: '*/15 * * * *' },
    { name: 'evaluate', data: {} },
  );

  // Just after midnight UTC; each shop's own day boundary is resolved inside the
  // job from its timezone.
  await queues.rollups.upsertJobScheduler(
    'daily-rollups',
    { pattern: '10 0 * * *' },
    { name: 'rollup', data: {} },
  );

  await queues.retention.upsertJobScheduler(
    'purge-expired',
    { pattern: '30 3 * * *' },
    { name: 'purge', data: {} },
  );
}
