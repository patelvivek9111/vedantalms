const discussionWorkflow = require('./discussionWorkflow.service');
const discussionGradeVisibility = require('./discussionGradeVisibility.service');

function resolveDiscussionStatus(thread, { course = null, module = null, user = null, now = new Date(), finalized = false } = {}) {
  if (!thread || thread.deletedAt) return 'deleted';
  if (thread.moderationState === 'archived' || thread.archivedAt || course?.operationalStatus === 'archived') {
    return 'archived';
  }
  if (thread.published === false) return 'unpublished';
  const workflowState = discussionWorkflow.deriveDiscussionWorkflowState(thread, {
    course,
    module,
    now,
    finalized,
  });
  if (workflowState.locked) return 'locked';
  if (thread.isGraded) {
    const gradeRow = user?._id ? discussionGradeVisibility.findStudentGrade(thread, user._id) : null;
    if (gradeRow?.excused) return 'excused';
    const visibility = discussionGradeVisibility.resolveDiscussionGradeVisibility(thread, gradeRow);
    if (visibility.scoreVisible) return 'graded_released';
    if (gradeRow?.grade !== null && gradeRow?.grade !== undefined) return 'graded_pending_release';
  }
  return 'available';
}

function attachDiscussionStatus(payload, context = {}) {
  return {
    ...payload,
    discussionStatus: resolveDiscussionStatus(payload, context),
  };
}

module.exports = {
  attachDiscussionStatus,
  resolveDiscussionStatus,
};
