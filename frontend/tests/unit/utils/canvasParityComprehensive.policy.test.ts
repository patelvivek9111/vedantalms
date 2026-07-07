/**
 * Phase 7 — expanded Canvas parity (frontend mirror).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  calculateFinalGradeWithWeightedGroups,
  resolveGradingPolicy,
  courseContextFromResolvedPolicy,
} from '@/utils/gradeUtils';
import { ALL_CANVAS_PARITY_SCENARIOS } from '@tests/fixtures/grading/canvasParity.fixtures';
import { useCanvasParityPolicyClock } from '@tests/utils/canvasParityTestSetup';
import {
  case1StandardWeighted,
  case2MissingAssignment,
  case3SubmittedNotGraded,
  case4Unpublished,
  case5Excused,
  case6WeightRedistribution,
  case7LateSubmission,
  case8ManualGrade,
  case9GroupAssignment,
} from '@tests/fixtures/grading/fixtures';

type GradeScenario = {
  id?: string;
  studentId: string;
  course: ReturnType<typeof import('@tests/fixtures/grading/fixtures').buildCourse>;
  assignments: ReturnType<typeof import('@tests/fixtures/grading/fixtures').buildAssignment>[];
  grades: ReturnType<typeof import('@tests/fixtures/grading/fixtures').buildGrades>;
  submissions?: Record<string, unknown>;
  submissionMap?: Record<string, string>;
  policyOverride?: Record<string, unknown>;
  expectedCurrentPercent?: number;
  canvasFinalPercent?: number;
  assertLessThan?: number;
  assertLessThanUncapped?: boolean;
};

function getSubmissions(scenario: GradeScenario): Record<string, unknown> {
  if (scenario.submissions && Object.keys(scenario.submissions).length > 0) {
    return scenario.submissions;
  }
  const byAssignment: Record<string, unknown> = {};
  if (scenario.submissionMap) {
    for (const a of scenario.assignments) {
      const key = `${scenario.studentId}_${a._id}`;
      if (scenario.submissionMap[key]) {
        byAssignment[String(a._id)] = { _id: scenario.submissionMap[key] };
      }
    }
  }
  return byAssignment;
}

const CONTRACT: Array<[() => GradeScenario, number]> = [
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

function resolveScenarioContext(scenario: GradeScenario) {
  if (!scenario.policyOverride) {
    return { courseContext: scenario.course, policy: null as Record<string, unknown> | null };
  }
  const resolved = resolveGradingPolicy({
    course: scenario.course,
    coursePolicy: { policy: scenario.policyOverride },
  });
  return {
    courseContext: courseContextFromResolvedPolicy(resolved),
    policy: resolved as Record<string, unknown>,
  };
}

function runCurrent(scenario: GradeScenario): number {
  const { courseContext, policy } = resolveScenarioContext(scenario);
  return calculateCurrentGradeWithWeightedGroups(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    getSubmissions(scenario),
    policy
  );
}

function runFinal(scenario: GradeScenario): number {
  const { courseContext, policy } = resolveScenarioContext(scenario);
  return calculateProjectedFinalGradeWithWeightedGroups(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    getSubmissions(scenario),
    policy
  );
}

describe('canvasParity comprehensive — Cases 1–9 (frontend)', () => {
  for (const [factory, expected] of CONTRACT) {
    const scenario = factory();
    it(`${scenario.id ?? 'case'}: current is ${expected}%`, () => {
      expect(runCurrent(scenario)).toBeCloseTo(expected, 5);
    });
    it(`${scenario.id ?? 'case'}: legacy alias equals current`, () => {
      const current = runCurrent(scenario);
      const { courseContext, policy } = resolveScenarioContext(scenario);
      const alias = calculateFinalGradeWithWeightedGroups(
        scenario.studentId,
        courseContext,
        scenario.assignments,
        scenario.grades,
        getSubmissions(scenario),
        policy
      );
      expect(alias).toBeCloseTo(current, 8);
    });
  }
});

describe('canvasParity comprehensive — CP baseline (frontend)', () => {
  useCanvasParityPolicyClock();

  for (const factory of ALL_CANVAS_PARITY_SCENARIOS) {
    const scenario = factory();

    if (scenario.assertLessThan != null) {
      it(`${scenario.id}: current below ${scenario.assertLessThan}%`, () => {
        expect(runCurrent(scenario)).toBeLessThan(scenario.assertLessThan!);
      });
      continue;
    }

    if (scenario.assertLessThanUncapped) {
      it(`${scenario.id}: capped below uncapped`, () => {
        const capped = runCurrent(scenario);
        const uncapped = runCurrent({ ...scenario, policyOverride: {} });
        expect(capped).toBeLessThan(uncapped);
      });
      continue;
    }

    it(`${scenario.id}: current ${scenario.expectedCurrentPercent}%`, () => {
      expect(runCurrent(scenario)).toBeCloseTo(scenario.expectedCurrentPercent!, 5);
    });

    if (scenario.canvasFinalPercent != null) {
      it(`${scenario.id}: final ${scenario.canvasFinalPercent}%`, () => {
        expect(runFinal(scenario)).toBeCloseTo(scenario.canvasFinalPercent!, 5);
      });
    }
  }
});
