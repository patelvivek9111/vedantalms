/**
 * Build assignment list, grades map, and submission map for canonical grade calculation.
 * Uses the same assignment catalog and visibility rules as the instructor gradebook.
 */
async function buildStudentCourseGradeContext(course, studentId) {
  const {
    loadCourseGradeAssignments,
    buildStudentGradeInputs,
  } = require('./gradeCalculationInputs.service');
  const courseId = course._id || course.id;
  const assignments = await loadCourseGradeAssignments(courseId);
  return buildStudentGradeInputs(course, studentId, assignments, 'student');
}

async function loadGroupSubmissionsForStudent(...args) {
  const { loadGroupSubmissionsForStudent: load } = require('./gradeCalculationInputs.service');
  return load(...args);
}

module.exports = {
  buildStudentCourseGradeContext,
  loadGroupSubmissionsForStudent,
};
