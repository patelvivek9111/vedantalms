import api from './api';

export interface CopyCourseOptions {
  targetTitle?: string;
  includeAnnouncements?: boolean;
  includeDiscussions?: boolean;
  async?: boolean;
}

export async function copyCourse(courseId: string, options: CopyCourseOptions = {}) {
  const res = await api.post(`/courses/${courseId}/copy`, options);
  return res.data;
}

export async function archiveCourse(courseId: string) {
  const res = await api.patch(`/courses/${courseId}/archive`);
  return res.data;
}

export async function restoreCourse(courseId: string) {
  const res = await api.patch(`/courses/${courseId}/restore`);
  return res.data;
}

export async function bulkCourseOperation(
  courseIds: string[],
  operation: string,
  payload?: Record<string, unknown>
) {
  const res = await api.post('/courses/bulk', { courseIds, operation, payload });
  return res.data;
}
