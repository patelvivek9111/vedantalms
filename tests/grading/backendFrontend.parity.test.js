/**
 * Ensures backend gradeCalculation.js stays aligned with documented policy expectations.
 * Full CP-11…CP-25 coverage lives in canvasParityComprehensive.policy.test.js (Phase 7).
 */
const {
  calculateFinalGradeWithWeightedGroups,
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
const { ALL_CANVAS_PARITY_SCENARIOS } = require('./canvasParity.fixtures');
const { runCurrentGrade } = require('./parityRunner');

/** Expected overall % per scenario — shared contract with frontend Vitest suite */
const CONTRACT = [
  [case1StandardWeighted, 83, 'B'],
  [case2MissingAssignment, 50, 'F'],
  [case3SubmittedNotGraded, 80, 'B'],
  [case4Unpublished, 90, 'A'],
  [case5Excused, 80, 'B'],
  [case6WeightRedistribution, 80, 'B'],
  [case7LateSubmission, 85, 'B'],
  [case8ManualGrade, 92, 'A'],
  [case9GroupAssignment, 88, 'B'],
];

describe('Grading policy contract — backend canonical results', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it.each(CONTRACT)('%s → %s%% letter %s', (factory, expectedPercent, expectedLetter) => {
    const s = factory();
    const percent = calculateFinalGradeWithWeightedGroups(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      s.submissions
    );
    const letter = getLetterGrade(percent, s.course.gradeScale);
    expect(percent).toBeCloseTo(expectedPercent, 5);
    expect(letter).toBe(expectedLetter);
  });

  it.each(
    ALL_CANVAS_PARITY_SCENARIOS.filter((f) => {
      const s = f();
      return s.expectedCurrentPercent != null && !s.assertLessThan && !s.assertLessThanUncapped;
    }).map((f) => [f().id, f])
  )('%s current matches canvas parity fixture', (_id, factory) => {
    const s = factory();
    expect(runCurrentGrade(s)).toBeCloseTo(s.expectedCurrentPercent, 5);
  });
});
