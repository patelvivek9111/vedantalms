/**
 * Legacy getWeightedGradeForStudent — deprecated; must not be used for gradebook/reports.
 */
const {
  calculateFinalGradeWithWeightedGroups,
  getWeightedGradeForStudent,
} = require('../../shared/grading/gradeCalculation.cjs');
const { buildGrades, buildCourse, buildAssignment, STUDENT_ID } = require('./fixtures');

describe('Legacy getWeightedGradeForStudent (deprecated)', () => {
  it('is not the canonical calculator and still returns a finite percent', () => {
    expect(getWeightedGradeForStudent).not.toBe(calculateFinalGradeWithWeightedGroups);

    const course = buildCourse([{ name: 'Assignments', weight: 100 }]);
    const assignments = [buildAssignment({ id: 'a1', group: 'Assignments' })];
    const grades = buildGrades(STUDENT_ID, { a1: 88 });

    const legacy = getWeightedGradeForStudent(STUDENT_ID, course, assignments, grades, {});
    const canonical = calculateFinalGradeWithWeightedGroups(
      STUDENT_ID,
      course,
      assignments,
      grades,
      {}
    );

    expect(Number.isFinite(legacy)).toBe(true);
    expect(Number.isFinite(canonical)).toBe(true);
    expect(canonical).toBeCloseTo(88, 5);
  });
});
