export interface Assignment {
  _id: string;
  title: string;
  group?: string;
  totalPoints: number;
  questions?: { points?: number }[];
  isDiscussion?: boolean;
  dueDate?: string;
  published: boolean;
  hasSubmitted?: boolean;
}

export interface Group {
  name: string;
  weight: number;
}

export interface GroupWithGrades extends Group {
  originalWeight: number;
  earned: number;
  possible: number;
  percent: number;
}

export interface ResolvedGradingPolicy extends GradingPolicyConfig {
  groups?: Group[];
  gradeScale?: { letter: string; min: number; max: number }[];
  _meta?: Record<string, unknown>;
  source?: string;
}

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

export interface Course {
  groups: Group[];
  gradeScale?: { letter: string; min: number; max: number }[];
  gradingPolicy?: GradingPolicyConfig;
}

export interface Grades {
  [studentId: string]: {
    [assignmentId: string]: number | string;
  };
}

export type GradebookCellMarker =
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'RED'
  | 'BLUE'
  | 'GRAY'
  | 'PURPLE'
  | 'PENDING';

export interface GradebookCellExport {
  display: string;
  marker: GradebookCellMarker;
}
