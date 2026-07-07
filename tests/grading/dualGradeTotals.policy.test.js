/**
 * Phase 6 — dual API totals (current + projected final).
 */
const {
  computeDualGradeTotals,
  toStudentGradeApiResponse,
} = require('../../services/gradeCalculation.service');
const {
  POLICY_NOW,
  BASELINE_SCENARIOS,
} = require('./canvasParity.fixtures');

function runDualTotals(scenario) {
  const { studentId, course, assignments, grades, submissions, policyOverride } = scenario;
  return computeDualGradeTotals(
    studentId,
    course,
    assignments,
    grades,
    submissions,
    policyOverride || null
  );
}

const DUAL_GAP_SCENARIOS = BASELINE_SCENARIOS.filter(
  (factory) => {
    const s = factory();
    return (
      s.canvasFinalPercent != null &&
      s.expectedCurrentPercent != null &&
      Math.abs(s.expectedCurrentPercent - s.canvasFinalPercent) > 0.01
    );
  }
);

describe('dualGradeTotals — computeDualGradeTotals', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns currentPercent, finalPercent, and totalPercent alias', () => {
    const scenario = BASELINE_SCENARIOS.find((f) => f().id === 'cp23')();
    const result = computeDualGradeTotals(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions,
      null
    );
    expect(result.currentPercent).toBeCloseTo(100, 5);
    expect(result.finalPercent).toBeCloseTo(50, 5);
    expect(result.totalPercent).toBe(result.currentPercent);
    expect(result.letterGrade).toBeTruthy();
    expect(result.finalLetterGrade).toBeTruthy();
  });

  describe.each(DUAL_GAP_SCENARIOS.map((factory) => [factory().id, factory]))(
    '%s — current and final differ',
    (_id, factory) => {
      const scenario = factory();

      it(`current is ${scenario.expectedCurrentPercent}%`, () => {
        const result = runDualTotals(scenario);
        expect(result.currentPercent).toBeCloseTo(scenario.expectedCurrentPercent, 5);
      });

      it(`final is ${scenario.canvasFinalPercent}%`, () => {
        const result = runDualTotals(scenario);
        expect(result.finalPercent).toBeCloseTo(scenario.canvasFinalPercent, 5);
      });
    }
  );
});

describe('dualGradeTotals — toStudentGradeApiResponse', () => {
  it('maps service result to public API fields', () => {
    const payload = toStudentGradeApiResponse({
      currentPercent: 80,
      finalPercent: 40,
      totalPercent: 80,
      letterGrade: 'B',
      finalLetterGrade: 'F',
      fromFrozenSnapshot: false,
    }, { extended: false });
    expect(payload).toEqual({
      currentPercent: 80,
      finalPercent: 40,
      totalPercent: 80,
      letterGrade: 'B',
      finalLetterGrade: 'F',
      fromFrozenSnapshot: false,
    });
  });

  it('marks frozen snapshots', () => {
    const payload = toStudentGradeApiResponse({
      currentPercent: 83,
      finalPercent: 83,
      totalPercent: 83,
      letterGrade: 'B',
      finalLetterGrade: 'B',
      fromFrozenSnapshot: true,
    }, { extended: false });
    expect(payload.fromFrozenSnapshot).toBe(true);
    expect(payload.totalPercent).toBe(83);
  });
});
