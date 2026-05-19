/**
 * Export / gradebook overall % parity (P0).
 */
import { describe, it, expect } from 'vitest';
import { computeStudentWeightedPercent } from '@/utils/gradebookCompute';
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

  it('Case 3: submitted not graded excluded — 80%', () => {
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

  it('wrong map shape (assignment-only keys) diverges from composite map for pending submit', () => {
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
});
