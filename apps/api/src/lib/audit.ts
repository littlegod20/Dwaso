import { auditLog } from '../db/schema/index.js';
import type { TenantContext, Transaction } from './tenant.js';

/**
 * The actions worth being able to answer questions about later.
 *
 * The list is short on purpose. An audit trail that records everything is one
 * nobody reads, and the only question this table exists to settle is the one a
 * trader actually asks: "who changed this number, and on whose phone?"
 */
export type AuditAction =
  | 'sale.recorded'
  | 'sale.voided'
  | 'payment.recorded'
  | 'creditor.adjusted'
  | 'creditor.written_off'
  | 'creditor.erased'
  | 'stock.reconciled'
  | 'price.changed'
  | 'shop.deleted';

export type AuditEntry = {
  action: AuditAction;
  entity?: string;
  entityId?: string;
  /**
   * Never put anything here that the trader could not be shown. Amounts and
   * quantities are the point; names and phone numbers are already in the rows
   * this entry points at, and copying them here would only spread personal data
   * into a table the retention job does not prune.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Writes an audit entry inside the caller's transaction.
 *
 * Being in the same transaction is what makes the trail trustworthy: an action
 * and its record either both happened or neither did. A best-effort write after
 * the fact would leave exactly the gaps that make an audit trail worthless in
 * the argument it was meant to settle.
 */
export async function recordAudit(
  tx: Transaction,
  tenant: TenantContext,
  entry: AuditEntry,
): Promise<void> {
  await tx.insert(auditLog).values({
    shopId: tenant.shopId,
    userId: tenant.userId,
    deviceId: tenant.deviceId,
    action: entry.action,
    entity: entry.entity ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
