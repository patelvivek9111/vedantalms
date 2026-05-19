/**
 * Shared gradebook UI/export calculation helpers (mirrors GradebookView.getWeightedGrade).
 */
import {
  calculateFinalGradeWithWeightedGroups,
  courseContextFromResolvedPolicy,
  resolveGradingPolicy,
  type Course,
  type Grades,
  type GradingPolicyConfig,
  type ResolvedGradingPolicy,
} from './gradeUtils';

function hasReplyByUser(replies: any[], userId: string): boolean {
  if (!Array.isArray(replies)) return false;
  const stack = [...replies];
  while (stack.length) {
    const r = stack.pop();
    const authorId = r?.author?._id || r?.author;
    if (String(authorId) === String(userId)) return true;
    if (Array.isArray(r?.replies)) stack.push(...r.replies);
  }
  return false;
}

/**
 * Composite keys `studentId_assignmentId` → assignmentId → submission ref/object for shared grading.
 */
export function buildStudentSubmissionMapFromComposite(
  studentId: string,
  submissionMap: { [key: string]: string },
  studentSubmissions: any[] = []
): { [assignmentId: string]: any } {
  const sid = String(studentId);
  const prefix = `${sid}_`;
  const byAssignment: { [assignmentId: string]: any } = {};

  for (const [key, submissionId] of Object.entries(submissionMap)) {
    if (!key.startsWith(prefix)) continue;
    const assignmentId = key.slice(prefix.length);
    const sub = studentSubmissions.find((s) => String(s._id) === String(submissionId));
    byAssignment[assignmentId] = sub ?? { _id: submissionId };
  }
  return byAssignment;
}

export function augmentAssignmentsForStudent(assignments: any[], studentId: string): any[] {
  return assignments.map((a) => {
    if (!a.isDiscussion) return a;
    return {
      ...a,
      hasSubmitted: hasReplyByUser(a.replies || [], studentId),
    };
  });
}

function buildCourseContext(course: Course, resolvedFromApi?: ResolvedGradingPolicy | null) {
  if (resolvedFromApi?.groups) {
    const ctx = {
      groups: resolvedFromApi.groups as Course['groups'],
      gradeScale: (resolvedFromApi.gradeScale as Course['gradeScale']) || course.gradeScale,
      gradingPolicy: resolvedFromApi,
    };
    return { ctx, policy: resolvedFromApi };
  }
  if (course.gradingPolicy) {
    const resolved = resolveGradingPolicy({ course });
    return { ctx: courseContextFromResolvedPolicy(resolved), policy: resolved };
  }
  return { ctx: course, policy: undefined };
}

/** Canonical per-student weighted % (same as GradebookView overall column). */
export function computeStudentWeightedPercent(
  studentId: string,
  course: Course,
  assignments: any[],
  grades: Grades,
  submissionMap: { [key: string]: string },
  studentSubmissions: any[] = [],
  resolvedPolicy?: ResolvedGradingPolicy | null
): number {
  const studentSubmissionMap = buildStudentSubmissionMapFromComposite(
    studentId,
    submissionMap,
    studentSubmissions
  );
  const augmentedAssignments = augmentAssignmentsForStudent(assignments, studentId);
  const { ctx, policy } = buildCourseContext(course, resolvedPolicy);
  return calculateFinalGradeWithWeightedGroups(
    studentId,
    ctx,
    augmentedAssignments,
    grades,
    studentSubmissionMap,
    policy
  );
}

/**
 * Per-group % using shared grading (single synthetic 100% weight group).
 */
export function computeAssignmentGroupPercent(
  studentId: string,
  groupName: string,
  groupAssignments: any[],
  course: Course,
  grades: Grades,
  submissionMap: { [key: string]: string },
  studentSubmissions: any[] = []
): number {
  if (groupAssignments.length === 0) return 0;
  const normalized = groupAssignments.map((a) => ({ ...a, group: groupName }));
  const syntheticCourse: Course = {
    groups: [{ name: groupName, weight: 100 }],
    gradeScale: course.gradeScale,
  };
  return computeStudentWeightedPercent(
    studentId,
    syntheticCourse,
    normalized,
    grades,
    submissionMap,
    studentSubmissions
  );
}
