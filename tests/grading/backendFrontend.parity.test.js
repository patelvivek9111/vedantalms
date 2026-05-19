/**
 * Ensures backend gradeCalculation.js stays aligned with documented policy expectations.
 * Frontend gradeUtils.ts is maintained as a TypeScript port of the same algorithm.
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
});
