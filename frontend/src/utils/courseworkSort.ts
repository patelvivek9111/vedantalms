/**
 * Shared coursework ordering helpers.
 *
 * Mirrors the student "Overdue / Upcoming / Undated / Past" due-date grouping used by the
 * assignment list, but kept generic so discussion thread lists can reuse it. Intentionally
 * standalone — the assignment list keeps its own copy and is not affected by this file.
 */

export type DueCategory = 'overdue' | 'upcoming' | 'undated' | 'past';

interface DueSortable {
  dueDate?: string | null;
  title?: string;
  _id?: string;
}

const DUE_SECTIONS: { key: DueCategory; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'undated', label: 'Undated' },
  { key: 'past', label: 'Past' },
];

/** Earliest due date first; items without a due date last (tie-break by title, then id). */
export function sortItemsByDueDateAsc<T extends DueSortable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = a.dueDate ? new Date(a.dueDate).getTime() : NaN;
    const bt = b.dueDate ? new Date(b.dueDate).getTime() : NaN;
    const hasA = !Number.isNaN(at);
    const hasB = !Number.isNaN(bt);
    if (hasA && hasB) {
      const byDate = at - bt;
      if (byDate !== 0) return byDate;
    } else if (hasA && !hasB) {
      return -1;
    } else if (!hasA && hasB) {
      return 1;
    }
    const byTitle = (a.title || '').localeCompare(b.title || '');
    if (byTitle !== 0) return byTitle;
    return (a._id || '').localeCompare(b._id || '');
  });
}

/** Latest due date first, then earlier dates; items without a due date last. */
export function sortItemsByDueDateDesc<T extends DueSortable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = a.dueDate ? new Date(a.dueDate).getTime() : NaN;
    const bt = b.dueDate ? new Date(b.dueDate).getTime() : NaN;
    const hasA = !Number.isNaN(at);
    const hasB = !Number.isNaN(bt);
    if (hasA && hasB) {
      const byDate = bt - at;
      if (byDate !== 0) return byDate;
    } else if (hasA && !hasB) {
      return -1;
    } else if (!hasA && hasB) {
      return 1;
    }
    const byTitle = (a.title || '').localeCompare(b.title || '');
    if (byTitle !== 0) return byTitle;
    return (a._id || '').localeCompare(b._id || '');
  });
}

function sortItemsByTitle<T extends DueSortable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byTitle = (a.title || '').localeCompare(b.title || '');
    if (byTitle !== 0) return byTitle;
    return (a._id || '').localeCompare(b._id || '');
  });
}

/**
 * Group items into Overdue / Upcoming / Undated / Past sections (in that order), like the
 * student assignment view.
 *
 * - undated: no due date
 * - overdue: past due and not yet submitted/posted
 * - past:    past due and already submitted/posted
 * - upcoming: due date in the future
 *
 * Within a section: overdue/upcoming sort by soonest due first, past by most recent due first,
 * undated alphabetically. Empty sections are omitted.
 */
export function buildStudentDueGroups<T extends DueSortable>(
  items: T[],
  opts: {
    isSubmitted: (item: T) => boolean;
    itemNoun: string;
    now?: Date;
  }
): { key: DueCategory; label: string; items: T[] }[] {
  const now = opts.now ?? new Date();
  const buckets: Record<DueCategory, T[]> = {
    overdue: [],
    upcoming: [],
    undated: [],
    past: [],
  };

  for (const item of items) {
    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
    const hasDue = Boolean(dueDate && !Number.isNaN(dueDate.getTime()));
    let category: DueCategory;
    if (!hasDue) {
      category = 'undated';
    } else if (now > dueDate!) {
      category = opts.isSubmitted(item) ? 'past' : 'overdue';
    } else {
      category = 'upcoming';
    }
    buckets[category].push(item);
  }

  return DUE_SECTIONS.map(({ key, label }) => {
    let sorted: T[];
    if (key === 'overdue' || key === 'upcoming') {
      sorted = sortItemsByDueDateAsc(buckets[key]);
    } else if (key === 'past') {
      sorted = sortItemsByDueDateDesc(buckets[key]);
    } else {
      sorted = sortItemsByTitle(buckets[key]);
    }
    return { key, label: `${label} ${opts.itemNoun}`, items: sorted };
  }).filter((group) => group.items.length > 0);
}
