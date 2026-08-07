/**
 * Report buckets are calendar days in the *shop's* timezone, not UTC. A trader
 * in Accra closing at 8pm expects that evening's sales in today's total, and a
 * UTC bucket would be correct for a server nobody is looking at.
 */
export function shopDate(instant: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD, which is also the shape Postgres `date` wants.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function todayInShop(timezone: string): string {
  return shopDate(new Date(), timezone);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function daysAgo(date: string, days: number): string {
  return addDays(date, -days);
}

/** Inclusive list of ISO dates from `start` to `end`. */
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/**
 * Start of a reporting period, expressed as the number of days back from the
 * end date. Weekly is 7 days inclusive of today, which matches how the mobile
 * chart labels Mon-Sun.
 */
export function periodStart(endDate: string, period: 'daily' | 'weekly' | 'monthly'): string {
  const span = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  return addDays(endDate, -(span - 1));
}

export function periodLengthDays(period: 'daily' | 'weekly' | 'monthly'): number {
  return period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
}

/** Boundaries of a shop-local day as UTC instants, for range scans on timestamps. */
export function dayBoundsUtc(date: string, timezone: string): { start: Date; end: Date } {
  // Resolve the shop's UTC offset on that date by comparing the same instant
  // formatted in both zones, which handles DST without a timezone library.
  const probe = new Date(`${date}T12:00:00Z`);
  const local = new Date(probe.toLocaleString('en-US', { timeZone: timezone }));
  const utc = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = local.getTime() - utc.getTime();

  const start = new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
