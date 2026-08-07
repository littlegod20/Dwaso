import type { CreditorListItem } from '@/lib/queries/creditors';

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

const plural = (days: number) => (days === 1 ? 'day' : 'days');

export function getCreditorStatusMeta(
  creditor: Pick<CreditorListItem, 'status' | 'daysOverdue' | 'daysUntilDue' | 'dueDate'>,
): {
  label: string;
  variant: 'danger' | 'neutral' | 'success';
} {
  switch (creditor.status) {
    case 'overdue':
      return {
        label: `Overdue by ${creditor.daysOverdue} ${plural(creditor.daysOverdue ?? 0)}`,
        variant: 'danger',
      };
    case 'upcoming':
      // A creditor with a balance but no due date is still owing; saying "due in
      // null days" would be worse than saying nothing about the timing.
      return {
        label:
          creditor.daysUntilDue === null
            ? 'No due date set'
            : `Due in ${creditor.daysUntilDue} ${plural(creditor.daysUntilDue)}`,
        variant: 'neutral',
      };
    case 'clear':
      return { label: 'Paid in full', variant: 'success' };
  }
}
