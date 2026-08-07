import { AppError } from './errors.js';

/**
 * Phone numbers are the account identifier, so normalisation has to be exact:
 * "0244123456", "244123456" and "+233244123456" are the same trader and must
 * collapse to one row, or a user re-registering with a different format would
 * silently get a second empty shop.
 */
type CountryRule = {
  callingCode: string;
  nationalLength: number;
  trunkPrefix: string;
};

const COUNTRY_RULES: Record<string, CountryRule> = {
  GH: { callingCode: '233', nationalLength: 9, trunkPrefix: '0' },
  NG: { callingCode: '234', nationalLength: 10, trunkPrefix: '0' },
  KE: { callingCode: '254', nationalLength: 9, trunkPrefix: '0' },
  ZA: { callingCode: '27', nationalLength: 9, trunkPrefix: '0' },
};

export type CountryCode = keyof typeof COUNTRY_RULES;

export const DEFAULT_COUNTRY: CountryCode = 'GH';

export function normalisePhone(input: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const rule = COUNTRY_RULES[country];
  if (!rule) throw AppError.badRequest(`Unsupported country code: ${country}`);

  const hadPlus = input.trim().startsWith('+');
  const digits = input.replace(/\D/g, '');

  if (!digits) throw AppError.badRequest('Phone number is required');

  let national: string;

  if (hadPlus || digits.startsWith(rule.callingCode)) {
    const withoutCallingCode = digits.startsWith(rule.callingCode)
      ? digits.slice(rule.callingCode.length)
      : digits;
    national = withoutCallingCode;
  } else if (digits.startsWith(rule.trunkPrefix)) {
    national = digits.slice(rule.trunkPrefix.length);
  } else {
    national = digits;
  }

  // A leading trunk prefix can survive the calling-code strip on numbers written
  // as +233 0244 123 456, which is common in hand-entered contact lists.
  if (national.length === rule.nationalLength + 1 && national.startsWith(rule.trunkPrefix)) {
    national = national.slice(rule.trunkPrefix.length);
  }

  if (national.length !== rule.nationalLength) {
    throw AppError.badRequest('Phone number is not valid for the selected country');
  }

  return `+${rule.callingCode}${national}`;
}

export function tryNormalisePhone(
  input: string,
  country: CountryCode = DEFAULT_COUNTRY,
): string | null {
  try {
    return normalisePhone(input, country);
  } catch {
    return null;
  }
}

/** Renders a number as "+233 ** *** 3456" for logs and support tooling. */
export function maskPhone(e164: string): string {
  if (e164.length < 4) return '***';
  return `${e164.slice(0, 4)}${'*'.repeat(Math.max(0, e164.length - 8))}${e164.slice(-4)}`;
}
