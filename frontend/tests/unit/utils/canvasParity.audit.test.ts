/**
 * Phase 1 Canvas parity audit tests (frontend mirror).
 * Phase 3 final-grade targets are covered in gradeMode.policy.test.ts
 */
import { describe, it, expect } from 'vitest';
import { calculateFinalGradeWithWeightedGroups } from '@/utils/gradeUtils';
import { resolveGradingPolicy, courseContextFromResolvedPolicy } from '@lms-shared/grading';
import {
  BASELINE_SCENARIOS,
  PENDING_SCENARIOS,
  ALL_CANVAS_PARITY_SCENARIOS,
  type CanvasParityScenario,
} from '@tests/fixtures/grading/canvasParity.fixtures';
import { useCanvasParityPolicyClock } from '@tests/utils/canvasParityTestSetup';

function runScenario(scenario: CanvasParityScenario): number {
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

  return calculateFinalGradeWithWeightedGroups(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    scenario.submissions,
    policy
  );
}

describe('Canvas parity audit — baseline scenarios (Phase 1, frontend)', () => {
  useCanvasParityPolicyClock();

  for (const factory of BASELINE_SCENARIOS) {
    const scenario = factory();

    if (scenario.assertLessThan != null) {
      it(`${scenario.id}: percent is less than ${scenario.assertLessThan}%`, () => {
        expect(runScenario(scenario)).toBeLessThan(scenario.assertLessThan!);
      });
      continue;
    }

    if (scenario.assertLessThanUncapped) {
      it(`${scenario.id}: capped percent is less than uncapped`, () => {
        const capped = runScenario(scenario);
        const uncapped = runScenario({ ...scenario, policyOverride: {} });
        expect(capped).toBeLessThan(uncapped);
      });
      continue;
    }

    it(`${scenario.id}: matches expectedCurrentPercent (${scenario.expectedCurrentPercent}%)`, () => {
      expect(runScenario(scenario)).toBeCloseTo(scenario.expectedCurrentPercent!, 5);
    });
  }
});

describe('Canvas parity audit — pending scenarios (frontend)', () => {
  if (PENDING_SCENARIOS.length === 0) {
    it('has no pending scenarios (all promoted to baseline)', () => {
      expect(PENDING_SCENARIOS).toHaveLength(0);
    });
    return;
  }

  for (const factory of PENDING_SCENARIOS) {
    const scenario = factory();

    it(`${scenario.id}: current engine matches expectedCurrentPercent`, () => {
      if (scenario.expectedCurrentPercent == null) return;
      expect(runScenario(scenario)).toBeCloseTo(scenario.expectedCurrentPercent, 5);
    });

    if (scenario.canvasExtraCreditPercent != null) {
      it.todo(
        `Phase 5: extra credit total should be ${scenario.canvasExtraCreditPercent}% (${scenario.title})`
      );
    }
  }
});

describe('Canvas parity audit — fixture registry (frontend)', () => {
  it('documents 15 total scenarios', () => {
    expect(ALL_CANVAS_PARITY_SCENARIOS).toHaveLength(15);
    expect(BASELINE_SCENARIOS).toHaveLength(15);
    expect(PENDING_SCENARIOS).toHaveLength(0);
  });
});
