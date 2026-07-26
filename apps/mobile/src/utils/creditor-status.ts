import type { Creditor } from '@/mock-data/creditors';

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function getCreditorStatusMeta(creditor: Creditor): {
  label: string;
  variant: 'danger' | 'neutral' | 'success';
} {
  switch (creditor.status) {
    case 'overdue':
      return { label: `Overdue by ${creditor.daysOverdue} day${creditor.daysOverdue === 1 ? '' : 's'}`, variant: 'danger' };
    case 'upcoming':
      return { label: `Due in ${creditor.daysUntilDue} day${creditor.daysUntilDue === 1 ? '' : 's'}`, variant: 'neutral' };
    case 'paid':
      return { label: 'Paid in full', variant: 'success' };
  }
}
