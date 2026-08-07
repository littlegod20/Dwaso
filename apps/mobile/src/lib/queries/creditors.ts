import { useQuery } from '@tanstack/react-query';
import type { CreditorStatus, LedgerEntryKind } from '@dwaso/shared-types';
import { creditorTiming } from '@dwaso/domain';
import { getDatabase } from '../db';
import { queryKeys } from './keys';

export type CreditorListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  dueDate: string | null;
  remindersOptedOut: boolean;
  balanceMinor: number;
  status: CreditorStatus;
  daysOverdue: number | null;
  daysUntilDue: number | null;
  lastPaymentAt: string | null;
};

type CreditorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  dueDate: string | null;
  remindersOptedOut: number;
  balanceMinor: number | null;
  lastPaymentAt: string | null;
};

/**
 * Balance is a sum over the ledger, mirroring the server's projection. Positive
 * entries add to the debt and payments are negative, so the number converges to
 * the same value no matter what order two devices' entries eventually arrive in.
 */
const CREDITOR_SELECT = `
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    c.note,
    c.dueDate,
    c.remindersOptedOut,
    COALESCE((
      SELECT SUM(e.amountMinor) FROM credit_ledger_entries e
      WHERE e.creditorId = c.id AND e.deletedAt IS NULL
    ), 0) AS balanceMinor,
    (
      SELECT MAX(e.occurredAt) FROM credit_ledger_entries e
      WHERE e.creditorId = c.id AND e.kind = 'payment' AND e.deletedAt IS NULL
    ) AS lastPaymentAt
  FROM creditors c
  WHERE c.deletedAt IS NULL
`;

function decorate(row: CreditorRow): CreditorListItem {
  const balanceMinor = Number(row.balanceMinor ?? 0);
  const timing = creditorTiming(balanceMinor, row.dueDate);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    note: row.note,
    dueDate: row.dueDate,
    remindersOptedOut: row.remindersOptedOut === 1,
    balanceMinor,
    lastPaymentAt: row.lastPaymentAt,
    ...timing,
  };
}

export async function listCreditors(): Promise<CreditorListItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CreditorRow>(
    `${CREDITOR_SELECT} ORDER BY c.name COLLATE NOCASE`,
  );
  return rows.map(decorate);
}

export function useCreditors() {
  return useQuery({ queryKey: queryKeys.creditors, queryFn: listCreditors });
}

export function useCreditor(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.creditor(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const db = await getDatabase();
      const row = await db.getFirstAsync<CreditorRow>(`${CREDITOR_SELECT} AND c.id = ?`, id!);
      return row ? decorate(row) : null;
    },
  });
}

export type LedgerHistoryEntry = {
  id: string;
  kind: LedgerEntryKind;
  amountMinor: number;
  note: string | null;
  occurredAt: string;
};

export function useCreditorHistory(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.creditorHistory(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<LedgerHistoryEntry[]> => {
      const db = await getDatabase();

      return db.getAllAsync<LedgerHistoryEntry>(
        `SELECT id, kind, amountMinor, note, occurredAt
         FROM credit_ledger_entries
         WHERE creditorId = ? AND deletedAt IS NULL
         ORDER BY occurredAt DESC
         LIMIT 50`,
        id!,
      );
    },
  });
}
