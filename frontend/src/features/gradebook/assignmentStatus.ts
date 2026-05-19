/**
 * Shared assignment status labels for student + instructor views (display only).
 */

export type AssignmentDisplayStatus =
  | 'graded'
  | 'submitted'
  | 'late'
  | 'missing'
  | 'not_published'
  | 'offline'
  | 'excused'
  | 'no_submission';

export interface AssignmentStatusInput {
  published?: boolean;
  isDiscussion?: boolean;
  isOfflineAssignment?: boolean;
  dueDate?: string | Date | null;
  submittedAt?: string | Date | null;
  grade?: number | string | null;
  hasSubmission?: boolean;
  isExcused?: boolean;
}

export function resolveAssignmentDisplayStatus(input: AssignmentStatusInput): AssignmentDisplayStatus {
  if (input.isExcused) return 'excused';
  if (!input.isDiscussion && input.published === false) return 'not_published';
  if (typeof input.grade === 'number') return 'graded';
  if (input.hasSubmission) {
    const due = input.dueDate ? new Date(input.dueDate) : null;
    const sub = input.submittedAt ? new Date(input.submittedAt) : null;
    if (due && sub && sub.getTime() > due.getTime()) return 'late';
    return 'submitted';
  }
  if (input.isOfflineAssignment) return 'offline';
  const due = input.dueDate ? new Date(input.dueDate) : null;
  if (due && Date.now() > due.getTime()) return 'missing';
  return 'no_submission';
}

export const STATUS_STUDENT_LABEL: Record<AssignmentDisplayStatus, string> = {
  graded: 'Graded',
  submitted: 'Submitted',
  late: 'Late',
  missing: 'Missing',
  not_published: 'Not available yet',
  offline: 'In class / offline',
  excused: 'Excused',
  no_submission: 'Not submitted',
};
