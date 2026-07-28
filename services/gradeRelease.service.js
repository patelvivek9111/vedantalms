const observability = require('./workflowObservability.service');
const { serializeSubmissionForApi } = require('../utils/submissionResponse');
const {
  isScoreReleased,
  releaseModeForAssignment,
} = require('../shared/grading/gradeStatus.cjs');

function isReleased(submission, assignment) {
  return isScoreReleased(submission, assignment);
}

/**
 * Whether quiz answer keys / per-question breakdown are visible to the student.
 * Overall written feedback and rubric comments ship with a visible score
 * (see redactSubmissionForStudent) — they are not gated by this flag.
 * Manual post: requires feedbackReleasedAt (or quiz reveal flags).
 * Immediate / on_grade: released with the visible score.
 */
function feedbackReleased(submission, assignment) {
  if (!isReleased(submission, assignment)) return false;
  if (submission.feedbackReleasedAt) return true;

  const mode = releaseModeForAssignment(assignment);
  if (mode !== 'manual') return true;

  return Boolean(
    submission.autoGraded ||
      assignment?.showCorrectAnswers ||
      assignment?.showStudentAnswers ||
      submission.showCorrectAnswers ||
      submission.showStudentAnswers
  );
}

function resolveStudentGradeVisibility(submission, assignment) {
  if (!isReleased(submission, assignment)) {
    return {
      mode: 'hidden',
      scoreVisible: false,
      feedbackVisible: false,
      releasedAt: null,
    };
  }

  const showFeedback = feedbackReleased(submission, assignment);
  return {
    mode: showFeedback ? 'score_and_feedback' : 'score_only',
    scoreVisible: true,
    feedbackVisible: showFeedback,
    releasedAt: submission?.gradesReleasedAt || null,
  };
}

function redactSubmissionForStudent(submission, assignment) {
  if (!submission) return submission;
  const visibility = resolveStudentGradeVisibility(submission, assignment);
  const payload = serializeSubmissionForApi(submission);
  payload.gradeVisibility = visibility;

  if (!visibility.scoreVisible) {
    observability.metric('hidden_grade_payload_block', {
      assignmentId: assignment?._id ? String(assignment._id) : null,
      submissionId: submission?._id ? String(submission._id) : null,
    });
    delete payload.grade;
    delete payload.finalGrade;
    delete payload.autoGrade;
    delete payload.questionGrades;
    delete payload.autoQuestionGrades;
    delete payload.feedback;
    delete payload.rubricAssessment;
    payload.teacherApproved = false;
    payload.gradeHidden = true;
    return payload;
  }

  if (!visibility.feedbackVisible) {
    // Hold back quiz answer keys / per-question grades until feedback is posted.
    // Overall written feedback + files ship with the visible grade (same as rubric comments).
    delete payload.questionGrades;
    delete payload.autoQuestionGrades;
    payload.showCorrectAnswers = false;
    payload.showStudentAnswers = false;
  }

  // Attach assignment rubric snapshot for student breakdown UI when present on populated assignment
  if (assignment?.rubric?.criteria?.length && payload.rubricAssessment) {
    payload.assignmentRubric = assignment.rubric;
  }

  return payload;
}

function applyReleaseFields(submission, options = {}) {
  const now = options.now || new Date();
  let changed = false;
  if (options.idempotencyKey && submission.lastReleaseIdempotencyKey === options.idempotencyKey) {
    return submission;
  }
  if (options.releaseGrade === true) {
    submission.gradesReleasedAt = submission.gradesReleasedAt || now;
    submission.gradeHidden = false;
    changed = true;
    observability.emitWorkflowEvent('grade_released', {
      submissionId: submission?._id ? String(submission._id) : null,
      assignmentId: submission?.assignment ? String(submission.assignment) : null,
    });
  }
  if (options.hideGrade === true) {
    submission.gradeHidden = true;
    submission.gradesReleasedAt = undefined;
    changed = true;
    observability.emitWorkflowEvent('grade_hidden', {
      submissionId: submission?._id ? String(submission._id) : null,
      assignmentId: submission?.assignment ? String(submission.assignment) : null,
    });
  }
  if (options.releaseFeedback === true) {
    submission.feedbackReleasedAt = submission.feedbackReleasedAt || now;
    changed = true;
  }
  if (changed) {
    submission.releaseRevision = (Number(submission.releaseRevision) || 0) + 1;
    if (options.idempotencyKey) {
      submission.lastReleaseIdempotencyKey = options.idempotencyKey;
    }
  }
  return submission;
}

module.exports = {
  resolveStudentGradeVisibility,
  redactSubmissionForStudent,
  applyReleaseFields,
};
