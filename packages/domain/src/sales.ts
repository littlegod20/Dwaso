import { marginPercent } from './stock.js';

export type PricedLine = {
  quantity: number;
  unitPriceMinor: number;
  unitCostMinor: number;
};

export type SaleTotals = {
  totalMinor: number;
  costTotalMinor: number;
  marginMinor: number;
  marginPercent: number;
};

/**
 * Totals are computed from the lines rather than trusted from the client, and
 * the same function runs on the device so the optimistic figure a trader sees
 * before sync is byte-identical to the one the server stores.
 */
export function saleTotals(lines: PricedLine[]): SaleTotals {
  let totalMinor = 0;
  let costTotalMinor = 0;

  for (const line of lines) {
    totalMinor += line.unitPriceMinor * line.quantity;
    costTotalMinor += line.unitCostMinor * line.quantity;
  }

  return {
    totalMinor,
    costTotalMinor,
    marginMinor: totalMinor - costTotalMinor,
    marginPercent: marginPercent(totalMinor, costTotalMinor),
  };
}

/** Stock effect of a sale: one negative movement per line that names a product. */
export function saleStockDeltas(
  lines: (PricedLine & { productId: string | null })[],
): { productId: string; delta: number }[] {
  return lines
    .filter((line): line is PricedLine & { productId: string } => Boolean(line.productId))
    .map((line) => ({ productId: line.productId, delta: -line.quantity }));
}
