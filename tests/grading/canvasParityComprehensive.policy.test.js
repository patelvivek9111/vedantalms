/**
 * Phase 7 — expanded Canvas parity suite.
 * Unifies Cases 1–9, CP-11…CP-25, backend/shared alignment, dual modes, and service totals.
 */
const {
  shared,
  backend,
  runCurrentGrade,
  runFinalGrade,
  runDualTotals,
  assertClose,
} = require('./parityRunner');
const { POLICY_NOW, ALL_CANVAS_PARITY_SCENARIOS } = require('./canvasParity.fixtures');
const {
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

const CONTRACT_CASES = [
  [case1StandardWeighted, 83],
  [case2MissingAssignment, 50],
  [case3SubmittedNotGraded, 80],
  [case4Unpublished, 90],
  [case5Excused, 80],
  [case6WeightRedistribution, 80],
  [case7LateSubmission, 85],
  [case8ManualGrade, 92],
  [case9GroupAssignment, 88],
];

describe('canvasParity comprehensive — Cases 1–9 contract', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it.each(CONTRACT_CASES)('%s shared CJS matches documented current %', (factory, expected) => {
    const scenario = factory();
    assertClose(runCurrentGrade(scenario), expected);
  });

  it.each(CONTRACT_CASES)('%s backend re-export matches shared CJS', (factory) => {
    const scenario = factory();
    const sharedPct = runCurrentGrade(scenario);
    const backendPct = backend.calculateFinalGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    assertClose(sharedPct, backendPct, 10);
  });

  it.each(CONTRACT_CASES)('%s legacy alias equals current mode', (factory) => {
    const scenario = factory();
    const current = runCurrentGrade(scenario);
    const alias = backend.calculateFinalGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    assertClose(current, alias, 10);
  });
});

describe('canvasParity comprehensive — CP baseline scenarios', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe.each(ALL_CANVAS_PARITY_SCENARIOS.map((factory) => [factory().id, factory]))(
    '%s',
    (_id, factory) => {
      const scenario = factory();

      if (scenario.assertLessThan != null) {
        it(`current percent is less than ${scenario.assertLessThan}%`, () => {
          expect(runCurrentGrade(scenario)).toBeLessThan(scenario.assertLessThan);
        });
        return;
      }

      if (scenario.assertLessThanUncapped) {
        it('capped current is less than uncapped baseline', () => {
          const capped = runCurrentGrade(scenario);
          const uncapped = runCurrentGrade({ ...scenario, policyOverride: {} });
          expect(capped).toBeLessThan(uncapped);
        });
        return;
      }

      it(`current matches expectedCurrentPercent (${scenario.expectedCurrentPercent}%)`, () => {
        assertClose(runCurrentGrade(scenario), scenario.expectedCurrentPercent);
      });

      if (scenario.canvasFinalPercent != null) {
        it(`final matches canvasFinalPercent (${scenario.canvasFinalPercent}%)`, () => {
          assertClose(runFinalGrade(scenario), scenario.canvasFinalPercent);
        });
      }

      it('computeDualGradeTotals matches direct calculators', () => {
        const dual = runDualTotals(scenario);
        assertClose(dual.currentPercent, runCurrentGrade(scenario), 8);
        assertClose(dual.totalPercent, dual.currentPercent, 10);
        if (scenario.canvasFinalPercent != null) {
          assertClose(dual.finalPercent, scenario.canvasFinalPercent, 8);
        } else {
          assertClose(dual.finalPercent, runFinalGrade(scenario), 8);
        }
      });
    }
  );
});

describe('canvasParity comprehensive — engine invariants', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('calculateFinalGradeWithWeightedGroups is shared.calculateFinalGradeWithWeightedGroups', () => {
    expect(backend.calculateFinalGradeWithWeightedGroups).toBe(
      shared.calculateFinalGradeWithWeightedGroups
    );
  });

  it('all CP scenarios produce finite current and final percentages', () => {
    for (const factory of ALL_CANVAS_PARITY_SCENARIOS) {
      const scenario = factory();
      const current = runCurrentGrade(scenario);
      const finalGrade = runFinalGrade(scenario);
      expect(Number.isFinite(current)).toBe(true);
      expect(Number.isFinite(finalGrade)).toBe(true);
    }
  });

  it('CJS/ESM twin parity is enforced by scripts/verifySharedGrading.js (npm run verify:grading)', () => {
    const { execFileSync } = require('child_process');
    const path = require('path');
    execFileSync(process.execPath, [path.join(__dirname, '../../scripts/verifySharedGrading.js')], {
      stdio: 'pipe',
      env: process.env,
    });
  });
});
