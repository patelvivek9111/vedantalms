import { describe, it, expect } from 'vitest';
import { GRADE_STATUS } from '@lms-shared/grading';
import { resolveSubmissionGradeStatus } from '@lms-shared/grading';
import { resolveStudentGradeRowDisplay } from '@/components/grades/GradeStatusBadge';
import { formatWhatIfCurrentFromRow } from '@/utils/whatIfCurrentDisplay';

describe('What-If current column display', () => {
  const pastDue = new Date('2025-11-01T00:00:00Z');
  const lateSubmit = new Date('2025-11-11T10:00:00Z');

  it('shows Late for a late ungraded submission (not 0 missing)', () => {
    const assignment = {
      _id: 'a1',
      published: true,
      dueDate: pastDue.toISOString(),
      lockAfterDue: false,
    };
    const submission = { _id: 's1', submittedAt: lateSubmit.toISOString() };

    const status = resolveSubmissionGradeStatus({
      assignment,
      submission,
      perspective: 'student',
      hasSubmission: true,
      submittedAt: lateSubmit,
      now: new Date('2025-12-01T00:00:00Z'),
    });
    expect(status.status).toBe(GRADE_STATUS.LATE);

    const row = resolveStudentGradeRowDisplay({
      assignment,
      submission,
      studentId: 'stu1',
      hasSubmission: true,
      submittedAt: lateSubmit,
      missingAssignmentMode: 'count_as_zero',
    });
    expect(formatWhatIfCurrentFromRow(row, 'count_as_zero')).toBe('Late');
  });

  it('shows 0 (missing) when there is no submission past due', () => {
    const assignment = {
      _id: 'a2',
      published: true,
      dueDate: pastDue.toISOString(),
    };

    const row = resolveStudentGradeRowDisplay({
      assignment,
      submission: null,
      studentId: 'stu1',
      hasSubmission: false,
      missingAssignmentMode: 'count_as_zero',
      now: new Date('2025-12-01T00:00:00Z'),
    });
    expect(formatWhatIfCurrentFromRow(row, 'count_as_zero')).toBe('0 (missing)');
  });
});
