import api from './api';
import { API_URL } from '../config';
import type { AsyncJobEnqueueResult, AsyncJobStatus } from '../types/grading';

export async function enqueueGradebookExport(courseId: string) {
  const res = await api.post(`/grades/course/${courseId}/gradebook/export`);
  return res.data as { success: boolean; data: AsyncJobEnqueueResult };
}

export async function fetchJobStatus(jobId: string) {
  const res = await api.get(`/jobs/${jobId}`);
  return res.data as { success: boolean; data: AsyncJobStatus };
}

/** Open server export download (token in query string from enqueue response). */
export function openJobDownload(downloadPath: string) {
  const base = API_URL || '';
  const url = downloadPath.startsWith('http') ? downloadPath : `${base}${downloadPath}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
