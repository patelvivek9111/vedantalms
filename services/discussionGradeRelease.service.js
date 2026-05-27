const discussionGradeVisibility = require('./discussionGradeVisibility.service');

function applyDiscussionGradeRelease(thread, { release = false, hide = false } = {}) {
  if (!thread) return thread;
  if (hide) {
    thread.discussionReleaseMode = 'hidden';
    thread.gradeHidden = true;
    thread.gradesReleasedAt = null;
    return thread;
  }
  if (release) {
    thread.discussionReleaseMode = 'manual';
    thread.gradeHidden = false;
    thread.gradesReleasedAt = new Date();
    return thread;
  }
  return thread;
}

function visibleDiscussionGradeForStudent(thread, studentId) {
  return discussionGradeVisibility.discussionGradeForTotals(thread, studentId);
}

module.exports = {
  applyDiscussionGradeRelease,
  visibleDiscussionGradeForStudent,
};
