/**
 * Shared gradebook UI/export calculation helpers (mirrors GradebookView.getWeightedGrade).
 */
import {
  calculateFinalGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  computeGroupPointTotals,
  courseContextFromResolvedPolicy,
  enrichResolvedForAssignmentOrder,
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
      hasSubmitted:
        a.hasSubmitted === true || hasReplyByUser(a.replies || [], studentId),
    };
  });
}

/**
 * Merge API resolved policy with course fields so missing-assignment rules always apply
 * even when the policy payload omits groups (must match backend grade engine).
 */
export function normalizeResolvedPolicyForCourse(
  course: Course,
  resolved?: ResolvedGradingPolicy | null,
  assignments: Array<{ _id: unknown }> = []
): ResolvedGradingPolicy | null {
  const courseGroups = course.groups ?? [];
  let base: ResolvedGradingPolicy | null = resolved ?? null;
  if (!base && (courseGroups.length > 0 || course.gradingPolicy)) {
    base = resolveGradingPolicy({ course }) as ResolvedGradingPolicy;
  }
  if (!base) return null;
  const groups =
    base.groups && base.groups.length > 0 ? base.groups : courseGroups;
  const gradeScale =
    base.gradeScale && base.gradeScale.length > 0
      ? base.gradeScale
      : course.gradeScale;
  let normalized: ResolvedGradingPolicy = {
    ...base,
    groups,
    ...(gradeScale ? { gradeScale } : {}),
  };
  if (
    assignments.length > 0 &&
    normalized.policyApplication?.applyMode === 'from_assignment'
  ) {
    normalized = enrichResolvedForAssignmentOrder(
      normalized,
      assignments as { _id: string; [key: string]: unknown }[]
    ) as ResolvedGradingPolicy;
  }
  return normalized;
}

function buildCourseContext(
  course: Course,
  resolvedFromApi?: ResolvedGradingPolicy | null,
  assignments: Array<{ _id: unknown }> = []
) {
  const normalized = normalizeResolvedPolicyForCourse(course, resolvedFromApi, assignments);
  if (normalized) {
    const ctx = {
      groups: normalized.groups as Course['groups'],
      gradeScale: (normalized.gradeScale as Course['gradeScale']) || course.gradeScale,
      gradingPolicy: normalized,
    };
    return { ctx, policy: normalized };
  }
  if ((course.groups?.length ?? 0) > 0 || course.gradingPolicy) {
    const resolved = resolveGradingPolicy({ course }) as ResolvedGradingPolicy;
    return { ctx: courseContextFromResolvedPolicy(resolved), policy: resolved };
  }
  return { ctx: course, policy: undefined };
}

/** Current grade % (graded-only / exclude-until-graded rules). */
export function computeStudentCurrentPercent(
  studentId: string,
  course: Course,
  assignments: any[],
  grades: Grades,
  submissionMap: { [key: string]: string },
  studentSubmissions: any[] = [],
  resolvedPolicy?: ResolvedGradingPolicy | null
): number {
  return computeStudentWeightedPercent(
    studentId,
    course,
    assignments,
    grades,
    submissionMap,
    studentSubmissions,
    resolvedPolicy
  );
}

/** Projected final % (all published assignments; ungraded = zero). */
export function computeStudentProjectedFinalPercent(
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
  const { ctx, policy } = buildCourseContext(course, resolvedPolicy, augmentedAssignments);
  return calculateProjectedFinalGradeWithWeightedGroups(
    studentId,
    ctx,
    augmentedAssignments,
    grades,
    studentSubmissionMap,
    policy
  );
}

/** @deprecated Use computeStudentCurrentPercent — kept for existing imports. */
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
  const { ctx, policy } = buildCourseContext(course, resolvedPolicy, augmentedAssignments);
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

export type AssignmentGroupStats = {
  totalEarned: number;
  totalPossible: number;
  includedCount: number;
  totalInGroup: number;
  contributesToGrade: boolean;
  percentage: number | null;
};

/**
 * Per-group display stats aligned with the canonical grading engine (matches course total rules).
 */
export function computeAssignmentGroupStats(
  studentId: string,
  groupName: string,
  groupAssignments: any[],
  course: Course,
  grades: Grades,
  submissionMap: { [key: string]: string },
  studentSubmissions: any[] = [],
  resolvedPolicy?: ResolvedGradingPolicy | null
): AssignmentGroupStats {
  const studentSubmissionMap = buildStudentSubmissionMapFromComposite(
    studentId,
    submissionMap,
    studentSubmissions
  );
  const augmentedAssignments = augmentAssignmentsForStudent(groupAssignments, studentId);
  const { policy } = buildCourseContext(course, resolvedPolicy, augmentedAssignments);

  const pointTotals = computeGroupPointTotals(
    studentId,
    augmentedAssignments,
    grades,
    studentSubmissionMap,
    policy,
    groupName
  );

  return pointTotals;
}
