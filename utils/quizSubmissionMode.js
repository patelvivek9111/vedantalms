const QUIZ_SUBMISSION_MODES = ['online', 'paper_upload'];

function parseQuizSubmissionMode(value, isGradedQuiz) {
  if (!isGradedQuiz) return 'online';
  if (value === 'paper_upload') return 'paper_upload';
  return 'online';
}

function isPaperUploadQuiz(assignment) {
  return Boolean(
    assignment &&
      assignment.isGradedQuiz &&
      assignment.quizSubmissionMode === 'paper_upload'
  );
}

function applyPaperUploadQuizFields(target) {
  target.quizSubmissionMode = 'paper_upload';
  target.allowStudentUploads = true;
  target.isTimedQuiz = false;
  target.quizTimeLimit = null;
  target.questions = [];
  if (!target.gradeReleaseMode || target.gradeReleaseMode === 'immediate') {
    target.gradeReleaseMode = 'manual';
  }
  target.defaultGradeHidden = true;
  return target;
}

function validatePaperUploadQuizPayload(payload) {
  const errors = [];
  if (!payload.isGradedQuiz) {
    errors.push('Paper upload mode requires a graded quiz');
  }
  const total = Number(payload.totalPoints);
  if (!Number.isFinite(total) || total <= 0) {
    errors.push('Total points must be greater than zero for paper upload quizzes');
  }
  return errors;
}

module.exports = {
  QUIZ_SUBMISSION_MODES,
  parseQuizSubmissionMode,
  isPaperUploadQuiz,
  applyPaperUploadQuizFields,
  validatePaperUploadQuizPayload,
};
