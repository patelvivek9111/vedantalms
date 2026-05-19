export type LifecycleStatus = 'DRAFT' | 'POSTED' | 'FINALIZED' | 'AMENDED';

export interface AsyncJobStatus {
  id: string;
  type: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress?: { completed: number; total: number };
  result?: unknown;
  error?: string;
  hasDownload?: boolean;
  downloadExpiresAt?: string;
}

export interface AsyncJobEnqueueResult {
  jobId: string;
  status: string;
  async: boolean;
  downloadUrl?: string | null;
}
