/**
 * Grading policy — frontend gradeUtils + parity with export/transcript paths.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade,
} from '@/utils/gradeUtils';
import { getGradebookCellForExport } from '@/utils/gradebookExport';
import {
  STUDENT_ID,
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

function runScenario(scenario: {
  studentId: string;
  course: ReturnType<typeof import('@tests/fixtures/grading/fixtures').buildCourse>;
  assignments: ReturnType<typeof import('@tests/fixtures/grading/fixtures').buildAssignment>[];
  grades: ReturnType<typeof import('@tests/fixtures/grading/fixtures').buildGrades>;
  submissionMap: Record<string, string>;
}) {
  const submissionByAssignment: Record<string, unknown> = {};
  for (const a of scenario.assignments) {
    const key = `${scenario.studentId}_${a._id}`;
    if (scenario.submissionMap[key]) {
      submissionByAssignment[a._id] = { _id: scenario.submissionMap[key] };
    }
  }
  const percent = calculateFinalGradeWithWeightedGroups(
    scenario.studentId,
    scenario.course,
    scenario.assignments,
    scenario.grades,
    submissionByAssignment
  );
  const letter = getLetterGrade(percent, scenario.course.gradeScale);
  return { percent, letter };
}

describe('Grading policy — gradeUtils (frontend)', () => {
  it('Case 1: standard weighted student → 83% / B', () => {
    const s = case1StandardWeighted();
    const { percent, letter } = runScenario(s);
    expect(percent).toBeCloseTo(83, 5);
    expect(letter).toBe('B');
  });

  it('Case 2: missing past due → 50% overall', () => {
    const s = case2MissingAssignment();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(50, 5);
  });

  it('Case 3: submitted not graded past due excluded from current → 80%', () => {
    const s = case3SubmittedNotGraded();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(80, 5);
  });

  it('Case 4: unpublished ignored → 90%', () => {
    const s = case4Unpublished();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(90, 5);
  });

  it('Case 5: excused excluded → 80%', () => {
    const s = case5Excused();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(80, 5);
  });

  it('Case 6: weight redistribution → 80%', () => {
    const s = case6WeightRedistribution();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(80, 5);
  });

  it('Case 7: graded late work included → 85%', () => {
    const s = case7LateSubmission();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(85, 5);
  });

  it('Case 8: manual numeric grade → 92%', () => {
    const s = case8ManualGrade();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(92, 5);
  });

  it('Case 9: group assignment grade → 88%', () => {
    const s = case9GroupAssignment();
    const { percent } = runScenario(s);
    expect(percent).toBeCloseTo(88, 5);
  });
});

describe('Grading policy — export cell labels align with gradebook UI', () => {
  const student = { _id: STUDENT_ID, firstName: 'Test', lastName: 'Student' };

  it('Case 2: missing shows 0 (MA)', () => {
    const s = case2MissingAssignment();
    const missing = s.assignments.find((a) => a._id === s.missingAssignmentId)!;
    const cell = getGradebookCellForExport(
      student,
      missing,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(cell.display).toBe('0 (MA)');
    expect(cell.marker).toBe('RED');
  });

  it('Case 3: pending past due shows 0 (MA) under count_as_zero', () => {
    const s = case3SubmittedNotGraded();
    const pending = s.assignments.find((a) => a._id === s.pendingAssignmentId)!;
    const cell = getGradebookCellForExport(
      student,
      pending,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(cell.display).toBe('0 (MA)');
    expect(cell.marker).toBe('RED');
  });

  it('Case 5: excused shows Excused', () => {
    const s = case5Excused();
    const excused = s.assignments.find((a) => a._id === s.excusedAssignmentId)!;
    const cell = getGradebookCellForExport(
      student,
      excused,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(cell.display).toBe('Excused');
    expect(cell.marker).toBe('GRAY');
  });

  it('Case 4: unpublished shows Not Published', () => {
    const s = case4Unpublished();
    const hidden = s.assignments.find((a) => a._id === s.hiddenAssignmentId)!;
    const cell = getGradebookCellForExport(
      student,
      hidden,
      s.grades,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(cell.display).toBe('Not Published');
    expect(cell.marker).toBe('GRAY');
  });

  it('Case 7: ungraded late past due shows Late', () => {
    const s = case7LateSubmission();
    const late = s.assignments.find((a) => a._id === s.lateAssignmentId)!;
    const gradesEmpty = { [STUDENT_ID]: {} };
    const cell = getGradebookCellForExport(
      student,
      late,
      gradesEmpty,
      s.submissionMap,
      s.studentSubmissions
    );
    expect(cell.display).toBe('Late');
    expect(cell.marker).toBe('ORANGE');
  });

  it('export overall matches gradeUtils for Case 1', () => {
    const s = case1StandardWeighted();
    const submissionByAssignment: Record<string, unknown> = {};
    for (const a of s.assignments) {
      const key = `${s.studentId}_${a._id}`;
      if (s.submissionMap[key]) submissionByAssignment[a._id] = {};
    }
    const overall = calculateFinalGradeWithWeightedGroups(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      submissionByAssignment
    );
    expect(Number(overall.toFixed(2))).toBe(83);
    expect(getLetterGrade(overall, s.course.gradeScale)).toBe('B');
  });
});
