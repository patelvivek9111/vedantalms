import api from './api';

export async function fetchOpsDashboard() {
  const res = await api.get('/ops/dashboard');
  return res.data;
}

export async function fetchDependenciesHealth() {
  const res = await api.get('/ops/health');
  return res.data;
}

export async function fetchOpsFiles() {
  const res = await api.get('/ops/files');
  return res.data;
}

export interface RecoverySummary {
  dryRun?: boolean;
  orphanCandidates?: unknown[];
  orphanReport?: { candidateCount?: number };
  failedJobs?: unknown[];
  fileMetrics?: Record<string, unknown>;
}

export async function fetchRecoverySummary() {
  const res = await api.get('/ops/recovery', { params: { dryRun: 'true' } });
  return res.data;
}

export async function postRecoveryAction(body: {
  action: string;
  jobId?: string;
  dryRun?: boolean;
}) {
  const res = await api.post('/ops/recovery', body);
  return res.data;
}
