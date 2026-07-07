/**
 * Maps API submission rows to gradebook cell values using shared resolveAssignmentGrade.
 */
import { resolveAssignmentGrade, EXCUSED_GRADE } from './gradeUtils';
import { normalizeMongoIdRef } from './mongoId';
import { findStudentDiscussionGradeRow } from './discussionGradeDisplay';

export type GradebookCellValue = number | typeof EXCUSED_GRADE | '-';

export function findDiscussionGradeRowForStudent(assignment: any, studentId: string) {
  return findStudentDiscussionGradeRow(assignment?.studentGrades, studentId);
}

export function resolveInstructorDiscussionCellGrade(
  grades: { [studentId: string]: { [assignmentId: string]: number | string } },
  studentId: string,
  assignment: any
): GradebookCellValue {
  const sid = normalizeMongoIdRef(studentId);
  const aid = normalizeMongoIdRef(assignment?._id);
  const fromMap = grades[sid]?.[aid];
  if (typeof fromMap === 'number' || fromMap === EXCUSED_GRADE || fromMap === 'excused') {
    return fromMap as GradebookCellValue;
  }
  return discussionGradeToGradebookValue(findDiscussionGradeRowForStudent(assignment, sid));
}

export function discussionHasSubmissionForStudent(assignment: any, studentId: string): boolean {
  if (assignment?.hasPosted === true || assignment?.hasSubmitted === true) return true;
  const row = findDiscussionGradeRowForStudent(assignment, studentId);
  if (row && (typeof row.grade === 'number' || row.excused === true)) return true;
  if (Array.isArray(assignment?.replies)) {
    const sid = normalizeMongoIdRef(studentId);
    return assignment.replies.some(
      (r: any) => normalizeMongoIdRef(r.author) === sid
    );
  }
  return false;
}

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
