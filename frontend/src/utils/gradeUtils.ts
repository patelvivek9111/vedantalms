// Types for consumers; implementation lives in shared/grading (ESM for Vite, CJS for Node).

export type {
  Assignment,
  Group,
  GroupWithGrades,
  GradingPolicyConfig,
  ResolvedGradingPolicy,
  Course,
  Grades,
  GradebookCellMarker,
  GradebookCellExport,
} from './gradeUtils.types';

export {
  calculateFinalGradeWithWeightedGroups,
  getWeightedGradeForStudent,
  getLetterGrade,
  EXCUSED_GRADE,
  isExcusedGrade,
  buildGradesMapForStudent,
  resolveAssignmentGrade,
  getGradebookCellForExport,
  DEFAULT_GRADING_POLICY,
  DEFAULT_GRADE_SCALE,
  resolveGradingPolicy,
  courseContextFromResolvedPolicy,
  validateGradingPolicy,
  getGpaPoints,
  extractPolicyVersion,
  diffPolicies,
  summarizePolicyDiff,
  getGradingEngineVersion,
  GRADING_ENGINE_VERSION,
} from '@lms-shared/grading';
