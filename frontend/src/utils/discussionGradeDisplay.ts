/**
 * Resolve a released discussion score for the student assignment list / grades views.
 */
import { normalizeMongoIdRef } from './mongoId';

export type DiscussionStudentGradeRow = {
  student?: unknown;
  grade?: number | null;
  feedback?: string | null;
  gradedAt?: string | Date | null;
  gradeVisibility?: { scoreVisible?: boolean; feedbackVisible?: boolean };
  excused?: boolean;
};

export function findStudentDiscussionGradeRow(
  studentGrades: DiscussionStudentGradeRow[] | undefined,
  studentId?: string
): DiscussionStudentGradeRow | null {
  if (!Array.isArray(studentGrades) || !studentId) return null;
  const sid = normalizeMongoIdRef(studentId);
  return (
    studentGrades.find((g) => normalizeMongoIdRef(g.student) === sid) ?? null
  );
}

export function isDiscussionGradeReleasedToStudent(
  item: {
    gradeVisibility?: { scoreVisible?: boolean; mode?: string };
    discussionReleaseMode?: string;
    gradesReleasedAt?: string | Date | null;
    gradeHidden?: boolean;
  } = {}
): boolean {
  if (item.gradeVisibility?.scoreVisible === true) return true;
  if (item.gradeVisibility?.scoreVisible === false) return false;
  if (item.gradeHidden === true) return false;
  const mode = item.discussionReleaseMode || 'immediate';
  if (mode === 'hidden') return false;
  if (item.gradesReleasedAt) return true;
  return mode === 'immediate';
}

export function isDiscussionGradePendingRelease(
  item: {
    gradeVisibility?: { scoreVisible?: boolean; mode?: string };
  } = {}
): boolean {
  return item.gradeVisibility?.scoreVisible === false && item.gradeVisibility?.mode === 'hidden';
}

export function resolveStudentDiscussionEarnedScore(
  item: {
    grade?: number | null;
    gradeVisibility?: { scoreVisible?: boolean };
    studentGrades?: Array<{
      student?: string | { _id?: string };
      grade?: number | null;
      gradeVisibility?: { scoreVisible?: boolean };
    }>;
  },
  studentId?: string
): number | null {
  if (item.gradeVisibility?.scoreVisible === false) return null;
  if (typeof item.grade === 'number' && !Number.isNaN(item.grade)) {
    return item.grade;
  }

  const grades = item.studentGrades;
  if (!Array.isArray(grades) || grades.length === 0) return null;

  const sid = studentId ? normalizeMongoIdRef(studentId) : null;
  const row =
    (sid ? findStudentDiscussionGradeRow(grades, sid) : null) ||
    (grades.length === 1 ? grades[0] : null);

  if (!row) return null;
  if (row.gradeVisibility?.scoreVisible === false) return null;
  return typeof row.grade === 'number' && !Number.isNaN(row.grade) ? row.grade : null;
}

/** Student-visible grades map: submissions + released discussion scores only. */
export function buildStudentVisibleGradesMap(
  studentId: string,
  assignments: Array<{ _id: unknown; isDiscussion?: boolean } & Parameters<typeof resolveStudentDiscussionEarnedScore>[0]>,
  gradebookGrades: { [studentId: string]: { [assignmentId: string]: number | string } }
): { [studentId: string]: { [assignmentId: string]: number | string } } {
  const sid = String(studentId);
  const merged: { [assignmentId: string]: number | string } = {
    ...(gradebookGrades[sid] || {}),
  };

  for (const assignment of assignments) {
    const aid = String(assignment._id);
    if (!assignment.isDiscussion) continue;
    const score = resolveStudentDiscussionEarnedScore(assignment, sid);
    if (score != null) {
      merged[aid] = score;
    } else {
      delete merged[aid];
    }
  }

  return { [sid]: merged };
}

export function resolveStudentDiscussionFeedback(
  assignment: {
    feedback?: string | null;
    gradeVisibility?: { feedbackVisible?: boolean };
    studentGrades?: DiscussionStudentGradeRow[];
  },
  studentId: string
): string {
  if (assignment.gradeVisibility?.feedbackVisible === false) return '';
  if (typeof assignment.feedback === 'string' && assignment.feedback.trim() !== '') {
    return assignment.feedback.trim();
  }
  const row = findStudentDiscussionGradeRow(assignment.studentGrades, studentId);
  if (!row || row.gradeVisibility?.feedbackVisible === false) return '';
  return typeof row.feedback === 'string' ? row.feedback.trim() : '';
}

export function discussionHasSubmissionForStudent(
  assignment: {
    hasSubmitted?: boolean;
    hasPosted?: boolean;
    replies?: Array<{ author?: unknown }>;
  },
  studentId: string
): boolean {
  if (assignment.hasSubmitted === true || assignment.hasPosted === true) return true;
  if (!Array.isArray(assignment.replies)) return false;
  const sid = normalizeMongoIdRef(studentId);
  return assignment.replies.some((r) => normalizeMongoIdRef(r.author) === sid);
}

export function resolveStudentDiscussionSubmittedAt(
  assignment: {
    studentReplyCreatedAt?: string | Date | null;
    replies?: Array<{ author?: unknown; createdAt?: string | Date | null }>;
  },
  studentId: string
): Date | undefined {
  if (assignment.studentReplyCreatedAt) {
    const fromField = new Date(assignment.studentReplyCreatedAt);
    if (!Number.isNaN(fromField.getTime())) return fromField;
  }
  if (!Array.isArray(assignment.replies)) return undefined;
  const sid = normalizeMongoIdRef(studentId);
  const reply = assignment.replies.find((r) => normalizeMongoIdRef(r.author) === sid);
  if (!reply?.createdAt) return undefined;
  const fromReply = new Date(reply.createdAt);
  return Number.isNaN(fromReply.getTime()) ? undefined : fromReply;
}
