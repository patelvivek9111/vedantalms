const observability = require('./workflowObservability.service');
const discussionWorkflow = require('./discussionWorkflow.service');

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function findStudentGrade(thread, studentId) {
  const sid = normalizeId(studentId);
  return (thread?.studentGrades || []).find((row) => normalizeId(row.student) === sid) || null;
}

function resolveDiscussionGradeVisibility(thread, gradeRow) {
  const hasGrade = gradeRow?.excused === true || typeof gradeRow?.grade === 'number';
  if (!thread?.isGraded || !hasGrade) {
    return {
      mode: 'none',
      scoreVisible: false,
      feedbackVisible: false,
      releasedAt: null,
    };
  }

  if (!discussionWorkflow.isDiscussionGradeReleased(thread)) {
    observability.metric('discussion_hidden_grade_payload_block', {
      threadId: thread?._id ? String(thread._id) : null,
    });
    return {
      mode: 'hidden',
      scoreVisible: false,
      feedbackVisible: false,
      releasedAt: null,
    };
  }

  return {
    mode: 'score_and_feedback',
    scoreVisible: true,
    feedbackVisible: true,
    releasedAt: thread?.gradesReleasedAt || gradeRow?.gradedAt || null,
  };
}

function redactStudentGradeRow(thread, gradeRow) {
  const visibility = resolveDiscussionGradeVisibility(thread, gradeRow);
  const studentRef = gradeRow?.student ?? null;
  if (!gradeRow || !visibility.scoreVisible) {
    return {
      student: studentRef,
      gradeVisibility: visibility,
    };
  }

  return {
    student: studentRef,
    grade: gradeRow.grade,
    excused: gradeRow.excused === true,
    feedback: visibility.feedbackVisible ? gradeRow.feedback || null : null,
    gradedAt: gradeRow.gradedAt || null,
    gradeVisibility: visibility,
  };
}

function filterStudentGradesForUser(thread, user) {
  if (!thread || user?.role !== 'student') return thread?.studentGrades || [];
  const row = findStudentGrade(thread, user._id);
  const redacted = redactStudentGradeRow(thread, row);
  return redacted.gradeVisibility.mode === 'none' && !row ? [] : [redacted];
}

function discussionGradeForTotals(thread, studentId) {
  const row = findStudentGrade(thread, studentId);
  const visibility = resolveDiscussionGradeVisibility(thread, row);
  if (!visibility.scoreVisible) return null;
  return row;
}

function releaseDiscussionGrades(thread, options = {}) {
  const now = options.now || new Date();
  if (options.hideGrade === true || options.mode === 'hidden') {
    thread.gradeHidden = true;
    thread.gradesReleasedAt = null;
    thread.discussionReleaseMode = 'hidden';
    return thread;
  }
  if (options.releaseGrade === true || options.mode === 'immediate' || options.mode === 'manual') {
    thread.gradeHidden = false;
    thread.discussionReleaseMode = options.mode || thread.discussionReleaseMode || 'manual';
    thread.gradesReleasedAt = thread.gradesReleasedAt || now;
  }
  return thread;
}

module.exports = {
  discussionGradeForTotals,
  filterStudentGradesForUser,
  findStudentGrade,
  redactStudentGradeRow,
  releaseDiscussionGrades,
  resolveDiscussionGradeVisibility,
};
