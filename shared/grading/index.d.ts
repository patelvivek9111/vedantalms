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
  categoryCaps?: {
    enabled: boolean;
    caps: { groupName: string; maxWeightPercent: number }[];
  };
  attendance?: {
    mode: 'weighted_group' | 'excluded' | 'separate_weight';
    groupName?: string;
    weightPercent?: number | null;
  };
  gpaScale?: {
    type: 'letter' | 'four_point' | 'percentage';
    mappings?: { letter: string; points: number }[];
  };
}

export interface CourseGradingContext {
  groups?: { name: string; weight: number }[];
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

export function calculateFinalGradeWithWeightedGroups(
  studentId: string,
  course: CourseGradingContext,
  assignments: { _id: string; group?: string; [key: string]: unknown }[],
  grades: Record<string, Record<string, number | string>>,
  submissions?: Record<string, unknown>,
  policyOverride?: GradingPolicyConfig | null
): number;

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
