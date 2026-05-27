import {
  ASSIGNMENT_STATUS_LABELS,
  resolveAssignmentWorkflowStatus,
  type AssignmentWorkflowStatus,
} from '../../utils/assignmentWorkflowStatus';

/**
 * Shared assignment status labels for student + instructor views (display only).
 * Kept as a compatibility wrapper; new surfaces should use assignmentWorkflowStatus directly.
 */

export type AssignmentDisplayStatus = AssignmentWorkflowStatus | 'offline' | 'graded' | 'no_submission';

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
  if (typeof input.grade === 'number') {
    return resolveAssignmentWorkflowStatus({
      assignment: input,
      submission: { grade: input.grade, gradesReleasedAt: new Date() },
    }) === 'graded_released'
      ? 'graded'
      : 'graded_pending';
  }
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
  ...ASSIGNMENT_STATUS_LABELS,
  graded: 'Graded',
  submitted: 'Submitted',
  late: 'Late',
  missing: 'Missing',
  not_published: 'Not available yet',
  not_available: 'Not available yet',
  not_submitted: 'Not submitted',
  in_progress: 'In progress',
  graded_pending: 'Awaiting release',
  graded_released: 'Graded',
  locked: 'Locked',
  offline: 'In class / offline',
  excused: 'Excused',
  no_submission: 'Not submitted',
};
