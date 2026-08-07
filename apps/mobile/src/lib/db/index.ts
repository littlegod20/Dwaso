import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL, SCHEMA_VERSION, SYNCED_TABLES } from './schema';

export * from './registry';
export { SYNCED_TABLES } from './schema';

const DATABASE_NAME = 'dwaso.db';

let database: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the local database, creating or migrating it as needed.
 *
 * The in-flight promise is cached, not just the result. Several screens mount at
 * once on a cold start and would otherwise each trigger a parallel open and
 * migration of the same file.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  if (opening) return opening;

  opening = (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await migrate(db);
    database = db;
    opening = null;
    return db;
  })();

  return opening;
}

/**
 * Schema migration keyed on SQLite's own `user_version`.
 *
 * Version 1 is idempotent `CREATE TABLE IF NOT EXISTS`, so a partially applied
 * first run repairs itself. Later versions get explicit `ALTER TABLE` steps —
 * dropping and rebuilding is not an option once the outbox holds a trader's
 * unsynced sales.
 */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) return;

  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export const META_KEYS = {
  cursor: 'sync.cursor',
  lastSyncAt: 'sync.lastSyncAt',
  /** The shop the local data belongs to. Switching shops wipes rather than
   * merges, because two traders' ledgers must never mix on one handset. */
  shopId: 'session.shopId',
} as const;

/**
 * Clears every synced table without touching the outbox.
 *
 * Used when the server reports the device's cursor is older than the tombstone
 * retention window. Keeping the outbox is the important part: those are writes
 * the trader made that the server has not acknowledged, and throwing them away
 * to fix a *read* problem would turn a slow sync into lost sales.
 */
export async function resetSyncedData(): Promise<void> {
  const db = await getDatabase();

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of SYNCED_TABLES) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }
    await tx.runAsync('DELETE FROM sync_meta WHERE key = ?', META_KEYS.cursor);
  });
}

/** Full local wipe, for logout and for switching to a different shop. */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of SYNCED_TABLES) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }
    await tx.runAsync('DELETE FROM outbox');
    await tx.runAsync('DELETE FROM sync_meta');
  });
}
