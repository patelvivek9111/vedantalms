/**
 * Canonical per-assignment grade status (Canvas parity Phase 4).
 * Centralizes scattered submission booleans and workflow strings.
 */
const { isExcusedGrade } = require('./gradeValues.cjs');
const { isUnpublished, assignmentMaxPoints } = require('./groupActivation.cjs');
const { resolveEffectivePolicyForAssignment } = require('./policyApplication.cjs');

const GRADE_STATUS = Object.freeze({
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  SUBMITTED: 'SUBMITTED',
  GRADED: 'GRADED',
  MISSING: 'MISSING',
  EXCUSED: 'EXCUSED',
  LATE: 'LATE',
  HIDDEN: 'HIDDEN',
  PENDING_REVIEW: 'PENDING_REVIEW',
  MANUAL_POST: 'MANUAL_POST',
  AUTO_POST: 'AUTO_POST',
  UNPUBLISHED: 'UNPUBLISHED',
  OFFLINE_PENDING: 'OFFLINE_PENDING',
});

const GRADE_STATUS_LABELS = Object.freeze({
  [GRADE_STATUS.NOT_SUBMITTED]: 'Not submitted',
  [GRADE_STATUS.SUBMITTED]: 'Submitted',
  [GRADE_STATUS.GRADED]: 'Graded',
  [GRADE_STATUS.MISSING]: 'Missing',
  [GRADE_STATUS.EXCUSED]: 'Excused',
  [GRADE_STATUS.LATE]: 'Late',
  [GRADE_STATUS.HIDDEN]: 'Hidden',
  [GRADE_STATUS.PENDING_REVIEW]: 'Pending review',
  [GRADE_STATUS.MANUAL_POST]: 'Awaiting release',
  [GRADE_STATUS.AUTO_POST]: 'Graded',
  [GRADE_STATUS.UNPUBLISHED]: 'Not published',
  [GRADE_STATUS.OFFLINE_PENDING]: 'Offline',
});

function hasSubmissionScore(submission) {
  return (
    submission?.excused === true ||
    typeof submission?.grade === 'number' ||
    typeof submission?.finalGrade === 'number' ||
    typeof submission?.autoGrade === 'number' ||
    (Array.isArray(submission?.memberGrades) &&
      submission.memberGrades.some(
        (memberGrade) => typeof memberGrade?.grade === 'number' || memberGrade?.excused
      ))
  );
}

function releaseModeForAssignment(assignment) {
  return assignment?.gradeReleaseMode || 'immediate';
}

function isDiscussionScoreVisibleToStudent(assignment) {
  if (!assignment?.isDiscussion) return null;
  const visibility = assignment.gradeVisibility;
  if (visibility?.scoreVisible === true) return true;
  if (visibility?.scoreVisible === false) return false;
  if (assignment.gradeHidden === true) return false;
  const mode = assignment.discussionReleaseMode || 'immediate';
  if (mode === 'hidden') return false;
  if (assignment.gradesReleasedAt) return true;
  return mode === 'immediate';
}

function isScoreReleased(submission, assignment) {
  const discussionVisible = isDiscussionScoreVisibleToStudent(assignment);
  if (discussionVisible !== null) return discussionVisible;

  if (!submission || !hasSubmissionScore(submission)) return false;
  if (submission.gradeHidden === true) return false;
  if (submission.gradesReleasedAt) return true;

  const mode = releaseModeForAssignment(assignment);
  if (mode === 'manual') return false;
  if (mode === 'on_grade') {
    return typeof submission.grade === 'number' || submission.excused === true;
  }
  return assignment?.defaultGradeHidden !== true;
}

function coerceDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function resolveSubmittedAt(assignment, submission, options = {}) {
  const hinted = coerceDate(options.submittedAt);
  if (hinted) return hinted;
  if (assignment?.isDiscussion) {
    const fromAssignment = coerceDate(assignment.studentReplyCreatedAt);
    if (fromAssignment) return fromAssignment;
  }
  const fromSubmission = coerceDate(submission?.submittedAt);
  if (fromSubmission) return fromSubmission;
  if (assignment?.isDiscussion && Array.isArray(assignment.replies) && options.studentId) {
    const sid = String(options.studentId);
    const reply = assignment.replies.find(
      (r) => r.author && (String(r.author._id) === sid || String(r.author) === sid)
    );
    if (reply?.createdAt) return new Date(reply.createdAt);
  }
  return null;
}

function isSubmissionLate(assignment, submittedAt, policy) {
  const dueDate = assignment?.dueDate ? new Date(assignment.dueDate) : null;
  const submitted = coerceDate(submittedAt);
  if (!dueDate || !submitted) return false;
  const graceHours = Number(policy?.latePenalty?.gracePeriodHours) || 0;
  return submitted.getTime() > dueDate.getTime() + graceHours * 60 * 60 * 1000;
}

