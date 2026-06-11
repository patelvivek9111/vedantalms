import api from './api';
import type { GradingPolicyConfig } from '../utils/gradeUtils';

export async function fetchCourseGradingPolicy(courseId: string) {
  const res = await api.get(`/grading-policy/course/${courseId}`);
  return res.data;
}

export async function saveCourseGradingPolicy(courseId: string, policy: GradingPolicyConfig) {
  const res = await api.put(`/grading-policy/course/${courseId}`, { policy });
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
