/**
 * Courses without CourseGradingPolicy documents behave like pre-policy contract.
 */
const {
  calculateFinalGradeWithWeightedGroups,
} = require('../../shared/grading/gradeCalculation.cjs');
const { resolveGradingPolicy, courseContextFromResolvedPolicy } = require('../../shared/grading/policyResolver.cjs');
const { case1StandardWeighted } = require('./fixtures');

describe('Policy backward compatibility', () => {
  it('Case 1 still yields 83% via resolver + canonical calculator', () => {
    const scenario = case1StandardWeighted();
    const course = { groups: scenario.course.groups, gradeScale: scenario.course.gradeScale };
    const resolved = resolveGradingPolicy({ course });
    const ctx = courseContextFromResolvedPolicy(resolved);
    const percent = calculateFinalGradeWithWeightedGroups(
      scenario.studentId,
      ctx,
      scenario.assignments,
      scenario.grades,
      scenario.submissions,
      resolved
    );
    expect(percent).toBeCloseTo(83, 5);
  });

  it('omitting policy argument matches explicit default policy', () => {
    const scenario = case1StandardWeighted();
    const course = { groups: scenario.course.groups, gradeScale: scenario.course.gradeScale };
    const a = calculateFinalGradeWithWeightedGroups(
      scenario.studentId,
      course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    const resolved = resolveGradingPolicy({ course });
    const ctx = courseContextFromResolvedPolicy(resolved);
    const b = calculateFinalGradeWithWeightedGroups(
      scenario.studentId,
      ctx,
      scenario.assignments,
      scenario.grades,
      scenario.submissions,
      resolved
    );
    expect(a).toBeCloseTo(b, 8);
  });
});