function inferHasSubmission(assignment, submission, hasSubmissionHint) {
  if (typeof hasSubmissionHint === 'boolean') return hasSubmissionHint;
  if (assignment?.isDiscussion) {
    if (assignment.hasSubmitted === true) return true;
    if (Array.isArray(assignment.replies)) {
      return assignment.replies.some((r) => r.author);
    }
    return false;
  }
  return Boolean(
    submission && (submission._id || submission.submittedAt || submission.attemptStatus)
  );
}

/**
 * Resolve canonical grade status for one student × assignment.
 * @returns {{ status: string, score?: number, submittedAt?: Date|null }}
 */
function resolveSubmissionGradeStatus({
  assignment,
  submission = null,
  grade = undefined,
  now = new Date(),
  perspective = 'instructor',
  policy = null,
  studentId = null,
  hasSubmission: hasSubmissionHint = undefined,
  submittedAt: submittedAtHint = undefined,
}) {
  if (!assignment) {
    return { status: GRADE_STATUS.NOT_SUBMITTED };
  }

  if (isUnpublished(assignment)) {
    return { status: GRADE_STATUS.UNPUBLISHED };
  }

  if (isExcusedGrade(grade, submission)) {
    return { status: GRADE_STATUS.EXCUSED };
  }

  const submittedAt = resolveSubmittedAt(assignment, submission, {
    studentId,
    submittedAt: submittedAtHint,
  });
  const hasSubmission = inferHasSubmission(assignment, submission, hasSubmissionHint);

  if (typeof grade === 'number' && Number.isFinite(grade)) {
    if (perspective === 'student' && assignment?.isDiscussion) {
      const visible = isDiscussionScoreVisibleToStudent(assignment);
      if (!visible) {
        const mode = assignment.discussionReleaseMode || 'immediate';
        return {
          status: mode === 'manual' ? GRADE_STATUS.MANUAL_POST : GRADE_STATUS.HIDDEN,
          score: grade,
          submittedAt,
        };
      }
      return { status: GRADE_STATUS.GRADED, score: grade, submittedAt };
    }
    if (perspective === 'student' && !isScoreReleased(submission, assignment)) {
      const mode = releaseModeForAssignment(assignment);
      return {
        status: mode === 'manual' ? GRADE_STATUS.MANUAL_POST : GRADE_STATUS.HIDDEN,
        score: grade,
        submittedAt,
      };
    }
    const mode = releaseModeForAssignment(assignment);
    if (perspective === 'student' && mode !== 'manual' && isScoreReleased(submission, assignment)) {
      return { status: GRADE_STATUS.AUTO_POST, score: grade, submittedAt };
    }
    return { status: GRADE_STATUS.GRADED, score: grade, submittedAt };
  }

  if (hasSubmissionScore(submission)) {
    if (
      submission?.teacherApproved === false &&
      typeof submission?.autoGrade === 'number' &&
      typeof submission?.grade !== 'number'
    ) {
      return { status: GRADE_STATUS.PENDING_REVIEW, submittedAt };
    }

    if (perspective === 'student' && !isScoreReleased(submission, assignment)) {
      const mode = releaseModeForAssignment(assignment);
      return {
        status: mode === 'manual' ? GRADE_STATUS.MANUAL_POST : GRADE_STATUS.HIDDEN,
        submittedAt,
      };
    }

    const mode = releaseModeForAssignment(assignment);
    if (perspective === 'student' && mode !== 'manual' && isScoreReleased(submission, assignment)) {
      return { status: GRADE_STATUS.AUTO_POST, submittedAt };
    }
    return { status: GRADE_STATUS.GRADED, submittedAt };
  }

  if (hasSubmission) {
    const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
    const late = isSubmissionLate(assignment, submittedAt, policy);
    if (late) {
      return { status: GRADE_STATUS.LATE, submittedAt };
    }

    if (submittedAt || submission) {
      return { status: GRADE_STATUS.SUBMITTED, submittedAt };
    }

    const effectivePolicy = resolveEffectivePolicyForAssignment(
      policy,
      submission,
      assignment,
      'current'
    );
    const missingMode = effectivePolicy?.missingAssignment?.mode || 'count_as_zero';
    if (
      missingMode === 'count_as_zero' &&
      dueDate &&
      now.getTime() > dueDate.getTime()
    ) {
      return { status: GRADE_STATUS.MISSING, submittedAt };
    }

    return { status: GRADE_STATUS.SUBMITTED, submittedAt };
  }

  if (assignment.isOfflineAssignment) {
    return { status: GRADE_STATUS.OFFLINE_PENDING };
  }

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  if (dueDate && now.getTime() > dueDate.getTime()) {
    return { status: GRADE_STATUS.MISSING };
  }

  return { status: GRADE_STATUS.NOT_SUBMITTED };
}

function scoreMarkerForPercent(percentage) {
  if (percentage < 60) return 'RED';
  if (percentage < 70) return 'ORANGE';
  if (percentage < 80) return 'YELLOW';
  return 'GREEN';
}

