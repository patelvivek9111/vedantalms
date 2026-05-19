const { isExcusedGrade } = require('./gradeValues.cjs');

/**
 * Gradebook / export cell label + color marker (canonical).
 */
function getGradebookCellForExport(
  student,
  assignment,
  grades,
  submissionMap,
  studentSubmissions = []
) {
  const sid = String(student._id);
  const aid = String(assignment._id);
  const submissionKey = `${sid}_${aid}`;
  const grade =
    grades[sid]?.[aid] ??
    grades[student._id]?.[assignment._id] ??
    grades[sid]?.[assignment._id];

  const hasSubmission = assignment.isDiscussion
    ? Array.isArray(assignment.replies) &&
      assignment.replies.some(
        (r) => r.author && (r.author._id === student._id || r.author === student._id)
      )
    : !!submissionMap[submissionKey];

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const now = new Date();

  let submittedAt = null;
  if (assignment.isDiscussion) {
    if (Array.isArray(assignment.replies)) {
      const reply = assignment.replies.find(
        (r) => r.author && (r.author._id === student._id || r.author === student._id)
      );
      if (reply?.createdAt) submittedAt = new Date(reply.createdAt);
    }
  } else {
    const submissionId = submissionMap[submissionKey];
    if (submissionId && Array.isArray(studentSubmissions)) {
      const sub = studentSubmissions.find((s) => String(s._id) === String(submissionId));
      if (sub?.submittedAt) submittedAt = new Date(sub.submittedAt);
      if (isExcusedGrade(grade, sub)) {
        return { display: 'Excused', marker: 'GRAY' };
      }
    }
  }

  if (!assignment.isDiscussion && !assignment.published) {
    return { display: 'Not Published', marker: 'GRAY' };
  }

  if (isExcusedGrade(grade, null)) {
    return { display: 'Excused', marker: 'GRAY' };
  }

  if (typeof grade === 'number') {
    const maxPoints =
      (assignment.questions &&
        assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)) ||
      assignment.totalPoints ||
      0;
    const percentage = maxPoints > 0 ? (grade / maxPoints) * 100 : 0;
    let marker = 'GREEN';
    if (percentage < 60) marker = 'RED';
    else if (percentage < 70) marker = 'ORANGE';
    else if (percentage < 80) marker = 'YELLOW';
    const display = Number.isInteger(grade) ? String(grade) : Number(grade).toFixed(2);
    return { display, marker };
  }

  if (hasSubmission) {
    if (dueDate && submittedAt && submittedAt.getTime() > dueDate.getTime()) {
      return { display: 'Late', marker: 'ORANGE' };
    }
    return { display: 'Not Graded', marker: 'BLUE' };
  }

  if (assignment.isOfflineAssignment) {
    return { display: 'Add Grade', marker: 'PURPLE' };
  }

  if (dueDate && now.getTime() > dueDate.getTime()) {
    return { display: '0 (MA)', marker: 'RED' };
  }

  return { display: 'No Submission', marker: 'PENDING' };
}

module.exports = { getGradebookCellForExport };
