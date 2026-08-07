import { randomUUID } from 'node:crypto';
import type { SyncEntity, SyncMutation, SyncOp } from '@dwaso/shared-types';

/**
 * Builds a push mutation the way a device would.
 *
 * Tests construct these rather than calling the domain services, because the
 * point of a contract test is to send what the client actually sends — including
 * the shapes a well-behaved client would never produce.
 */
export function mutation(
  entity: SyncEntity,
  entityId: string,
  payload: Record<string, unknown>,
  overrides: { op?: SyncOp; mutationId?: string; clientTimestamp?: string } = {},
): SyncMutation {
  return {
    mutationId: overrides.mutationId ?? randomUUID(),
    entity,
    op: overrides.op ?? 'upsert',
    entityId,
    payload,
    clientTimestamp: overrides.clientTimestamp ?? new Date().toISOString(),
  };
}

export function productPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Milo 400g',
    category: 'Beverages',
    sku: null,
    unit: 'unit',
    costPriceMinor: 1800,
    sellPriceMinor: 2500,
    lowStockThreshold: 5,
    isLooseGood: false,
    defaultSupplierId: null,
    imageUrl: null,
    ...overrides,
  };
}

export function stockMovementPayload(productId: string, overrides: Record<string, unknown> = {}) {
  return {
    productId,
    delta: 10,
    reason: 'restock',
    unitCostMinor: 1800,
    supplierId: null,
    saleId: null,
    note: null,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

export function creditorPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ama Serwaa',
    phone: null,
    email: null,
    dueDate: null,
    note: null,
    remindersOptedOut: false,
    source: 'manual',
    ...overrides,
  };
}

export function ledgerEntryPayload(creditorId: string, overrides: Record<string, unknown> = {}) {
  return {
    creditorId,
    kind: 'credit_sale',
    amountMinor: 5000,
    saleId: null,
    note: null,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}
