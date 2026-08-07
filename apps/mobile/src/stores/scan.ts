import { create } from 'zustand';
import type { ScanTier } from '@dwaso/shared-types';

export type ScanMatch = {
  productId: string | null;
  productName: string | null;
  confidence: number;
  tier: ScanTier;
  /** Set when recognition could not run because the device was offline. The sale
   * still completes; the link is filled in when the scan resolves later. */
  queued: boolean;
  scanEventId: string | null;
  /** Pre-fills the "add product" form when the item is new to the shop. */
  suggestion: { name: string | null; category: string | null; barcode: string | null } | null;
};

type ScanState = {
  candidate: ScanMatch | null;
  capturedUri: string | null;
  torch: boolean;
  setCandidate: (candidate: ScanMatch | null) => void;
  setCapturedUri: (uri: string | null) => void;
  toggleTorch: () => void;
  reset: () => void;
};

/**
 * The in-flight scan, held in memory only.
 *
 * This is transient UI state that spans three screens (viewfinder, recognised,
 * confirm) and must not outlive the flow — a stale candidate resurfacing on the
 * next scan would attach one product's photo to another product's sale.
 */
export const useScanStore = create<ScanState>((set) => ({
  candidate: null,
  capturedUri: null,
  torch: false,
  setCandidate: (candidate) => set({ candidate }),
  setCapturedUri: (capturedUri) => set({ capturedUri }),
  toggleTorch: () => set((state) => ({ torch: !state.torch })),
  // The torch deliberately survives a reset: a trader working a dim stall at
  // dusk turned it on for the room, not for one product.
  reset: () => set({ candidate: null, capturedUri: null }),
}));
