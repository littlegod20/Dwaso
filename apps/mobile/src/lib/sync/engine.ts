import * as Network from 'expo-network';
import type {
  SyncChange,
  SyncPullResponse,
  SyncPushResponse,
} from '@dwaso/shared-types';
import { ApiError, apiRequest } from '../api/client';
import { getDeviceId } from '../auth/tokens';
import { ENTITY_TABLES, META_KEYS, getDatabase, getMeta, resetSyncedData, setMeta, toSqlite } from '../db';
import {
  pendingMutations,
  recordAttempt,
  rejectMutation,
  removeMutations,
  toSyncMutation,
} from './outbox';

const PUSH_BATCH = 200;
const PULL_LIMIT = 500;

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export type SyncState = {
  status: SyncStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  error: string | null;
};

export type SyncResult = {
  pushed: number;
  pulled: number;
  rejected: number;
  resynced: boolean;
};

/**
 * Applies a batch of pulled changes.
 *
 * The `serverSeq` comparison in the WHERE clause is what makes this safe to run
 * against a device that has unsynced local edits: a row the trader changed
 * locally carries sequence 0 and is overwritten, while a row already at a higher
 * sequence than the incoming change is left alone. Replaying the same page twice
 * therefore changes nothing, which matters because a dropped connection
 * mid-batch is the normal case, not the exception.
 */
async function applyChanges(changes: SyncChange[]): Promise<void> {
  if (!changes.length) return;

  const db = await getDatabase();

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const change of changes) {
      const mapping = ENTITY_TABLES[change.entity];
      if (!mapping) continue;

      const { table, columns } = mapping;

      if (change.deletedAt || !change.data) {
        await tx.runAsync(
          `UPDATE ${table} SET deletedAt = ?, serverSeq = ? WHERE id = ? AND serverSeq <= ?`,
          change.deletedAt ?? new Date().toISOString(),
          change.serverSeq,
          change.id,
          change.serverSeq,
        );
        continue;
      }

      const present = Object.keys(change.data).filter(
        (key) => key in columns && key !== 'id' && key !== 'serverSeq',
      );

      const names = ['id', ...present, 'serverSeq'];
      const values = [
        change.id,
        ...present.map((key) => toSqlite(change.data![key], columns[key])),
        change.serverSeq,
      ];

      await tx.runAsync(
        `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET ${names
           .filter((name) => name !== 'id')
           .map((name) => `${name} = excluded.${name}`)
           .join(', ')}
         WHERE ${table}.serverSeq <= excluded.serverSeq`,
        values,
      );
    }
  });
}

/**
 * Uploads pending mutations.
 *
 * Every outcome the server can report is handled here, and three of the four
 * end with the mutation being dropped from the outbox. That is intentional:
 * `applied`, `duplicate` and `superseded` all mean the server's state is now
 * authoritative and the local copy will be corrected by the next pull. Only a
 * retryable transport failure leaves the row in place.
 */
async function push(): Promise<{ pushed: number; rejected: number }> {
  const deviceId = await getDeviceId();
  let pushed = 0;
  let rejected = 0;

  for (;;) {
    const batch = await pendingMutations(PUSH_BATCH);
    if (!batch.length) break;

    let response: SyncPushResponse;

    try {
      response = await apiRequest<SyncPushResponse>('/sync/push', {
        method: 'POST',
        body: { deviceId, mutations: batch.map(toSyncMutation) },
      });
    } catch (error) {
      if (error instanceof ApiError && !error.retryable) {
        // The whole batch was refused for a reason retrying cannot fix — an
        // expired session, say. Leave it; the next sync after re-auth sends it.
        await recordAttempt(
          batch.map((row) => row.mutationId),
          error.message,
        );
      }
      throw error;
    }

    const settled: string[] = [];

    for (const result of response.results) {
      if (result.status === 'rejected') {
        await rejectMutation(result.mutationId, result.message ?? 'The server refused this change');
        rejected += 1;
      } else {
        settled.push(result.mutationId);
        pushed += 1;
      }
    }

    await removeMutations(settled);

    // A short batch means the outbox is drained; anything else risks looping on
    // mutations the server keeps returning without settling.
    if (batch.length < PUSH_BATCH) break;
  }

  return { pushed, rejected };
}

/** Downloads changes from the cursor forward, following pagination to the end. */
async function pull(): Promise<{ pulled: number; resynced: boolean }> {
  let cursor = Number((await getMeta(META_KEYS.cursor)) ?? 0);
  let pulled = 0;
  let resynced = false;

  for (;;) {
    const page = await apiRequest<SyncPullResponse>('/sync/pull', {
      query: { since: cursor, limit: PULL_LIMIT },
    });

    if (page.resyncRequired) {
      // The device has been offline longer than the server keeps tombstones, so
      // it cannot be told what was deleted while it was away. Rebuilding from
      // zero is the only honest answer — a silently incomplete ledger would have
      // the trader selling against stock that no longer exists.
      await resetSyncedData();
      cursor = 0;
      resynced = true;
      continue;
    }

    await applyChanges(page.changes);
    pulled += page.changes.length;
    cursor = page.nextCursor;
    await setMeta(META_KEYS.cursor, String(cursor));

    if (!page.hasMore) break;
  }

  return { pulled, resynced };
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    // If the platform will not say, assume connectivity and let the request
    // itself be the test. A false negative here would strand a trader who is
    // actually online.
    return true;
  }
}

let syncInFlight: Promise<SyncResult> | null = null;

/**
 * Runs one full sync cycle: push first, then pull.
 *
 * The order matters. Pushing first means the pull that follows returns the
 * server's canonical version of what was just uploaded, including the sequence
 * numbers and any server-side corrections, so the device converges in one round
 * trip rather than two.
 */
export async function runSync(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      if (!(await isOnline())) {
        throw new ApiError('network_error', 'No connection to the server', 0);
      }

      const { pushed, rejected } = await push();
      const { pulled, resynced } = await pull();

      await setMeta(META_KEYS.lastSyncAt, new Date().toISOString());

      return { pushed, pulled, rejected, resynced };
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}
