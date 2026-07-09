import type { GradingPeriod } from '../services/gradingApi';

export const ALL_GRADING_PERIODS = 'all';

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function endOfDayTime(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Chronological order by start date, then end date, then position. Mirrors the backend. */
export function sortPeriodsChronologically(periods: GradingPeriod[]): GradingPeriod[] {
  return [...periods].sort((a, b) => {
    const aKey = toTime(a.startDate) ?? toTime(a.endDate);
    const bKey = toTime(b.startDate) ?? toTime(b.endDate);
    if (aKey != null && bKey != null && aKey !== bKey) return aKey - bKey;
    if (aKey != null && bKey == null) return -1;
    if (aKey == null && bKey != null) return 1;
    return (a.position ?? 0) - (b.position ?? 0);
  });
}

/**
 * Canvas "current grading period" default:
 * 1. Period containing today. 2. Most recent ended period.
 * 3. Earliest upcoming period. 4. Last period. Null when none.
 */
export function resolveCurrentGradingPeriodId(periods: GradingPeriod[]): string | null {
  if (!periods || periods.length === 0) return null;
  const sorted = sortPeriodsChronologically(periods);
  const now = Date.now();

  for (const p of sorted) {
    const start = toTime(p.startDate);
    const end = endOfDayTime(p.endDate);
    const afterStart = start == null || now >= start;
    const beforeEnd = end == null || now <= end;
    if (afterStart && beforeEnd) return p._id;
  }

  const ended = sorted.filter((p) => {
    const end = endOfDayTime(p.endDate);
    return end != null && now > end;
  });
  if (ended.length) return ended[ended.length - 1]._id;

  const upcoming = sorted.filter((p) => {
    const start = toTime(p.startDate);
    return start != null && now < start;
  });
  if (upcoming.length) return upcoming[0]._id;

  return sorted[sorted.length - 1]._id;
}

/** A period is locked for grade edits when explicitly closed or its close date has passed. */
export function isGradingPeriodClosed(period?: GradingPeriod | null): boolean {
  if (!period) return false;
  if (period.closed === true) return true;
  const close = toTime(period.closeDate);
  return close != null && Date.now() > close;
}

/** Human-readable date range label, e.g. "Jan 1 – Mar 31". */
export function formatPeriodRange(period: GradingPeriod): string {
  const fmt = (v?: string | null) =>
    v
      ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
  const start = fmt(period.startDate);
  const end = fmt(period.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return 'No dates';
}
