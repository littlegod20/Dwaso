import { describe, expect, it } from 'vitest';
import {
  applyMovements,
  marginPercent,
  productStatus,
  reconciliationDelta,
  shrinkageValueMinor,
} from './stock.js';

describe('applyMovements', () => {
  it('is a plain sum so offline appends from two devices commute', () => {
    expect(applyMovements([{ delta: 10 }, { delta: -3 }, { delta: -2 }])).toBe(5);
    expect(applyMovements([{ delta: -2 }, { delta: 10 }, { delta: -3 }])).toBe(5);
  });

  it('starts at zero for a product that has never moved', () => {
    expect(applyMovements([])).toBe(0);
  });
});

describe('productStatus', () => {
  it('treats the threshold as inclusive', () => {
    expect(productStatus(5, 5)).toBe('low');
    expect(productStatus(6, 5)).toBe('in-stock');
    expect(productStatus(0, 5)).toBe('out-of-stock');
  });
});

describe('marginPercent', () => {
  it('is a share of the selling price', () => {
    expect(marginPercent(2500, 1800)).toBe(28);
  });

  it('returns 0 for a giveaway rather than dividing by zero', () => {
    expect(marginPercent(0, 1800)).toBe(0);
  });
});

describe('reconciliation', () => {
  it('derives the delta so the trader never subtracts by hand', () => {
    expect(reconciliationDelta(20, 17)).toBe(-3);
  });

  it('values shrinkage at cost', () => {
    expect(shrinkageValueMinor(-3, 1800)).toBe(-5400);
  });
});
