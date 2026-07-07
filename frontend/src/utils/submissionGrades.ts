import { resolveAssignmentGrade } from './gradeUtils';

type SubmissionGradeSource = {
  grade?: number | null;
  finalGrade?: number | null;
  autoGrade?: number | null;
  autoGraded?: boolean;
  excused?: boolean;
  useIndividualGrades?: boolean;
  memberGrades?: Array<{ student?: unknown; grade?: number; excused?: boolean }>;
  _memberStudentId?: string;
};

/**
 * Canonical earned points for student-facing displays.
 * Matches gradebook (`resolveAssignmentGrade`) then falls back to finalGrade / autoGrade.
 * Important: `grade` wins over `finalGrade` when both exist — stale finalGrade=0 must not hide grade=50.
 */
export function resolveSubmissionDisplayGrade(
  submission: SubmissionGradeSource | null | undefined
): number | null {
  if (!submission) return null;

  const fromGradebook = resolveAssignmentGrade({ submission });
  if (typeof fromGradebook === 'number') return fromGradebook;

  if (typeof submission.finalGrade === 'number') return submission.finalGrade;
  if (submission.autoGraded && typeof submission.autoGrade === 'number') return submission.autoGrade;

  return null;
}
