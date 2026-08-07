import type { CreditLedgerEntry, CreditorStatus } from '@dwaso/shared-types';

/**
 * A creditor's balance is the sum of their ledger entries — positive entries
 * increase the debt, payments are negative. Storing a running balance instead
 * would be unmergeable across devices and unauditable when a trader disputes it.
 */
export function creditorBalance(entries: Pick<CreditLedgerEntry, 'amountMinor'>[]): number {
  let balance = 0;
  for (const entry of entries) balance += entry.amountMinor;
  return balance;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between two calendar dates, compared at UTC midnight so a reminder
 * does not fire a day early for a trader whose device clock is a few hours off.
 */
export function daysBetween(from: Date, to: Date): number {
  const fromMidnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toMidnight = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toMidnight - fromMidnight) / MS_PER_DAY);
}

export type CreditorTiming = {
  status: CreditorStatus;
  daysOverdue: number | null;
  daysUntilDue: number | null;
};

export function creditorTiming(
  balanceMinor: number,
  dueDate: string | null,
  now: Date = new Date(),
): CreditorTiming {
  // A settled debt has no timing, even if its due date has long passed.
  if (balanceMinor <= 0) return { status: 'clear', daysOverdue: null, daysUntilDue: null };
  if (!dueDate) return { status: 'upcoming', daysOverdue: null, daysUntilDue: null };

  const days = daysBetween(new Date(`${dueDate}T00:00:00Z`), now);

  if (days > 0) return { status: 'overdue', daysOverdue: days, daysUntilDue: null };
  return { status: 'upcoming', daysOverdue: null, daysUntilDue: Math.abs(days) };
}

export function isOverdue(balanceMinor: number, dueDate: string | null, now?: Date): boolean {
  return creditorTiming(balanceMinor, dueDate, now).status === 'overdue';
}
