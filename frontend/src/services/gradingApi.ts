import api from './api';
import type { GradingPolicyConfig } from '../utils/gradeUtils';

export interface PolicyImpactStudentRow {
  studentId: string;
  displayName: string;
  email: string | null;
  currentPercent: number;
  proposedPercent: number;
  deltaPercent: number;
  currentLetter: string;
  proposedLetter: string;
  changed: boolean;
}

export interface PolicyImpactAssignmentOption {
  id: string;
  title: string;
  group?: string;
}

export interface PolicyImpactPreview {
  applyMode: string;
  effectiveAt: string | null;
  effectiveAssignmentId?: string | null;
  lifecycleStatus: string;
  currentPolicyHash: string;
  proposedPolicyHash: string;
  policyUnchanged: boolean;
  policyDiff: {
    changed: Array<{ path: string; before: unknown; after: unknown }>;
    added: string[];
    removed: string[];
    summaryLines: string[];
  };
  summary: {
    studentCount: number;
    affectedCount: number;
    unchangedCount: number;
    maxDeltaPercent: number;
    letterChanges: number;
  };
  students: PolicyImpactStudentRow[];
  assignments?: PolicyImpactAssignmentOption[];
}

export async function fetchCourseGradingPolicy(courseId: string) {
  const res = await api.get(`/grading-policy/course/${courseId}`);
  return res.data;
}

export async function saveCourseGradingPolicy(
  courseId: string,
  policy: GradingPolicyConfig,
  options?: {
    reason?: string;
    applyMode?: 'retroactive_all' | 'prospective_only' | 'from_assignment';
    effectiveAt?: string;
    effectiveAssignmentId?: string;
    impactSummary?: PolicyImpactPreview['summary'];
  }
) {
  const res = await api.put(`/grading-policy/course/${courseId}`, {
    policy,
    reason: options?.reason,
    applyMode: options?.applyMode,
    effectiveAt: options?.effectiveAt,
    effectiveAssignmentId: options?.effectiveAssignmentId,
    impactSummary: options?.impactSummary,
  });
  return res.data;
}

export async function previewCoursePolicyImpact(
  courseId: string,
  body: {
    policy: GradingPolicyConfig;
    applyMode?: 'retroactive_all' | 'prospective_only' | 'from_assignment';
    studentIds?: string[];
    effectiveAt?: string;
    effectiveAssignmentId?: string;
  }
) {
  const res = await api.post(`/grading-policy/course/${courseId}/impact-preview`, body);
  return res.data;
}

export async function previewCourseGradingPolicy(
  courseId: string,
  body: { policy: GradingPolicyConfig; sampleAssignments?: unknown[]; sampleGrades?: unknown[] }
) {
  const res = await api.post(`/grading-policy/course/${courseId}/preview`, body);
  return res.data;
}

export async function fetchEffectiveCoursePolicy(courseId: string) {
  const res = await api.get(`/grading-policy/course/${courseId}/effective`);
  return res.data;
}

export async function fetchPolicyAudit(entityType: 'institution' | 'course', entityId: string) {
  const res = await api.get(`/grading-policy/audit/${entityType}/${entityId}`);
  return res.data;
}

export async function fetchInstitutionGradingPolicy() {
  const res = await api.get('/grading-policy/institution');
  return res.data;
}

export async function saveInstitutionGradingPolicy(policy: GradingPolicyConfig) {
  const res = await api.put('/grading-policy/institution', { policy });
  return res.data;
}

export interface InstitutionPolicyImpactSummary {
  totalPublishedCourses: number;
  finalizedCourseCount: number;
  liveRecalcCourseCount: number;
}

export async function fetchInstitutionPolicyImpactSummary() {
  const res = await api.get('/grading-policy/institution/impact-summary');
  return res.data as { success: boolean; data: InstitutionPolicyImpactSummary };
}

export async function dryRunTranscriptRecompute(courseId: string, term?: string, year?: number) {
  const res = await api.post('/grading-policy/transcript/recompute', {
    courseId,
    term,
    year,
    dryRun: true,
  });
  return res.data;
}

export async function fetchCourseLifecycleStatus(courseId: string) {
  const res = await api.get(`/grades/course/${courseId}/lifecycle/status`);
  return res.data;
}

export async function fetchCourseLifecycle(courseId: string) {
  const res = await api.get(`/grades/course/${courseId}/lifecycle`);
  return res.data;
}

export async function fetchLifecycleProvenance(courseId: string) {
  const res = await api.get(`/grades/course/${courseId}/provenance`);
  return res.data;
}

export async function fetchLifecycleAuditTimeline(courseId: string) {
  const res = await api.get(`/grades/course/${courseId}/audit-timeline`);
  return res.data;
}

