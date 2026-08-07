import type { Currency } from '@dwaso/shared-types';

type CurrencyMeta = {
  symbol: string;
  /** Number of decimal places; all supported currencies happen to use 2, but
   * reading it from here means adding a 0-decimal currency later is a data
   * change rather than a hunt through formatting code. */
  exponent: number;
  symbolFirst: boolean;
};

export const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  GHS: { symbol: '₵', exponent: 2, symbolFirst: true },
  NGN: { symbol: '₦', exponent: 2, symbolFirst: true },
  USD: { symbol: '$', exponent: 2, symbolFirst: true },
  EUR: { symbol: '€', exponent: 2, symbolFirst: true },
};

export function minorUnitFactor(currency: Currency): number {
  return 10 ** CURRENCY_META[currency].exponent;
}

/**
 * Converts a user-entered major amount ("8.50") to minor units. Multiplying a
 * float by 100 gives 849.9999 for some inputs, so the rounding is explicit and
 * happens exactly once, here, rather than wherever a form is parsed.
 */
export function toMinor(amount: number, currency: Currency): number {
  return Math.round(amount * minorUnitFactor(currency));
}

export function fromMinor(amountMinor: number, currency: Currency): number {
  return amountMinor / minorUnitFactor(currency);
}

export type FormatMoneyOptions = {
  /** Omits the currency symbol, for inputs and tables that label it separately. */
  bare?: boolean;
  /** Renders 1_234_500 as "₵12.3k" for dense chart axes. */
  compact?: boolean;
  showSign?: boolean;
};

/**
 * The single money formatter for the whole product. The mobile app previously
 * hardcoded the cedi symbol regardless of the currency chosen at onboarding,
 * which silently mislabels every figure for a trader outside Ghana.
 */
export function formatMoney(
  amountMinor: number,
  currency: Currency,
  options: FormatMoneyOptions = {},
): string {
  const meta = CURRENCY_META[currency];
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);

  let body: string;

  if (options.compact && absolute >= 100_000 * 10 ** (meta.exponent - 2)) {
    const major = absolute / minorUnitFactor(currency);
    body = major >= 1_000_000 ? `${trim(major / 1_000_000)}m` : `${trim(major / 1_000)}k`;
  } else {
    const major = Math.floor(absolute / minorUnitFactor(currency));
    const fraction = absolute % minorUnitFactor(currency);
    body =
      meta.exponent === 0
        ? groupDigits(major)
        : `${groupDigits(major)}.${String(fraction).padStart(meta.exponent, '0')}`;
  }

  const sign = negative ? '-' : options.showSign ? '+' : '';
  if (options.bare) return `${sign}${body}`;

  return meta.symbolFirst ? `${sign}${meta.symbol}${body}` : `${sign}${body}${meta.symbol}`;
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

function groupDigits(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Percentage change between two periods. Returns null rather than Infinity when
 * the baseline is zero, because "up ∞%" from a shop's first day of trading is
 * not a number worth showing anyone.
 */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / Math.abs(previous)) * 100);
}

/** Rounding is centralised so client and server never disagree in the last
 * decimal place, which would make figures flicker after every sync. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
