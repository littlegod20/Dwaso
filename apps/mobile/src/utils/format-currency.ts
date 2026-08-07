import { useCallback } from 'react';
import type { Currency } from '@dwaso/shared-types';
import { formatMoney, fromMinor, toMinor, type FormatMoneyOptions } from '@dwaso/domain';
import { useSessionStore } from '@/stores/session';

/**
 * Money formatting bound to the shop's own currency.
 *
 * The currency is chosen once at onboarding and applies to every figure in the
 * app, so it is read from the session rather than passed around. The formatting
 * itself lives in `@dwaso/domain` so the device and the server can never
 * disagree about how an amount reads.
 */
export function useMoney() {
  const currency = useSessionStore((state) => (state.shop?.currency ?? 'GHS') as Currency);

  const format = useCallback(
    (amountMinor: number, options?: FormatMoneyOptions) =>
      formatMoney(amountMinor, currency, options),
    [currency],
  );

  const parse = useCallback((amount: number) => toMinor(amount, currency), [currency]);
  const toMajor = useCallback((amountMinor: number) => fromMinor(amountMinor, currency), [currency]);

  return { currency, format, parse, toMajor };
}

/**
 * Formats an amount in minor units outside a React component.
 *
 * Takes the currency explicitly: a default here would silently print cedis for
 * a Nigerian trader, which is exactly the bug the shop-scoped hook above exists
 * to prevent.
 */
export function formatCurrency(amountMinor: number, currency: Currency): string {
  return formatMoney(amountMinor, currency);
}
