import type { ProductStatus, StockMovement } from '@dwaso/shared-types';
import { round1 } from './money.js';

/**
 * Stock is a fold over the movement log, never a stored counter. Addition
 * commutes, so movements appended offline on two devices merge to the same total
 * regardless of the order they eventually sync in.
 */
export function applyMovements(movements: Pick<StockMovement, 'delta'>[]): number {
  let quantity = 0;
  for (const movement of movements) quantity += movement.delta;
  return quantity;
}

export function productStatus(quantity: number, lowStockThreshold: number): ProductStatus {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= lowStockThreshold) return 'low';
  return 'in-stock';
}

export function isLowStock(quantity: number, lowStockThreshold: number): boolean {
  return productStatus(quantity, lowStockThreshold) !== 'in-stock';
}

export function marginMinor(sellPriceMinor: number, costPriceMinor: number): number {
  return sellPriceMinor - costPriceMinor;
}

/**
 * Margin as a share of the selling price. Returns 0 for a zero sell price rather
 * than dividing by zero — a giveaway line should read as no margin, not as a
 * broken figure on the trader's dashboard.
 */
export function marginPercent(sellPriceMinor: number, costPriceMinor: number): number {
  if (sellPriceMinor === 0) return 0;
  return round1((marginMinor(sellPriceMinor, costPriceMinor) / sellPriceMinor) * 100);
}

/**
 * The correction a physical count implies. The trader reports what is on the
 * shelf and the delta is derived here, so nobody has to do the subtraction and
 * the expected total is never overwritten by hand.
 */
export function reconciliationDelta(expected: number, counted: number): number {
  return counted - expected;
}

/** Value of a stock discrepancy at cost, which is what a loss actually costs. */
export function shrinkageValueMinor(delta: number, unitCostMinor: number): number {
  return delta * unitCostMinor;
}
