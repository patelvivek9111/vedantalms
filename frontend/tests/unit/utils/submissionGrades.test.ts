import { describe, expect, it } from 'vitest';
import { resolveSubmissionDisplayGrade } from '@/utils/submissionGrades';

describe('resolveSubmissionDisplayGrade', () => {
  it('prefers grade over stale finalGrade=0 (matches gradebook)', () => {
    expect(
      resolveSubmissionDisplayGrade({ grade: 50, finalGrade: 0 })
    ).toBe(50);
  });

  it('uses finalGrade when grade is missing', () => {
    expect(resolveSubmissionDisplayGrade({ finalGrade: 88 })).toBe(88);
  });

  it('uses autoGrade when only auto-graded', () => {
    expect(
      resolveSubmissionDisplayGrade({ autoGraded: true, autoGrade: 12 })
    ).toBe(12);
  });

  it('returns null when no score', () => {
    expect(resolveSubmissionDisplayGrade({ finalGrade: 0 })).toBe(0);
    expect(resolveSubmissionDisplayGrade({})).toBeNull();
  });
});
