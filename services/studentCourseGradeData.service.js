const {
  loadCourseGradeAssignments,
  buildStudentGradeInputs,
  loadGroupSubmissionsForStudent,
} = require('./gradeCalculationInputs.service');

/**
 * Build assignment list, grades map, and submission map for canonical grade calculation.
 * Uses the same assignment catalog and visibility rules as the instructor gradebook.
 */
async function buildStudentCourseGradeContext(course, studentId) {
  const courseId = course._id || course.id;
  const assignments = await loadCourseGradeAssignments(courseId);
  return buildStudentGradeInputs(course, studentId, assignments, 'student');
}

module.exports = {
  buildStudentCourseGradeContext,
  loadGroupSubmissionsForStudent,
};