export async function postCourseGrades(courseId: string) {
  const res = await api.post(`/grades/course/${courseId}/post`, {});
  return res.data;
}

export async function finalizeCourseGrades(courseId: string) {
  const res = await api.post(`/grades/course/${courseId}/finalize`, {});
  return res.data;
}

export async function amendCourseGrades(courseId: string, reason: string) {
  const res = await api.post(`/grades/course/${courseId}/amend`, { reason });
  return res.data;
}

export interface GradingPeriod {
  _id: string;
  name: string;
  position: number;
  startDate?: string | null;
  endDate?: string | null;
  closeDate?: string | null;
  closed?: boolean;
  weight?: number | null;
}

export interface GradingPeriodSettings {
  allowStudentAllPeriods: boolean;
  displayTotalsForAllPeriods: boolean;
}

export interface GradingPeriodBreakdownRow {
  periodId: string;
  periodName: string;
  weight: number;
  currentPercent: number | null;
  finalPercent: number | null;
  letterGrade: string | null;
  finalLetterGrade: string | null;
}

export async function fetchCourseGradingPeriods(courseId: string) {
  const res = await api.get(`/grades/course/${courseId}/grading-periods`);
  return res.data as {
    success: boolean;
    data: GradingPeriod[];
    settings?: GradingPeriodSettings;
  };
}

export interface GradingPeriodInput {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  closeDate?: string | null;
  closed?: boolean;
  weight?: number | null;
}

export async function createCourseGradingPeriod(
  courseId: string,
  body: GradingPeriodInput & { name: string }
) {
  const res = await api.post(`/grades/course/${courseId}/grading-periods`, body);
  return res.data;
}

export async function updateCourseGradingPeriod(
  courseId: string,
  periodId: string,
  body: GradingPeriodInput
) {
  const res = await api.patch(`/grades/course/${courseId}/grading-periods/${periodId}`, body);
  return res.data;
}

export interface GradingPeriodDeletionImpact {
  period: GradingPeriod;
  assignmentCount: number;
  discussionCount: number;
  hasAssignmentsOrGrades: boolean;
  periodWasClosed: boolean;
  remainingPeriodCount: number;
  weightWarning: string | null;
  preservesSnapshots: boolean;
}

export interface GradingPeriodDeleteResult {
  deletedPeriod: GradingPeriod;
  assignmentsUnassigned: number;
  discussionsUnassigned: number;
  remainingPeriodCount: number;
  totalRemainingWeight: number;
  weightWarning: string | null;
  periodWasClosed: boolean;
  preservesSnapshots: boolean;
}

export async function fetchGradingPeriodDeletionImpact(courseId: string, periodId: string) {
  const res = await api.get(
    `/grades/course/${courseId}/grading-periods/${periodId}/deletion-impact`
  );
  return res.data as { success: boolean; data: GradingPeriodDeletionImpact };
}

export async function deleteCourseGradingPeriod(courseId: string, periodId: string) {
  const res = await api.delete(`/grades/course/${courseId}/grading-periods/${periodId}`);
  return res.data as { success: boolean; data: GradingPeriodDeleteResult };
}

export async function updateGradingPeriodSettings(
  courseId: string,
  settings: Partial<GradingPeriodSettings>
) {
  const res = await api.patch(`/grades/course/${courseId}/grading-periods/settings`, settings);
  return res.data as { success: boolean; data: GradingPeriodSettings };
}

export async function applyGradingPeriodTemplate(
  courseId: string,
  template: 'quarters' | 'semesters' | 'terms'
) {
  const res = await api.post(`/grades/course/${courseId}/grading-periods/templates`, { template });
  return res.data;
}

export async function fetchGradebookCellHistory(
  courseId: string,
  params?: { studentId?: string; assignmentId?: string; limit?: number }
) {
  const res = await api.get(`/grades/course/${courseId}/gradebook/history`, { params });
  return res.data;
}

export interface StudentGradeOverride {
  finalPercent: number;
  letterGrade?: string | null;
  reason?: string;
  active?: boolean;
}

export async function fetchStudentGradeOverride(courseId: string, studentId: string) {
  const res = await api.get(`/grades/course/${courseId}/students/${studentId}/grade-override`);
  return res.data as { success: boolean; data: StudentGradeOverride | null };
}

export async function setStudentGradeOverride(
  courseId: string,
  studentId: string,
  body: { finalPercent: number; letterGrade?: string; reason?: string }
) {
  const res = await api.put(`/grades/course/${courseId}/students/${studentId}/grade-override`, body);
  return res.data;
}

export async function clearStudentGradeOverride(courseId: string, studentId: string) {
  const res = await api.delete(`/grades/course/${courseId}/students/${studentId}/grade-override`);
  return res.data;
}
