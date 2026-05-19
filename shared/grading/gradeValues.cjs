const { EXCUSED_GRADE } = require('./constants.cjs');

function isExcusedGrade(grade, submission) {
  if (grade === EXCUSED_GRADE || grade === 'excused') return true;
  if (submission && submission.excused === true) return true;
  return false;
}

/**
 * Resolve grade for gradebook maps from submission or discussion row.
 * @returns {number|'excused'|null}
 */
function resolveAssignmentGrade({ submission, discussionGradeRow }) {
  if (submission?.excused === true) return EXCUSED_GRADE;
  if (discussionGradeRow?.excused === true) return EXCUSED_GRADE;
  if (submission) {
    if (submission.useIndividualGrades && submission.memberGrades && submission._memberStudentId) {
      const memberGrade = submission.memberGrades.find((mg) => {
        const memberId = mg.student && (mg.student._id || mg.student);
        return memberId && String(memberId) === String(submission._memberStudentId);
      });
      if (memberGrade?.excused) return EXCUSED_GRADE;
      if (typeof memberGrade?.grade === 'number') return memberGrade.grade;
      return null;
    }
    if (typeof submission.grade === 'number') return submission.grade;
  }
  if (discussionGradeRow) {
    if (discussionGradeRow.excused) return EXCUSED_GRADE;
    if (typeof discussionGradeRow.grade === 'number') return discussionGradeRow.grade;
  }
  return null;
}

/**
 * Populate grades[studentId] from assignment rows (matches grades.controller / reports).
 */
function buildGradesMapForStudent(grades, studentId, allAssignments) {
  const sid = String(studentId);
  if (!grades[sid]) grades[sid] = {};
  for (const assignment of allAssignments) {
    const aid = String(assignment._id);
    const val = assignment.grade;
    if (val === EXCUSED_GRADE || val === 'excused') {
      grades[sid][aid] = EXCUSED_GRADE;
    } else if (typeof val === 'number') {
      grades[sid][aid] = val;
    }
  }
  return grades;
}

module.exports = {
  EXCUSED_GRADE,
  isExcusedGrade,
  resolveAssignmentGrade,
  buildGradesMapForStudent,
};
