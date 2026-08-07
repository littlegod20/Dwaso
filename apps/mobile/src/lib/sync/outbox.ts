import * as Crypto from 'expo-crypto';
import type { SyncEntity, SyncMutation, SyncOp } from '@dwaso/shared-types';
import { ENTITY_TABLES, getDatabase, toSqlite } from '../db';

export type LocalWrite = {
  entity: SyncEntity;
  op: SyncOp;
  entityId: string;
  /** The full row as the server contract defines it. Sent verbatim to the API
   * and written verbatim to the local mirror, so the two cannot drift. */
  payload: Record<string, unknown>;
};

export type OutboxRow = {
  mutationId: string;
  entity: SyncEntity;
  op: SyncOp;
  entityId: string;
  payload: string;
  clientTimestamp: string;
  attempts: number;
  lastError: string | null;
  rejectedAt: string | null;
  createdAt: string;
};

export function newId(): string {
  return Crypto.randomUUID();
}

/**
 * Writes local rows and their outbox entries in a single transaction.
 *
 * This is the heart of the offline story. The trader taps "save", the row lands
 * in the local database and the intent to upload it lands beside it, atomically.
 * There is no window in which she has seen a sale recorded that the server will
 * never hear about, and none in which the server hears about one she did not see
 * saved.
 *
 * Rows are written with `serverSeq = 0`, which marks them unconfirmed. Any pull
 * carrying the server's version arrives with a higher sequence number and
 * overwrites them, so the server's truth always wins without a special case.
 */
export async function commitLocal(writes: LocalWrite[]): Promise<void> {
  if (!writes.length) return;

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const write of writes) {
      const { table, columns } = ENTITY_TABLES[write.entity];

      if (write.op === 'delete') {
        await tx.runAsync(
          `UPDATE ${table} SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
          now,
          now,
          write.entityId,
        );
      } else {
        const present = Object.keys(write.payload).filter((key) => key in columns);
        const names = ['id', ...present.filter((key) => key !== 'id'), 'serverSeq', 'updatedAt'];
        const values = [
          write.entityId,
          ...present
            .filter((key) => key !== 'id')
            .map((key) => toSqlite(write.payload[key], columns[key])),
          0,
          now,
        ];

        await tx.runAsync(
          `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})
           ON CONFLICT(id) DO UPDATE SET ${names
             .filter((name) => name !== 'id')
             .map((name) => `${name} = excluded.${name}`)
             .join(', ')}`,
          values,
        );
      }

      await tx.runAsync(
        `INSERT INTO outbox (mutationId, entity, op, entityId, payload, clientTimestamp, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        write.entity,
        write.op,
        write.entityId,
        JSON.stringify(write.payload),
        now,
        now,
      );
    }
  });
}

/** The next batch to push, oldest first so causally ordered writes stay ordered. */
export async function pendingMutations(limit = 200): Promise<OutboxRow[]> {
  const db = await getDatabase();

  return db.getAllAsync<OutboxRow>(
    'SELECT * FROM outbox WHERE rejectedAt IS NULL ORDER BY createdAt ASC, rowid ASC LIMIT ?',
    limit,
  );
}

export async function pendingCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) AS count FROM outbox WHERE rejectedAt IS NULL',
  );
  return row?.count ?? 0;
}

export function toSyncMutation(row: OutboxRow): SyncMutation {
  return {
    mutationId: row.mutationId,
    entity: row.entity,
    op: row.op,
    entityId: row.entityId,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    clientTimestamp: row.clientTimestamp,
  };
}

export async function removeMutations(mutationIds: string[]): Promise<void> {
  if (!mutationIds.length) return;

  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM outbox WHERE mutationId IN (${mutationIds.map(() => '?').join(', ')})`,
    mutationIds,
  );
}

/**
 * Marks a mutation the server refused. It stays in the table rather than being
 * deleted, because a write the trader believes she made and that silently
 * vanished is far worse than one she can be shown and asked about.
 */
export async function rejectMutation(mutationId: string, reason: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE outbox SET rejectedAt = ?, lastError = ? WHERE mutationId = ?',
    new Date().toISOString(),
    reason,
    mutationId,
  );
}

export async function recordAttempt(mutationIds: string[], error: string): Promise<void> {
  if (!mutationIds.length) return;

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE outbox SET attempts = attempts + 1, lastError = ?
     WHERE mutationId IN (${mutationIds.map(() => '?').join(', ')})`,
    [error, ...mutationIds],
  );
}

export async function rejectedMutations(): Promise<OutboxRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<OutboxRow>(
    'SELECT * FROM outbox WHERE rejectedAt IS NOT NULL ORDER BY rejectedAt DESC',
  );
}
