const observability = require('./workflowObservability.service');

function hasScore(submission) {
  return (
    submission?.excused === true ||
    typeof submission?.grade === 'number' ||
    typeof submission?.finalGrade === 'number' ||
    typeof submission?.autoGrade === 'number' ||
    (Array.isArray(submission?.memberGrades) &&
      submission.memberGrades.some((memberGrade) => typeof memberGrade?.grade === 'number' || memberGrade?.excused))
  );
}

function releaseModeForAssignment(assignment) {
  return assignment?.gradeReleaseMode || 'immediate';
}

function isReleased(submission, assignment) {
  if (!submission || !hasScore(submission)) return false;
  if (submission.gradeHidden === true) return false;
  if (submission.gradesReleasedAt) return true;

  const mode = releaseModeForAssignment(assignment);
  if (mode === 'manual') return false;
  if (mode === 'on_grade') return typeof submission.grade === 'number' || submission.excused === true;
  return assignment?.defaultGradeHidden === true ? false : true;
}

function feedbackReleased(submission, assignment) {
  if (!isReleased(submission, assignment)) return false;
  if (submission.feedbackReleasedAt) return true;
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

function mapFieldToObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  if (value && typeof value === 'object') return { ...value };
  return value;
}

function redactSubmissionForStudent(submission, assignment) {
  if (!submission) return submission;
  const visibility = resolveStudentGradeVisibility(submission, assignment);
  const payload = submission.toObject ? submission.toObject() : { ...submission };
  payload.answers = mapFieldToObject(payload.answers);
  payload.autoQuestionGrades = mapFieldToObject(payload.autoQuestionGrades);
  payload.questionGrades = mapFieldToObject(payload.questionGrades);
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
    payload.teacherApproved = false;
    payload.gradeHidden = true;
    return payload;
  }

  if (!visibility.feedbackVisible) {
    delete payload.questionGrades;
    delete payload.autoQuestionGrades;
    delete payload.feedback;
    payload.showCorrectAnswers = false;
    payload.showStudentAnswers = false;
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
