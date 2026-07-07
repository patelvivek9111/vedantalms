import {
  resolveSubmissionGradeStatus,
  mapGradeStatusToWorkflowState,
  GRADE_STATUS,
  GRADE_STATUS_LABELS,
  getGradeStatusLabel,
  shouldShowStudentStatusBadge,
  type GradeStatus,
} from '@lms-shared/grading';

export type AssignmentWorkflowStatus =
  | 'not_published'
  | 'not_available'
  | 'not_submitted'
  | 'in_progress'
  | 'submitted'
  | 'graded_pending'
  | 'graded_released'
  | 'late'
  | 'missing'
  | 'excused'
  | 'locked';

export type { GradeStatus };

export { GRADE_STATUS, GRADE_STATUS_LABELS, getGradeStatusLabel, shouldShowStudentStatusBadge };

export interface AssignmentWorkflowInput {
  assignment: any;
  submission?: any | null;
  module?: any | null;
  now?: Date;
}

export function resolveAssignmentWorkflowStatus({
  assignment,
  submission = null,
  module = null,
  now = new Date(),
}: AssignmentWorkflowInput): AssignmentWorkflowStatus {
  const statusResult = resolveSubmissionGradeStatus({
    assignment,
    submission,
    now,
    perspective: 'student',
  });

  return mapGradeStatusToWorkflowState(statusResult, {
    assignment,
    submission,
    module,
    now,
  }) as AssignmentWorkflowStatus;
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentWorkflowStatus, string> = {
  not_published: 'Not published',
  not_available: 'Not available yet',
  not_submitted: 'Not submitted',
  in_progress: 'In progress',
  submitted: 'Submitted',
  graded_pending: 'Awaiting release',
  graded_released: 'Graded',
  late: 'Late',
  missing: 'Missing',
  excused: 'Excused',
  locked: 'Locked',
};