function gradebookCellFromStatus(statusResult, { grade, assignment }) {
  const { status, score } = statusResult;

  switch (status) {
    case GRADE_STATUS.EXCUSED:
      return { display: 'Excused', marker: 'GRAY', status };
    case GRADE_STATUS.UNPUBLISHED:
      return { display: 'Not Published', marker: 'GRAY', status };
    case GRADE_STATUS.GRADED:
    case GRADE_STATUS.AUTO_POST: {
      const earned = typeof score === 'number' ? score : grade;
      const maxPoints = assignmentMaxPoints(assignment);
      const percentage = maxPoints > 0 ? (earned / maxPoints) * 100 : 0;
      const marker = scoreMarkerForPercent(percentage);
      const display = Number.isInteger(earned) ? String(earned) : Number(earned).toFixed(2);
      return { display, marker, status };
    }
    case GRADE_STATUS.LATE:
      return { display: 'Late', marker: 'ORANGE', status };
    case GRADE_STATUS.SUBMITTED:
    case GRADE_STATUS.PENDING_REVIEW:
    case GRADE_STATUS.MANUAL_POST:
    case GRADE_STATUS.HIDDEN:
      return { display: 'Not Graded', marker: 'BLUE', status };
    case GRADE_STATUS.OFFLINE_PENDING:
      return { display: 'Add Grade', marker: 'PURPLE', status };
    case GRADE_STATUS.MISSING:
      return { display: '0 (MA)', marker: 'RED', status };
    default:
      return { display: 'No Submission', marker: 'PENDING', status };
  }
}

const WORKFLOW_STATE_TO_GRADE_STATUS = Object.freeze({
  not_published: GRADE_STATUS.UNPUBLISHED,
  not_available: GRADE_STATUS.NOT_SUBMITTED,
  not_submitted: GRADE_STATUS.NOT_SUBMITTED,
  in_progress: GRADE_STATUS.SUBMITTED,
  submitted: GRADE_STATUS.SUBMITTED,
  graded_pending: GRADE_STATUS.MANUAL_POST,
  graded_released: GRADE_STATUS.GRADED,
  late: GRADE_STATUS.LATE,
  missing: GRADE_STATUS.MISSING,
  excused: GRADE_STATUS.EXCUSED,
  locked: GRADE_STATUS.NOT_SUBMITTED,
});

function mapWorkflowStateToGradeStatus(workflowState) {
  return WORKFLOW_STATE_TO_GRADE_STATUS[workflowState] || GRADE_STATUS.NOT_SUBMITTED;
}

function mapGradeStatusToWorkflowState(statusResult, { assignment, submission, module, now = new Date() }) {
  if (module && module.published === false) return 'not_published';
  if (assignment?.availableFrom) {
    const availableFrom = new Date(assignment.availableFrom);
    if (Number.isFinite(availableFrom.getTime()) && now < availableFrom) return 'not_available';
  }
  if (submission?.attemptStatus === 'in_progress') return 'in_progress';

  switch (statusResult.status) {
    case GRADE_STATUS.UNPUBLISHED:
      return 'not_published';
    case GRADE_STATUS.EXCUSED:
      return 'excused';
    case GRADE_STATUS.GRADED:
    case GRADE_STATUS.AUTO_POST:
      return 'graded_released';
    case GRADE_STATUS.MANUAL_POST:
    case GRADE_STATUS.HIDDEN:
    case GRADE_STATUS.PENDING_REVIEW:
      return 'graded_pending';
    case GRADE_STATUS.LATE:
      return assignment?.lockAfterDue === false ? 'late' : 'missing';
    case GRADE_STATUS.MISSING:
      return assignment?.lockAfterDue === false ? 'late' : 'missing';
    case GRADE_STATUS.SUBMITTED:
      return 'submitted';
    default:
      return 'not_submitted';
  }
}

function getGradeStatusLabel(status) {
  return GRADE_STATUS_LABELS[status] || status;
}

/** Student-facing surfaces show a badge only for non-graded states. */
function shouldShowStudentStatusBadge(status) {
  return [
    GRADE_STATUS.SUBMITTED,
    GRADE_STATUS.LATE,
    GRADE_STATUS.MISSING,
    GRADE_STATUS.EXCUSED,
    GRADE_STATUS.UNPUBLISHED,
    GRADE_STATUS.OFFLINE_PENDING,
  ].includes(status);
}

module.exports = {
  GRADE_STATUS,
  GRADE_STATUS_LABELS,
  hasSubmissionScore,
  releaseModeForAssignment,
  isScoreReleased,
  resolveSubmissionGradeStatus,
  gradebookCellFromStatus,
  mapWorkflowStateToGradeStatus,
  mapGradeStatusToWorkflowState,
  getGradeStatusLabel,
  shouldShowStudentStatusBadge,
};
