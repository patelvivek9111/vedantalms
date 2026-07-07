import { describe, it, expect } from 'vitest';
import { GRADE_STATUS } from '@lms-shared/grading';
import { resolveStudentGradeRowDisplay } from '@/components/grades/GradeStatusBadge';
import { formatWhatIfCurrentFromRow } from '@/utils/whatIfCurrentDisplay';

describe('discussion late display', () => {
  const dueDate = new Date('2025-11-01T00:00:00.000Z');
  const latePostAt = new Date('2025-11-10T12:00:00.000Z');

  it('shows Late for ungraded discussion posted after due when studentReplyCreatedAt is set', () => {
    const assignment = {
      _id: 'disc1',
      isDiscussion: true,
      published: true,
      dueDate: dueDate.toISOString(),
      hasSubmitted: true,
      studentReplyCreatedAt: latePostAt.toISOString(),
    };

    const row = resolveStudentGradeRowDisplay({
      assignment,
      studentId: 'stu1',
      hasSubmission: true,
      submittedAt: latePostAt,
      missingAssignmentMode: 'count_as_zero',
      now: new Date('2025-12-01T00:00:00.000Z'),
    });

    expect(row.status).toBe(GRADE_STATUS.LATE);
    expect(formatWhatIfCurrentFromRow(row, 'count_as_zero')).toBe('Late');
  });
});
