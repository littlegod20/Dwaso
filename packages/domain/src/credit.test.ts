import { describe, expect, it } from 'vitest';
import { creditorBalance, creditorTiming, daysBetween } from './credit.js';

describe('creditorBalance', () => {
  it('sums signed entries so a payment is just a negative amount', () => {
    expect(
      creditorBalance([{ amountMinor: 5000 }, { amountMinor: 2000 }, { amountMinor: -3000 }]),
    ).toBe(4000);
  });
});

describe('daysBetween', () => {
  it('compares dates at UTC midnight so a clock a few hours off cannot shift a day', () => {
    expect(daysBetween(new Date('2026-08-01T23:00:00Z'), new Date('2026-08-03T01:00:00Z'))).toBe(2);
  });
});

describe('creditorTiming', () => {
  const now = new Date('2026-08-07T12:00:00Z');

  it('is clear once the balance is settled, even with a past due date', () => {
    expect(creditorTiming(0, '2026-08-01', now).status).toBe('clear');
  });

  it('marks an unpaid past due date overdue', () => {
    const timing = creditorTiming(5000, '2026-08-01', now);
    expect(timing.status).toBe('overdue');
    expect(timing.daysOverdue).toBe(6);
  });

  it('counts days until a future due date', () => {
    const timing = creditorTiming(5000, '2026-08-10', now);
    expect(timing.status).toBe('upcoming');
    expect(timing.daysUntilDue).toBe(3);
  });
});
