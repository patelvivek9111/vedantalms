import { describe, it, expect } from 'vitest';
import {
  submissionToGradebookValue,
  discussionGradeToGradebookValue,
} from '../instructorGradebookGrades';
import { EXCUSED_GRADE } from '../gradeUtils';
import { computeStudentWeightedPercent } from '../gradebookCompute';
import {
  buildCourse,
  buildAssignment,
  buildGrades,
  buildSubmissionMap,
  STUDENT_ID,
  PAST_DUE,
} from '../../test/grading/fixtures';

describe('instructor gradebook grade mapping (P0)', () => {
  it('maps submission.excused to EXCUSED_GRADE', () => {
    expect(submissionToGradebookValue({ excused: true, grade: 0 })).toBe(EXCUSED_GRADE);
  });

  it('maps discussion excused row', () => {
    expect(discussionGradeToGradebookValue({ excused: true, grade: 50 })).toBe(EXCUSED_GRADE);
  });

  it('excused in grades map excluded from instructor-style overall', () => {
    const groups = [{ name: 'Assignments', weight: 100 }];
    const gradedId = 'assign-g';
    const excusedId = 'assign-e';
    const assignments = [
      buildAssignment({ id: gradedId, group: 'Assignments' }),
      buildAssignment({ id: excusedId, group: 'Assignments', dueDate: PAST_DUE }),
    ];
    const grades = buildGrades(STUDENT_ID, {
      [gradedId]: 80,
      [excusedId]: EXCUSED_GRADE,
    });
    const submissionMap = buildSubmissionMap([gradedId, excusedId]);
    const percent = computeStudentWeightedPercent(
      STUDENT_ID,
      buildCourse(groups),
      assignments,
      grades,
      submissionMap,
      [{ _id: 'sub-e', excused: true }]
    );
    expect(percent).toBeCloseTo(80, 5);
  });
});
