/**
 * Assignment group activation (Phase 2) — frontend parity with backend.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateFinalGradeWithWeightedGroups,
  createGroupTotals,
  isAssignmentGroupActive,
  assignmentContributesToGrade,
} from '@/utils/gradeUtils';
import { resolveGradingPolicy, courseContextFromResolvedPolicy } from '@lms-shared/grading';
import {
  STUDENT_ID,
  PAST_DUE,
  FUTURE_DUE,
  buildCourse,
  buildAssignment,
  buildGrades,
} from '@tests/fixtures/grading/fixtures';
import { BASELINE_SCENARIOS } from '@tests/fixtures/grading/canvasParity.fixtures';
import { useCanvasParityPolicyClock } from '@tests/utils/canvasParityTestSetup';

function buildSubmissions(entries: Record<string, unknown | boolean>) {
  const map: Record<string, unknown> = {};
  for (const [assignmentId, sub] of Object.entries(entries)) {
    map[String(assignmentId)] = sub === true ? { _id: `sub-${assignmentId}` } : sub;
  }
  return map;
}

describe('groupActivation (frontend)', () => {
  useCanvasParityPolicyClock();

  it('isAssignmentGroupActive matches backend rules', () => {
    expect(isAssignmentGroupActive(createGroupTotals())).toBe(false);
    expect(
      isAssignmentGroupActive({ earned: 0, possible: 100, hasGradedAssignments: true })
    ).toBe(true);
  });

  it('assignmentContributesToGrade rejects future ungraded', () => {
    const assignment = buildAssignment({ id: 'f1', group: 'G', dueDate: FUTURE_DUE });
    expect(
      assignmentContributesToGrade(
        assignment,
        STUDENT_ID,
        buildGrades(STUDENT_ID, {}),
        {},
        new Date(),
        {}
      )
    ).toBeNull();
  });

  it('assignmentContributesToGrade accepts graded zero', () => {
    const assignment = buildAssignment({ id: 'z1', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(
        assignment,
        STUDENT_ID,
        buildGrades(STUDENT_ID, { z1: 0 }),
        buildSubmissions({ z1: true }),
        new Date(),
        {}
      )
    ).toEqual({ earned: 0, possible: 100, isExtraCredit: false });
  });

  it.each(BASELINE_SCENARIOS.map((f) => [f().id, f]))(
    '%s unchanged after groupActivation refactor',
    (_id, factory) => {
      const s = factory();
      let courseContext = s.course;
      let policy: Record<string, unknown> | null = s.policyOverride || null;
      if (s.policyOverride) {
        const resolved = resolveGradingPolicy({
          course: s.course,
          coursePolicy: { policy: s.policyOverride },
        });
        courseContext = courseContextFromResolvedPolicy(resolved);
        policy = resolved as Record<string, unknown>;
      }
      const percent = calculateFinalGradeWithWeightedGroups(
        s.studentId,
        courseContext,
        s.assignments,
        s.grades,
        s.submissions,
        policy
      );

      if (s.assertLessThan != null) {
        expect(percent).toBeLessThan(s.assertLessThan);
        return;
      }

      if (s.assertLessThanUncapped) {
        const uncapped = calculateFinalGradeWithWeightedGroups(
          s.studentId,
          s.course,
          s.assignments,
          s.grades,
          s.submissions,
          null
        );
        expect(percent).toBeLessThan(uncapped);
        return;
      }

      expect(percent).toBeCloseTo(s.expectedCurrentPercent!, 5);
    }
  );
});
