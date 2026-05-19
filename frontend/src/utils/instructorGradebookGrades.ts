/**
 * Maps API submission rows to gradebook cell values using shared resolveAssignmentGrade.
 */
import { resolveAssignmentGrade, EXCUSED_GRADE } from './gradeUtils';

export type GradebookCellValue = number | typeof EXCUSED_GRADE | '-';

export function submissionToGradebookValue(
  submission: any,
  memberStudentId?: string
): GradebookCellValue {
  const resolved = resolveAssignmentGrade({
    submission: memberStudentId
      ? { ...submission, _memberStudentId: memberStudentId }
      : submission,
  });
  if (resolved === null || resolved === undefined) return '-';
  return resolved;
}

export function discussionGradeToGradebookValue(discussionGradeRow: any): GradebookCellValue {
  const resolved = resolveAssignmentGrade({ discussionGradeRow: discussionGradeRow || null });
  if (resolved === null || resolved === undefined) return '-';
  return resolved;
}

export function assignGradebookCell(
  grades: { [studentId: string]: { [assignmentId: string]: number | string } },
  studentId: string,
  assignmentId: string,
  value: GradebookCellValue
) {
  const sid = String(studentId);
  const aid = String(assignmentId);
  if (!grades[sid]) grades[sid] = {};
  grades[sid][aid] = value;
}
