export interface GradingPolicyConfig {
  version?: number;
  missingAssignment?: { mode: 'count_as_zero' | 'exclude_until_graded' };
  latePenalty?: {
    enabled: boolean;
    mode: 'fixed' | 'per_day';
    fixedPercent?: number;
    perDayPercent?: number;
    gracePeriodHours?: number;
    capPercent?: number;
  };
  dropLowest?: { enabled: boolean; rules: { groupName: string; count: number }[] };
  dropHighest?: { enabled: boolean; rules: { groupName: string; count: number }[] };
  gradeVisibility?: {
    mutedAssignmentsInTotals?: 'exclude' | 'include';
  };
  categoryCaps?: {
    enabled: boolean;
    caps: { groupName: string; maxWeightPercent: number }[];
  };
  attendance?: {
    mode: 'weighted_group' | 'excluded' | 'separate_weight';
    groupName?: string;
    weightPercent?: number | null;
  };
  extraCredit?: {
    enabled?: boolean;
    capPercent?: number | null;
  };
  gpaScale?: {
    type: 'letter' | 'four_point' | 'percentage';
    mappings?: { letter: string; points: number }[];
  };
}

export interface CourseGradingContext {
  groups?: { name: string; weight: number; isExtraCreditGroup?: boolean }[];
  gradeScale?: { letter: string; min: number; max: number }[];
  gradingPolicy?: GradingPolicyConfig;
}

export interface ResolvedGradingPolicy extends GradingPolicyConfig {
  groups?: { name: string; weight: number }[];
  gradeScale?: { letter: string; min: number; max: number }[];
  source?: string;
}

export const EXCUSED_GRADE: string;
export function isExcusedGrade(grade: unknown, submission?: { excused?: boolean }): boolean;
export function resolveAssignmentGrade(args: Record<string, unknown>): number | string | null;
export function buildGradesMapForStudent(...args: unknown[]): Record<string, number | string>;

export const DEFAULT_GRADING_POLICY: GradingPolicyConfig;
export const DEFAULT_GRADE_SCALE: { letter: string; min: number; max: number }[];

export function resolveGradingPolicy(args: Record<string, unknown>): ResolvedGradingPolicy;
export function courseContextFromResolvedPolicy(resolved: ResolvedGradingPolicy): {
  groups: { name: string; weight: number }[];
  gradeScale: { letter: string; min: number; max: number }[];
  gradingPolicy: ResolvedGradingPolicy;
};

export function validateGradingPolicy(
  policy: unknown,
  options?: { partial?: boolean }
): { valid: boolean; errors: string[] };
export function sanitizeGradingPolicy(policy: unknown): GradingPolicyConfig;

export function getGpaPoints(letterGrade: string, gpaScale?: GradingPolicyConfig['gpaScale']): number;

export type GradeMode = 'current' | 'final';

export function calculateCurrentGradeWithWeightedGroups(
  studentId: string,
  course: CourseGradingContext,
  assignments: { _id: string; group?: string; [key: string]: unknown }[],
  grades: Record<string, Record<string, number | string>>,
  submissions?: Record<string, unknown>,
  policyOverride?: GradingPolicyConfig | null
): number;

export function calculateProjectedFinalGradeWithWeightedGroups(
  studentId: string,
  course: CourseGradingContext,
  assignments: { _id: string; group?: string; [key: string]: unknown }[],
  grades: Record<string, Record<string, number | string>>,
  submissions?: Record<string, unknown>,
  policyOverride?: GradingPolicyConfig | null
): number;

/** @deprecated Alias for calculateCurrentGradeWithWeightedGroups (backwards compatible). */
export function calculateFinalGradeWithWeightedGroups(
  studentId: string,
  course: CourseGradingContext,
  assignments: { _id: string; group?: string; [key: string]: unknown }[],
  grades: Record<string, Record<string, number | string>>,
  submissions?: Record<string, unknown>,
  policyOverride?: GradingPolicyConfig | null
): number;

/**
 * @deprecated Legacy weighted calculator — use calculateFinalGradeWithWeightedGroups.
 */
export function getWeightedGradeForStudent(
  studentId: string,
  course: CourseGradingContext,
  assignments: { _id: string; group?: string; [key: string]: unknown }[],
  grades: Record<string, Record<string, number | string>>,
  submissions?: Record<string, unknown>
): number;

export function getLetterGrade(
  percent: number,
  gradeScale?: { letter: string; min: number; max: number }[]
): string;

export function computeGroupPointTotals(
  studentId: string,
  groupAssignments: { _id: string; group?: string; [key: string]: unknown }[],
  grades: Record<string, Record<string, number | string>>,
  submissions?: Record<string, unknown>,
  policy?: GradingPolicyConfig | null,
  groupName?: string | null,
  gradeMode?: GradeMode,
  courseGroups?: { name: string; isExtraCreditGroup?: boolean }[]
): {
  totalEarned: number;
  totalPossible: number;
  includedCount: number;
  totalInGroup: number;
  contributesToGrade: boolean;
  percentage: number | null;
};

export type GroupTotals = {
  earned: number;
  possible: number;
  extraCreditEarned: number;
  hasGradedAssignments: boolean;
};

