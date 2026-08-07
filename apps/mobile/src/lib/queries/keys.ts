/**
 * Query keys.
 *
 * Every read in the app goes through one of these, and the sync engine
 * invalidates them wholesale after a pull. Keeping them in one place is what
 * makes that blunt invalidation safe: there is no read path that sync does not
 * know how to refresh.
 */
export const queryKeys = {
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  productMovements: (id: string) => ['products', id, 'movements'] as const,
  productPriceHistory: (id: string) => ['products', id, 'prices'] as const,

  creditors: ['creditors'] as const,
  creditor: (id: string) => ['creditors', id] as const,
  creditorHistory: (id: string) => ['creditors', id, 'history'] as const,

  dashboard: ['dashboard'] as const,
  activity: ['activity'] as const,
  report: (period: string) => ['reports', period] as const,
  reconciliation: ['reports', 'reconciliation'] as const,

  suppliers: ['suppliers'] as const,
  nearbySuppliers: (productId?: string, category?: string) =>
    ['suppliers', 'nearby', productId ?? 'all', category ?? 'all'] as const,
  reminderSchedules: ['reminder-schedules'] as const,
  shop: ['shop'] as const,
} as const;
