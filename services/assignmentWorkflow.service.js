const gradeReleaseService = require('./gradeRelease.service');

function hasGrade(submission) {
  return (
    submission?.excused === true ||
    typeof submission?.grade === 'number' ||
    typeof submission?.finalGrade === 'number' ||
    typeof submission?.autoGrade === 'number'
  );
}

function hasSubmission(submission) {
  return Boolean(submission && (submission._id || submission.submittedAt || submission.attemptStatus));
}

function resolveAssignmentWorkflowState({ assignment, submission = null, module = null, now = new Date() }) {
  if (!assignment) return 'not_published';

  if (submission?.excused === true) return 'excused';
  if (module && module.published === false) return 'not_published';
  if (!assignment.isDiscussion && assignment.published === false) return 'not_published';

  if (assignment.availableFrom) {
    const availableFrom = new Date(assignment.availableFrom);
    if (Number.isFinite(availableFrom.getTime()) && now < availableFrom) {
      return 'not_available';
    }
  }

  if (submission?.attemptStatus === 'in_progress') return 'in_progress';

  if (hasGrade(submission)) {
    const visibility = gradeReleaseService.resolveStudentGradeVisibility(submission, assignment);
    return visibility.scoreVisible ? 'graded_released' : 'graded_pending';
  }

  if (hasSubmission(submission)) return 'submitted';

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  if (dueDate && Number.isFinite(dueDate.getTime()) && now > dueDate) {
    return assignment.lockAfterDue === false ? 'late' : 'missing';
  }

  return 'not_submitted';
}

module.exports = {
  resolveAssignmentWorkflowState,
};
