import { APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher } from './live-auth';

const threadIds: string[] = [];
const assignmentIds: string[] = [];
const courseIds: string[] = [];
const moduleIds: string[] = [];

export function trackThread(id: string) {
  if (id) threadIds.push(id);
}

export function trackAssignment(id: string) {
  if (id) assignmentIds.push(id);
}

export function trackCourse(id: string) {
  if (id) courseIds.push(id);
}

export function trackModule(id: string) {
  if (id) moduleIds.push(id);
}

/** Best-effort cleanup for serial live specs using unique temp data. */
export async function cleanupTracked(request: APIRequestContext) {
  const token = await getAuthToken(request, teacher).catch(() => null);
  if (!token) return;
  const headers = { Authorization: `Bearer ${token}` };

  for (const id of assignmentIds.splice(0)) {
    await request.delete(`${apiURL}/api/assignments/${id}`, { headers }).catch(() => {});
  }
  for (const id of threadIds.splice(0)) {
    await request.delete(`${apiURL}/api/threads/${id}`, { headers }).catch(() => {});
  }
  for (const id of moduleIds.splice(0)) {
    await request.delete(`${apiURL}/api/modules/${id}`, { headers }).catch(() => {});
  }
  for (const id of courseIds.splice(0)) {
    await request.delete(`${apiURL}/api/courses/${id}`, { headers }).catch(() => {});
  }
}
