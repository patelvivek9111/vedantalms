/**
 * Phase 1 Canvas parity audit tests.
 * Validates baseline scenarios against today's engine — no logic changes.
 * Phase 3 final-grade targets are covered in gradeMode.policy.test.js
 */
const { calculateFinalGradeWithWeightedGroups } = require('../../utils/gradeCalculation');
const { resolveGradingPolicy, courseContextFromResolvedPolicy } = require('../../shared/grading/policyResolver.cjs');
const { POLICY_NOW, BASELINE_SCENARIOS, PENDING_SCENARIOS } = require('./canvasParity.fixtures');

function runScenario(scenario) {
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

  return calculateFinalGradeWithWeightedGroups(
    studentId,
    courseContext,
    assignments,
    grades,
    submissions,
    policy
  );
}

describe('Canvas parity audit — baseline scenarios (Phase 1)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe.each(BASELINE_SCENARIOS.map((factory) => [factory().id, factory]))(
    '%s — current engine matches documented baseline',
    (_id, factory) => {
      const scenario = factory();

      if (scenario.assertLessThan != null) {
        it(`percent is less than ${scenario.assertLessThan}%`, () => {
          const percent = runScenario(scenario);
          expect(percent).toBeLessThan(scenario.assertLessThan);
        });
        return;
      }

      if (scenario.assertLessThanUncapped) {
        it('capped percent is less than uncapped baseline', () => {
          const capped = runScenario(scenario);
          const uncappedScenario = { ...scenario, policyOverride: {} };
          const uncapped = runScenario(uncappedScenario);
          expect(capped).toBeLessThan(uncapped);
        });
        return;
      }

      it(`matches expectedCurrentPercent (${scenario.expectedCurrentPercent}%)`, () => {
        const percent = runScenario(scenario);
        expect(percent).toBeCloseTo(scenario.expectedCurrentPercent, 5);
      });
    }
  );
});

describe('Canvas parity audit — pending scenarios (documented targets)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  if (PENDING_SCENARIOS.length === 0) {
    it('has no pending scenarios (all promoted to baseline)', () => {
      expect(PENDING_SCENARIOS).toHaveLength(0);
    });
    return;
  }

  describe.each(PENDING_SCENARIOS.map((factory) => [factory().id, factory]))(
    '%s',
    (_id, factory) => {
      const scenario = factory();

      it('current engine matches expectedCurrentPercent (baseline until Phase 3/5)', () => {
        if (scenario.expectedCurrentPercent == null) return;
        const percent = runScenario(scenario);
        expect(percent).toBeCloseTo(scenario.expectedCurrentPercent, 5);
      });

      if (scenario.canvasFinalPercent != null) {
        // Phase 3: see tests/grading/gradeMode.policy.test.js
      }

      if (scenario.canvasExtraCreditPercent != null) {
        test.todo(
          `Phase 5: extra credit total should be ${scenario.canvasExtraCreditPercent}% (${scenario.title})`
        );
      }
    }
  );
});

describe('Canvas parity audit — gap registry completeness', () => {
  it('documents all baseline and pending scenarios', () => {
    const { ALL_CANVAS_PARITY_SCENARIOS } = require('./canvasParity.fixtures');
    expect(ALL_CANVAS_PARITY_SCENARIOS).toHaveLength(15);
    expect(BASELINE_SCENARIOS).toHaveLength(15);
    expect(PENDING_SCENARIOS).toHaveLength(0);
  });

  it('every scenario has required audit metadata', () => {
    const { ALL_CANVAS_PARITY_SCENARIOS } = require('./canvasParity.fixtures');
    for (const factory of ALL_CANVAS_PARITY_SCENARIOS) {
      const s = factory();
      expect(s.id).toMatch(/^cp\d+$/);
      expect(s.title).toBeTruthy();
      expect(s.canvasReference).toBeTruthy();
      expect(s.implementationStatus).toMatch(/^(baseline|pending_phase_3|pending_phase_5)$/);
      expect(s.gapId).toMatch(/^G-\d+$/);
      expect(s.decision).toMatch(/^(keep|change|current_keep_final_add)$/);
    }
  });
});
