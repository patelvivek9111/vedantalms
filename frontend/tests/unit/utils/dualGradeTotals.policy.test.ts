/**
 * Phase 6 — dual API totals (frontend mirror).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  getLetterGrade,
} from '@/utils/gradeUtils';
import { BASELINE_SCENARIOS } from '@tests/fixtures/grading/canvasParity.fixtures';
import { useCanvasParityPolicyClock } from '@tests/utils/canvasParityTestSetup';

function dualTotals(scenario: ReturnType<(typeof BASELINE_SCENARIOS)[number]>) {
  const currentPercent = calculateCurrentGradeWithWeightedGroups(
    scenario.studentId,
    scenario.course,
    scenario.assignments,
    scenario.grades,
    scenario.submissions
  );
  const finalPercent = calculateProjectedFinalGradeWithWeightedGroups(
    scenario.studentId,
    scenario.course,
    scenario.assignments,
    scenario.grades,
    scenario.submissions
  );
  return {
    currentPercent,
    finalPercent,
    totalPercent: currentPercent,
    letterGrade: getLetterGrade(currentPercent),
    finalLetterGrade: getLetterGrade(finalPercent),
  };
}

describe('dualGradeTotals — frontend parity', () => {
  useCanvasParityPolicyClock();

  it('cp23 current and final differ (100% vs 50%)', () => {
    const scenario = BASELINE_SCENARIOS.find((f) => f().id === 'cp23')!();
    const result = dualTotals(scenario);
    expect(result.currentPercent).toBeCloseTo(100, 5);
    expect(result.finalPercent).toBeCloseTo(50, 5);
    expect(result.totalPercent).toBe(result.currentPercent);
  });

  it('cp25 count_as_zero — current 80%, final 40%', () => {
    const scenario = BASELINE_SCENARIOS.find((f) => f().id === 'cp25')!();
    const result = dualTotals(scenario);
    expect(result.currentPercent).toBeCloseTo(80, 5);
    expect(result.finalPercent).toBeCloseTo(40, 5);
  });

  it('cp24 extra credit — current equals final at 110%', () => {
    const scenario = BASELINE_SCENARIOS.find((f) => f().id === 'cp24')!();
    const result = dualTotals(scenario);
    expect(result.currentPercent).toBeCloseTo(110, 5);
    expect(result.finalPercent).toBeCloseTo(110, 5);
  });
});
