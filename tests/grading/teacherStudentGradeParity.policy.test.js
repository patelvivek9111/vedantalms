/**
 * Gradebook and student API must share computeStudentCourseGrade (single architecture).
 */
const fs = require('fs');
const path = require('path');
const { cp15ExcludeUntilGraded } = require('./canvasParity.fixtures');
const { computeDualGradeTotals } = require('../../services/gradeCalculation.service');
const { courseContextFromResolvedPolicy } = require('../../shared/grading/policyResolver.cjs');

const ROOT = path.join(__dirname, '../..');

describe('unified grade architecture parity', () => {
  it('current and final match under exclude_until_graded when missing is excluded', () => {
    const scenario = cp15ExcludeUntilGraded();
    const { studentId, course, assignments, grades, submissions, policyOverride } = scenario;
    const resolved = {
      ...policyOverride,
      groups: course.groups,
      gradeScale: course.gradeScale,
    };
    const courseContext = courseContextFromResolvedPolicy(resolved);

    const dual = computeDualGradeTotals(
      studentId,
      courseContext,
      assignments,
      grades,
      submissions,
      resolved
    );

    expect(dual.currentPercent).toBeCloseTo(80, 5);
    expect(dual.finalPercent).toBeCloseTo(80, 5);
  });

  it('gradebook and student API both route through computeStudentCourseGrade', () => {
    const gradebook = fs.readFileSync(
      path.join(ROOT, 'services/gradebookData.service.js'),
      'utf8'
    );
    const calc = fs.readFileSync(path.join(ROOT, 'services/gradeCalculation.service.js'), 'utf8');
    const controller = fs.readFileSync(path.join(ROOT, 'controllers/grades.controller.js'), 'utf8');

    expect(gradebook).toMatch(/computeStudentCourseGrade/);
    expect(calc).toMatch(/async function computeStudentCourseGrade/);
    expect(calc).toMatch(/calculateCourseGradeForStudent[\s\S]*computeStudentCourseGrade/);
    expect(controller).toMatch(/calculateCourseGradeForStudent\s*\(/);
    expect(controller).not.toMatch(/buildStudentCourseGradeContext\s*\(/);
  });
});
