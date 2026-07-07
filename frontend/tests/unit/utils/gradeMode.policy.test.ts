/**
 * Phase 3 — current vs projected final grade modes (frontend mirror).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateFinalGradeWithWeightedGroups,
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  GRADING_ENGINE_VERSION,
} from '@/utils/gradeUtils';
import { resolveGradingPolicy, courseContextFromResolvedPolicy } from '@lms-shared/grading';
import { BASELINE_SCENARIOS, type CanvasParityScenario } from '@tests/fixtures/grading/canvasParity.fixtures';
import { useCanvasParityPolicyClock } from '@tests/utils/canvasParityTestSetup';

type Calculator = (
  studentId: string,
  course: CanvasParityScenario['course'],
  assignments: CanvasParityScenario['assignments'],
  grades: CanvasParityScenario['grades'],
  submissions: CanvasParityScenario['submissions'],
  policy: Record<string, unknown> | null
) => number;

function runScenario(scenario: CanvasParityScenario, calculator: Calculator): number {
  let courseContext = scenario.course;
  let policy: Record<string, unknown> | null = scenario.policyOverride || null;

  if (scenario.policyOverride) {
    const resolved = resolveGradingPolicy({
      course: scenario.course,
      coursePolicy: { policy: scenario.policyOverride },
    });
    courseContext = courseContextFromResolvedPolicy(resolved);
    policy = resolved as Record<string, unknown>;
  }

  return calculator(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    scenario.submissions,
    policy
  );
}

const FINAL_MODE_SCENARIOS = BASELINE_SCENARIOS.filter(
  (factory) => factory().canvasFinalPercent != null
);

describe('gradeMode — engine version (frontend)', () => {
  it('bumps to 1.3.0 for drop highest and institution grade visibility', () => {
    expect(GRADING_ENGINE_VERSION).toBe('1.3.0');
  });
});

describe('gradeMode — backwards compatibility (frontend)', () => {
  useCanvasParityPolicyClock();

  for (const factory of BASELINE_SCENARIOS) {
    const scenario = factory();
    if (scenario.assertLessThan != null || scenario.assertLessThanUncapped) continue;

    it(`${scenario.id}: legacy alias equals current mode`, () => {
      const legacy = runScenario(scenario, calculateFinalGradeWithWeightedGroups);
      const current = runScenario(scenario, calculateCurrentGradeWithWeightedGroups);
      expect(current).toBeCloseTo(legacy, 10);
    });
  }
});

describe('gradeMode — projected final grade (frontend)', () => {
  useCanvasParityPolicyClock();

  for (const factory of FINAL_MODE_SCENARIOS) {
    const scenario = factory();

    it(`${scenario.id}: projected final grade is ${scenario.canvasFinalPercent}%`, () => {
      const percent = runScenario(scenario, calculateProjectedFinalGradeWithWeightedGroups);
      expect(percent).toBeCloseTo(scenario.canvasFinalPercent!, 5);
    });

    if (scenario.expectedCurrentPercent != null) {
      it(`${scenario.id}: current grade unchanged`, () => {
        const current = runScenario(scenario, calculateCurrentGradeWithWeightedGroups);
        expect(current).toBeCloseTo(scenario.expectedCurrentPercent!, 5);
      });
    }
  }
});
