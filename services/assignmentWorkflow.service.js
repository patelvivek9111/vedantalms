const {
  resolveSubmissionGradeStatus,
  mapGradeStatusToWorkflowState,
} = require('../shared/grading/gradeStatus.cjs');

function resolveAssignmentWorkflowState({ assignment, submission = null, module = null, now = new Date() }) {
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
  });
}

module.exports = {
  resolveAssignmentWorkflowState,
};
