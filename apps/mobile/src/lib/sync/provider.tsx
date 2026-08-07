import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { META_KEYS, getMeta } from '../db';
import { pendingCount } from './outbox';
import { runSync } from './engine';
import { useSyncStore } from '@/stores/sync';
import { useSessionStore } from '@/stores/session';

/** Steady-state polling interval when everything is healthy. */
const IDLE_INTERVAL_MS = 60_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Drives the sync loop.
 *
 * The retry schedule is the part worth reading. A trader in a market with patchy
 * signal will fail dozens of syncs an hour, and retrying every few seconds would
 * flatten her battery for nothing. Backing off to five minutes and then
 * resetting the moment the app is foregrounded means the common recovery — she
 * walks somewhere with signal and opens the app — is instant, while the failing
 * case is cheap.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const status = useSessionStore((state) => state.status);
  const setSync = useSyncStore((state) => state.set);

  const backoff = useRef(MIN_BACKOFF_MS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') {
      if (timer.current) clearTimeout(timer.current);
      return;
    }

    const schedule = (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      if (!mounted.current) return;
      timer.current = setTimeout(() => void cycle(), delay);
    };

    const cycle = async () => {
      if (!mounted.current) return;

      setSync({ status: 'syncing', error: null });

      try {
        const result = await runSync();

        backoff.current = MIN_BACKOFF_MS;

        setSync({
          status: 'idle',
          error: null,
          lastSyncAt: (await getMeta(META_KEYS.lastSyncAt)) ?? new Date().toISOString(),
          pending: await pendingCount(),
        });

        // Reads come from SQLite, so nothing is stale until sync writes to it.
        // Invalidating only when something actually changed avoids re-rendering
        // every list once a minute for no reason.
        if (result.pulled > 0 || result.pushed > 0 || result.resynced) {
          await queryClient.invalidateQueries();
        }

        schedule(IDLE_INTERVAL_MS);
      } catch (error) {
        const offline = error instanceof ApiError && error.code === 'network_error';

        setSync({
          status: offline ? 'offline' : 'error',
          error: error instanceof Error ? error.message : 'Sync failed',
          pending: await pendingCount(),
        });

        schedule(backoff.current);
        backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS);
      }
    };

    void cycle();

    // Coming back to the foreground is the strongest available signal that
    // conditions may have changed, so it resets the backoff rather than waiting
    // out a timer that could be five minutes long.
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        backoff.current = MIN_BACKOFF_MS;
        void cycle();
      }
    });

    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, queryClient, setSync]);

  return <>{children}</>;
}

/** Forces a sync now — for pull-to-refresh and for the "retry" affordance. */
export function useSyncNow() {
  const queryClient = useQueryClient();
  const setSync = useSyncStore((state) => state.set);

  return async () => {
    setSync({ status: 'syncing', error: null });

    try {
      await runSync();
      await queryClient.invalidateQueries();
      setSync({
        status: 'idle',
        error: null,
        lastSyncAt: new Date().toISOString(),
        pending: await pendingCount(),
      });
    } catch (error) {
      setSync({
        status: error instanceof ApiError && error.code === 'network_error' ? 'offline' : 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  };
}
