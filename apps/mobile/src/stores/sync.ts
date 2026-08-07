import { create } from 'zustand';
import type { SyncStatus } from '@/lib/sync/engine';

type SyncStoreState = {
  status: SyncStatus;
  lastSyncAt: string | null;
  pending: number;
  error: string | null;
  set: (patch: Partial<Omit<SyncStoreState, 'set'>>) => void;
};

/**
 * Sync status as UI state, not as data.
 *
 * Every screen that writes something wants to show whether it has left the
 * device yet, and a trader on a market stall with two bars of signal cares about
 * that constantly. Keeping it in a store rather than threading it through
 * queries means the indicator can live in a header without every screen having
 * to know about sync.
 */
export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  pending: 0,
  error: null,
  set: (patch) => set(patch),
}));
