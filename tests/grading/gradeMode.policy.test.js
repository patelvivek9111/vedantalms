/**
 * Phase 3 — current vs projected final grade modes.
 */
const {
  calculateFinalGradeWithWeightedGroups,
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  GRADING_ENGINE_VERSION,
} = require('../../utils/gradeCalculation');
const { resolveGradingPolicy, courseContextFromResolvedPolicy } = require('../../shared/grading/policyResolver.cjs');
const {
  POLICY_NOW,
  BASELINE_SCENARIOS,
} = require('./canvasParity.fixtures');

function runScenario(scenario, calculator) {
  const { studentId, course, assignments, grades, submissions, policyOverride } = scenario;
  let courseContext = course;
  let policy = policyOverride || null;

  if (policyOverride) {
    const resolved = resolveGradingPolicy({
      course,
      coursePolicy: { policy: policyOverride },
    });
    courseContext = courseContextFromResolvedPolicy(resolved);
    policy = resolved;
  }

  return calculator(studentId, courseContext, assignments, grades, submissions, policy);
}

const FINAL_MODE_SCENARIOS = BASELINE_SCENARIOS.filter(
  (factory) => factory().canvasFinalPercent != null
);

describe('gradeMode — engine version', () => {
  it('bumps to 1.3.0 for drop highest and institution grade visibility', () => {
    expect(GRADING_ENGINE_VERSION).toBe('1.3.0');
  });
});

describe('gradeMode — backwards compatibility', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('calculateFinalGradeWithWeightedGroups equals calculateCurrentGradeWithWeightedGroups', () => {
    for (const factory of BASELINE_SCENARIOS) {
      const scenario = factory();
      if (scenario.assertLessThan != null || scenario.assertLessThanUncapped) continue;
      const legacy = runScenario(scenario, calculateFinalGradeWithWeightedGroups);
      const current = runScenario(scenario, calculateCurrentGradeWithWeightedGroups);
      expect(current).toBeCloseTo(legacy, 10);
    }
  });
});

describe('gradeMode — projected final grade (Phase 3)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe.each(FINAL_MODE_SCENARIOS.map((factory) => [factory().id, factory]))(
    '%s — matches canvasFinalPercent',
    (_id, factory) => {
      const scenario = factory();

      it(`projected final grade is ${scenario.canvasFinalPercent}%`, () => {
        const percent = runScenario(scenario, calculateProjectedFinalGradeWithWeightedGroups);
        expect(percent).toBeCloseTo(scenario.canvasFinalPercent, 5);
      });

      if (scenario.expectedCurrentPercent != null) {
        it('current grade unchanged from baseline', () => {
          const current = runScenario(scenario, calculateCurrentGradeWithWeightedGroups);
          expect(current).toBeCloseTo(scenario.expectedCurrentPercent, 5);
        });
      }
    }
  );
});
