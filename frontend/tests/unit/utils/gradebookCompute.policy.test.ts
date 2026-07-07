/**
 * Export / gradebook overall % parity (P0).
 */
import { describe, it, expect } from 'vitest';
import { computeStudentWeightedPercent, computeAssignmentGroupStats, augmentAssignmentsForStudent, computeStudentCurrentPercent, computeStudentProjectedFinalPercent, normalizeResolvedPolicyForCourse } from '@/utils/gradebookCompute';
import { getLetterGrade } from '@/utils/gradeUtils';
import {
  STUDENT_ID,
  buildCourse,
  buildAssignment,
  buildGrades,
  buildSubmissionMap,
  case2MissingAssignment,
  case3SubmittedNotGraded,
  case4Unpublished,
  case5Excused,
  case1StandardWeighted,
  PAST_DUE,
} from '@tests/fixtures/grading/fixtures';

describe('gradebookCompute — export matches gradebook overall', () => {
  it('Case 1: composite submissionMap yields 83%', () => {
    const s = case1StandardWeighted();
    const percent = computeStudentWeightedPercent(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(percent).toBeCloseTo(83, 5);
    expect(getLetterGrade(percent, s.course.gradeScale)).toBe('B');
  });

  it('Case 2: missing vs submitted — 50% with composite map', () => {
    const s = case2MissingAssignment();
    const percent = computeStudentWeightedPercent(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(percent).toBeCloseTo(50, 5);
  });

  it('Case 3: submitted not graded past due excluded from current — 80%', () => {
    const s = case3SubmittedNotGraded();
    const percent = computeStudentWeightedPercent(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(percent).toBeCloseTo(80, 5);
  });

  it('Case 4: unpublished ignored — 90%', () => {
    const s = case4Unpublished();
    const percent = computeStudentWeightedPercent(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(percent).toBeCloseTo(90, 5);
  });

  it('Case 5: excused excluded — 80%', () => {
    const s = case5Excused();
    const percent = computeStudentWeightedPercent(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(percent).toBeCloseTo(80, 5);
  });

  it('group stats exclude submitted-but-ungraded from current under count_as_zero', () => {
    const s = case3SubmittedNotGraded();
    const stats = computeAssignmentGroupStats(
      s.studentId,
      'Assignments',
      s.assignments,
      s.course,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(stats.includedCount).toBe(1);
    expect(stats.totalInGroup).toBe(2);
    expect(stats.contributesToGrade).toBe(true);
    expect(stats.totalEarned).toBe(80);
    expect(stats.totalPossible).toBe(100);
    expect(stats.percentage).toBeCloseTo(80, 5);
  });

  it('composite and assignment-only submission maps exclude pending from current', () => {
    const groups = [{ name: 'Assignments', weight: 100 }];
    const gradedId = 'assign-graded';
    const pendingId = 'assign-pending';
    const assignments = [
      buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: pendingId, group: 'Assignments', dueDate: PAST_DUE }),
    ];
    const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
    const compositeMap = buildSubmissionMap([gradedId, pendingId]);

    const correct = computeStudentWeightedPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      compositeMap,
      []
    );
    const wrongShape: Record<string, string> = {
      [pendingId]: compositeMap[`${STUDENT_ID}_${pendingId}`],
    };
    const wrong = computeStudentWeightedPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      wrongShape,
      []
    );
    expect(correct).toBeCloseTo(80, 5);
    expect(wrong).toBeCloseTo(40, 5);
  });

  it('augmentAssignmentsForStudent preserves server hasSubmitted on discussions', () => {
    const discussion = buildAssignment({
      id: 'disc-1',
      group: 'Discussions',
      isDiscussion: true,
      hasSubmitted: true,
      replies: [],
    });
    const [augmented] = augmentAssignmentsForStudent([discussion], STUDENT_ID);
    expect(augmented.hasSubmitted).toBe(true);
  });

  it('current and final match under exclude_until_graded with missing work', () => {
    const groups = [{ name: 'Assignments', weight: 100 }];
    const gradedId = 'a-graded';
    const missingId = 'a-missing';
    const assignments = [
      buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: missingId, group: 'Assignments', dueDate: PAST_DUE }),
    ];
    const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
    const compositeMap = buildSubmissionMap([gradedId]);
    const policy = { missingAssignment: { mode: 'exclude_until_graded' as const }, groups };

    const current = computeStudentCurrentPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      compositeMap,
      [],
      policy as any
    );
    const projected = computeStudentProjectedFinalPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      compositeMap,
      [],
      policy as any
    );

    expect(current).toBeCloseTo(80, 5);
    expect(projected).toBeCloseTo(80, 5);
  });

  it('current vs projected final diverge when empty groups use nominal weight', () => {
    const groups = [
      { name: 'Active', weight: 55 },
      { name: 'Empty', weight: 45 },
    ];
    const gradedId = 'a-graded';
    const assignments = [buildAssignment({ id: gradedId, group: 'Active', dueDate: PAST_DUE })];
    const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
    const compositeMap = buildSubmissionMap([gradedId]);
    const policy = { missingAssignment: { mode: 'count_as_zero' as const }, groups };

    const current = computeStudentCurrentPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      compositeMap,
      [],
      policy as any
    );
    const projected = computeStudentProjectedFinalPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      compositeMap,
      [],
      policy as any
    );

    expect(current).toBeCloseTo(80, 5);
    expect(projected).toBeCloseTo(44, 5);
  });

  it('normalizeResolvedPolicyForCourse applies missing policy when API omits groups', () => {
    const groups = [{ name: 'Discussions', weight: 20 }];
    const course = buildCourse(groups);
    const gradedId = 'disc-graded';
    const missingIds = ['disc-m1', 'disc-m2'];
    const assignments = [
      buildAssignment({
        id: gradedId,
        group: 'Discussions',
        isDiscussion: true,
        dueDate: PAST_DUE,
        totalPoints: 100,
      }),
      ...missingIds.map((id) =>
        buildAssignment({
          id,
          group: 'Discussions',
          isDiscussion: true,
          dueDate: PAST_DUE,
          totalPoints: 100,
        })
      ),
    ];
    const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
    const compositeMap = buildSubmissionMap([gradedId]);

    const policyWithoutGroups = { missingAssignment: { mode: 'exclude_until_graded' as const } };
    const normalized = normalizeResolvedPolicyForCourse(course, policyWithoutGroups as any);
    expect(normalized?.groups).toEqual(groups);

    const statsExclude = computeAssignmentGroupStats(
      STUDENT_ID,
      'Discussions',
      assignments,
      course,
      grades,
      compositeMap,
      [],
      normalized
    );
    expect(statsExclude.totalEarned).toBe(80);
    expect(statsExclude.totalPossible).toBe(100);
    expect(statsExclude.includedCount).toBe(1);

    const policyCountZero = normalizeResolvedPolicyForCourse(course, {
      missingAssignment: { mode: 'count_as_zero' },
    } as any);
    const statsZero = computeAssignmentGroupStats(
      STUDENT_ID,
      'Discussions',
      assignments,
      course,
      grades,
      compositeMap,
      [],
      policyCountZero
    );
    expect(statsZero.totalEarned).toBe(80);
    expect(statsZero.totalPossible).toBe(300);
    expect(statsZero.includedCount).toBe(3);
  });
});
