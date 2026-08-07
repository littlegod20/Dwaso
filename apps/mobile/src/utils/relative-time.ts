const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Human-readable elapsed time for activity feeds.
 *
 * Deliberately coarse. A trader glancing at her feed wants to know whether
 * something happened just now, earlier today, or another day — not the exact
 * minute, which would only make two entries seconds apart look meaningfully
 * different when they are not.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();

  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Formats an ISO date-only string ("2026-08-07") for display. */
export function formatDueDate(date: string | null): string {
  if (!date) return 'No due date';
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
