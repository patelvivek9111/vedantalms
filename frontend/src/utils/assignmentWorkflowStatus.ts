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

export interface AssignmentWorkflowInput {
  assignment: any;
  submission?: any | null;
  module?: any | null;
  now?: Date;
}

function hasGrade(submission: any): boolean {
  return Boolean(
    submission?.excused === true ||
      typeof submission?.grade === 'number' ||
      typeof submission?.finalGrade === 'number' ||
      typeof submission?.autoGrade === 'number'
  );
}

function hasSubmission(submission: any): boolean {
  return Boolean(submission && (submission._id || submission.submittedAt || submission.attemptStatus));
}

function scoreVisible(submission: any, assignment: any): boolean {
  if (!submission || !hasGrade(submission)) return false;
  if (submission.gradeHidden === true) return false;
  if (submission.gradeVisibility?.scoreVisible === true) return true;
  if (submission.gradesReleasedAt) return true;
  const mode = assignment?.gradeReleaseMode || 'immediate';
  if (mode === 'manual') return false;
  if (assignment?.defaultGradeHidden === true) return false;
  return true;
}

export function resolveAssignmentWorkflowStatus({
  assignment,
  submission = null,
  module = null,
  now = new Date(),
}: AssignmentWorkflowInput): AssignmentWorkflowStatus {
  if (!assignment) return 'not_published';
  if (submission?.excused === true) return 'excused';
  if (module && module.published === false) return 'not_published';
  if (!assignment.isDiscussion && assignment.published === false) return 'not_published';

  if (assignment.availableFrom) {
    const availableFrom = new Date(assignment.availableFrom);
    if (Number.isFinite(availableFrom.getTime()) && now < availableFrom) return 'not_available';
  }

  if (submission?.attemptStatus === 'in_progress') return 'in_progress';
  if (hasGrade(submission)) return scoreVisible(submission, assignment) ? 'graded_released' : 'graded_pending';
  if (hasSubmission(submission)) return 'submitted';

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  if (dueDate && Number.isFinite(dueDate.getTime()) && now > dueDate) {
    return assignment.lockAfterDue === false ? 'late' : 'missing';
  }

  return 'not_submitted';
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