export function isExtraCreditGroup(group: { isExtraCreditGroup?: boolean }): boolean;
export function isExtraCreditAssignment(
  assignment: { isExtraCredit?: boolean; group?: string; [key: string]: unknown },
  courseGroups?: { name: string; isExtraCreditGroup?: boolean }[]
): boolean;
export function extraCreditEnabled(policy: GradingPolicyConfig | null | undefined): boolean;
export function assignmentBonusPoints(assignment: { bonusPoints?: number }): number;
export function applyExtraCreditToCourseTotal(
  basePercent: number,
  extraCreditEarned: number,
  regularPossible: number,
  policy: GradingPolicyConfig | null | undefined
): number;

export function createGroupTotals(): GroupTotals;

/** Canvas-style: group active when it has contributing graded or missing-as-zero work (current), or any published work (final). */
export function isAssignmentGroupActive(totals: GroupTotals, gradeMode?: GradeMode): boolean;

export function assignmentContributesToGrade(
  assignment: { _id: string; [key: string]: unknown },
  studentId: string,
  grades: Record<string, Record<string, number | string>>,
  submissions: Record<string, unknown>,
  now: Date,
  policy: GradingPolicyConfig | null | undefined,
  gradeMode?: GradeMode
): { earned: number; possible: number } | null;

export function applyAssignmentToGroupTotals(
  assignment: { _id: string; [key: string]: unknown },
  studentId: string,
  grades: Record<string, Record<string, number | string>>,
  submissions: Record<string, unknown>,
  now: Date,
  totals: GroupTotals,
  policy: GradingPolicyConfig | null | undefined,
  gradeMode?: GradeMode,
  courseGroups?: { name: string; isExtraCreditGroup?: boolean }[]
): void;

export function assignmentMaxPoints(assignment: {
  questions?: { points?: number }[];
  totalPoints?: number;
}): number;

export function isUnpublished(assignment: {
  isDiscussion?: boolean;
  published?: boolean;
}): boolean;

export function hasSubmissionForAssignment(
  assignment: { isDiscussion?: boolean; hasSubmitted?: boolean },
  submissions: Record<string, unknown>,
  assignmentId: string
): boolean;

export type GradeStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'GRADED'
  | 'MISSING'
  | 'EXCUSED'
  | 'LATE'
  | 'HIDDEN'
  | 'PENDING_REVIEW'
  | 'MANUAL_POST'
  | 'AUTO_POST'
  | 'UNPUBLISHED'
  | 'OFFLINE_PENDING';

export const GRADE_STATUS: Record<string, GradeStatus>;

export const GRADE_STATUS_LABELS: Record<GradeStatus, string>;

export function hasSubmissionScore(submission: unknown): boolean;

export function releaseModeForAssignment(assignment: { gradeReleaseMode?: string }): string;

export function isScoreReleased(submission: unknown, assignment: unknown): boolean;

export function resolveSubmissionGradeStatus(args: {
  assignment: { _id?: string; [key: string]: unknown };
  submission?: unknown | null;
  grade?: number | string | null;
  now?: Date;
  perspective?: 'instructor' | 'student';
  policy?: GradingPolicyConfig | null;
  studentId?: string | null;
  hasSubmission?: boolean;
  submittedAt?: Date | null;
}): { status: GradeStatus; score?: number; submittedAt?: Date | null };

export function gradebookCellFromStatus(
  statusResult: { status: GradeStatus; score?: number },
  ctx: { grade?: number | string; assignment: { [key: string]: unknown } }
): { display: string; marker: GradebookCellMarker; status: GradeStatus };

export function mapWorkflowStateToGradeStatus(workflowState: string): GradeStatus;

export function mapGradeStatusToWorkflowState(
  statusResult: { status: GradeStatus },
  ctx: {
    assignment?: { [key: string]: unknown } | null;
    submission?: unknown | null;
    module?: { published?: boolean } | null;
    now?: Date;
  }
): string;

export function getGradeStatusLabel(status: GradeStatus): string;

export function shouldShowStudentStatusBadge(status: GradeStatus): boolean;

export type GradebookCellMarker =
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'RED'
  | 'BLUE'
  | 'GRAY'
  | 'PURPLE'
  | 'PENDING';

export function getGradebookCellForExport(...args: unknown[]): {
  display: string;
  marker: GradebookCellMarker;
};

export function applyLatePenaltyToEarned(...args: unknown[]): number;
export function getDroppedAssignmentIds(...args: unknown[]): string[];

export function stableStringifyPolicy(policy: unknown): string;
export function hashResolvedPolicy(policy: object): string;
export function generateResolvedPolicySnapshot(resolved: object): {
  policyVersion: number;
  policyHash: string;
  resolvedPolicySnapshot: object;
};
export function extractPolicyVersion(resolved: object): number;
export function resolvedPolicyFromSnapshot(storedSnapshot: object): object | null;

export function diffPolicies(
  oldPolicy: object,
  newPolicy: object
): {
  changed: { path: string; before: unknown; after: unknown }[];
  added: string[];
  removed: string[];
};
export const GRADING_ENGINE_VERSION: string;
export function getGradingEngineVersion(): string;
export function parseEngineVersion(version: string): { major: number; minor: number; patch: number };
export function compareEngineVersions(a: string, b: string): number;

export function summarizePolicyDiff(diff: {
  changed: { path: string; before: unknown; after: unknown }[];
  added: string[];
  removed: string[];
}): string[];
