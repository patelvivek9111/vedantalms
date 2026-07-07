/**
 * Grading policy contract tests (backend).
 * Uses utils/gradeCalculation.js — same algorithm as reports, grades API, and frontend gradeUtils.
 */
const {
  calculateFinalGradeWithWeightedGroups,
  computeGroupPointTotals,
  getLetterGrade,
} = require('../../utils/gradeCalculation');
const {
  POLICY_NOW,
  case1StandardWeighted,
  case2MissingAssignment,
  case3SubmittedNotGraded,
  case4Unpublished,
  case5Excused,
  case6WeightRedistribution,
  case7LateSubmission,
  case8ManualGrade,
  case9GroupAssignment,
} = require('./fixtures');

function runScenario(scenario) {
  const { studentId, course, assignments, grades, submissions } = scenario;
  const percent = calculateFinalGradeWithWeightedGroups(
    studentId,
    course,
    assignments,
    grades,
    submissions
  );
  const letter = getLetterGrade(percent, course.gradeScale);
  return { percent, letter };
}

describe('Grading policy — calculateFinalGradeWithWeightedGroups (backend)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Case 1 — Standard weighted student (83%)', () => {
    const scenario = case1StandardWeighted();

    it('computes 83% overall', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });

    it('assigns letter grade B', () => {
      const { letter } = runScenario(scenario);
      expect(letter).toBe(scenario.expectedLetter);
    });
  });

  describe('Case 2 — Missing assignment past due (0%)', () => {
    const scenario = case2MissingAssignment();

    it('counts missing as zero in group average (50% overall)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });
  });

  describe('Case 3 — Submitted but not graded (Canvas Current excludes)', () => {
    const scenario = case3SubmittedNotGraded();

    it('excludes pending past-due item from current (80%)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });

    it('computeGroupPointTotals matches category earned/possible', () => {
      const { studentId, assignments, grades, submissions } = scenario;
      const stats = computeGroupPointTotals(
        studentId,
        assignments,
        grades,
        submissions,
        null,
        'Assignments'
      );
      expect(stats.includedCount).toBe(1);
      expect(stats.totalInGroup).toBe(2);
      expect(stats.totalEarned).toBe(80);
      expect(stats.totalPossible).toBe(100);
      expect(stats.percentage).toBeCloseTo(80, 5);
    });
  });

  describe('Case 4 — Unpublished assignment ignored', () => {
    const scenario = case4Unpublished();

    it('ignores unpublished items (90% from published only)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });
  });

  describe('Case 5 — Excused assignment (excluded from totals)', () => {
    const scenario = case5Excused();

    it('excludes excused from overall (80% from graded item only)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });

    it('assigns letter grade B', () => {
      const { letter } = runScenario(scenario);
      expect(letter).toBe(scenario.expectedLetter);
    });
  });

  describe('Case 6 — Group weight redistribution', () => {
    const scenario = case6WeightRedistribution();

    it('redistributes empty-group weight to active group (80%, no artificial drop)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });
  });

  describe('Case 7 — Late submission', () => {
    const scenario = case7LateSubmission();

    it('includes graded late work in overall (85%)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });
  });

  describe('Case 8 — Manual / instructor numeric grade', () => {
    const scenario = case8ManualGrade();

    it('uses instructor-entered points in overall (92%)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });
  });

  describe('Case 9 — Group assignment score', () => {
    const scenario = case9GroupAssignment();

    it('uses group-level grade in overall (88%)', () => {
      const { percent } = runScenario(scenario);
      expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
    });

    it('supports individual member override when resolved to grades map (95%)', () => {
      const { studentId, course, assignments, submissions } = scenario;
      const individual = scenario.individualGradeScenario;
      const grades = require('./fixtures').buildGrades(studentId, {
        [assignments[0]._id]: individual.memberGrades[0].grade,
      });
      const percent = calculateFinalGradeWithWeightedGroups(
        studentId,
        course,
        assignments,
        grades,
        submissions
      );
      expect(percent).toBeCloseTo(individual.expectedPercent, 5);
    });
  });

  describe('Letter grade scale', () => {
    it('maps boundary percentages consistently', () => {
      expect(getLetterGrade(90)).toBe('A');
      expect(getLetterGrade(89.9)).toBe('B');
      expect(getLetterGrade(83)).toBe('B');
      expect(getLetterGrade(59)).toBe('F');
    });
  });
});
