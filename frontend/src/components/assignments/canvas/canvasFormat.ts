import { format, differenceInCalendarDays } from 'date-fns';

/** Canvas-style: "Apr 13 at 11:59pm" */
export function formatCanvasDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "MMM d 'at' h:mmaaa").replace(/\bam\b/i, 'am').replace(/\bpm\b/i, 'pm');
}

/** Canvas-style due: "Apr 13 by 11:59pm" or "Saturday by 11:59pm" when recent */
export function formatCanvasDue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "MMM d 'by' h:mmaaa").replace(/\bam\b/i, 'am').replace(/\bpm\b/i, 'pm');
}

export function formatCanvasAvailableRange(
  from: string | Date | null | undefined,
  until: string | Date | null | undefined
): string | null {
  if (!from && !until) return null;
  const start = from ? new Date(from) : null;
  const end = until ? new Date(until) : null;
  if (start && Number.isNaN(start.getTime())) return null;
  if (end && Number.isNaN(end.getTime())) return null;
  if (start && end) {
    const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
    return `${formatCanvasDateTime(start)} - ${formatCanvasDateTime(end)} ${days} days`;
  }
  if (start) return `from ${formatCanvasDateTime(start)}`;
  if (end) return `until ${formatCanvasDateTime(end)}`;
  return null;
}

export type CanvasAvailability =
  | { kind: 'locked_manual' }
  | { kind: 'locked_until'; until: Date }
  | { kind: 'locked_after'; at: Date }
  | { kind: 'open'; from: Date | null; due: Date | null; lockAt: Date | null };

/** Canvas effective lock: lockAt, else dueDate when lockAfterDue, else null. */
export function getEffectiveLockAt(assignment: {
  dueDate?: string | Date | null;
  lockAt?: string | Date | null;
  lockAfterDue?: boolean;
}): Date | null {
  if (assignment.lockAt) {
    const lockAt = new Date(assignment.lockAt);
    if (!Number.isNaN(lockAt.getTime())) return lockAt;
  }
  if (assignment.lockAfterDue !== false && assignment.dueDate) {
    const due = new Date(assignment.dueDate);
    if (!Number.isNaN(due.getTime())) return due;
  }
  return null;
}

export function resolveCanvasAvailability(
  assignment: {
    availableFrom?: string | Date | null;
    dueDate?: string | Date | null;
    lockAt?: string | Date | null;
    lockAfterDue?: boolean;
    locked?: boolean;
  },
  now: Date = new Date()
): CanvasAvailability {
  if (assignment.locked === true) {
    return { kind: 'locked_manual' };
  }

  const from = assignment.availableFrom ? new Date(assignment.availableFrom) : null;
  if (from && !Number.isNaN(from.getTime()) && now < from) {
    return { kind: 'locked_until', until: from };
  }

  const lockAt = getEffectiveLockAt(assignment);
  if (lockAt && now > lockAt) {
    return { kind: 'locked_after', at: lockAt };
  }

  const due = assignment.dueDate ? new Date(assignment.dueDate) : null;
  return {
    kind: 'open',
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    due: due && !Number.isNaN(due.getTime()) ? due : null,
    lockAt,
  };
}

export function resolveCanvasSubmittingLabel(assignment: {
  isOfflineAssignment?: boolean;
  isGradedQuiz?: boolean;
  quizSubmissionMode?: string;
  allowStudentUploads?: boolean;
  group?: string;
}): string {
  if (assignment.isOfflineAssignment) return 'on paper';
  if (assignment.isGradedQuiz && assignment.quizSubmissionMode === 'paper_upload') {
    return 'a file upload';
  }
  if (assignment.isGradedQuiz) return 'a quiz';
  if (assignment.allowStudentUploads) return 'a file upload';
  return 'on paper';
}

export const DEFAULT_CANVAS_FILE_TYPES = ['pdf', 'doc', 'docx'];

export const CANVAS_BLUE = '#0374B5';
export const CANVAS_BLUE_HOVER = '#0366a1';
export const CANVAS_BORDER = '#C7CDD1';
export const CANVAS_TEXT = '#2D3B45';
export const CANVAS_MUTED = '#6B7780';
