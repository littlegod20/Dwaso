import { describe, expect, it } from 'vitest';
import { changePercent, formatMoney, fromMinor, toMinor } from './money.js';

describe('toMinor / fromMinor', () => {
  it('rounds the float that would otherwise become 849.9999', () => {
    expect(toMinor(8.5, 'GHS')).toBe(850);
    expect(toMinor(8.499999, 'GHS')).toBe(850);
  });

  it('round-trips an amount the trader typed', () => {
    expect(fromMinor(toMinor(12.34, 'GHS'), 'GHS')).toBe(12.34);
  });
});

describe('formatMoney', () => {
  it('uses the shop currency rather than assuming cedis', () => {
    expect(formatMoney(1_250, 'NGN')).toBe('₦12.50');
    expect(formatMoney(1_250, 'GHS')).toBe('₵12.50');
  });

  it('groups thousands and preserves the sign a payment needs', () => {
    expect(formatMoney(1_234_500, 'GHS')).toBe('₵12,345.00');
    expect(formatMoney(-500, 'GHS', { showSign: true })).toBe('-₵5.00');
    expect(formatMoney(500, 'GHS', { showSign: true })).toBe('+₵5.00');
  });

  it('compacts dense chart axes without inventing precision', () => {
    expect(formatMoney(1_250_000, 'GHS', { compact: true })).toBe('₵12.5k');
  });
});

describe('changePercent', () => {
  it('returns null on a zero baseline rather than Infinity', () => {
    expect(changePercent(100, 0)).toBeNull();
  });

  it('rounds to one decimal so client and server agree after sync', () => {
    expect(changePercent(110, 100)).toBe(10);
    expect(changePercent(1, 3)).toBe(-66.7);
  });
});
