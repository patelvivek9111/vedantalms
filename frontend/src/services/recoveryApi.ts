import api from './api';

export interface RecoverableFile {
  _id: string;
  originalName: string;
  category: string;
  scanStatus?: string;
  isDeleted?: boolean;
  courseId?: string;
  size?: number;
  updatedAt?: string;
}

export async function fetchRecoverableFiles(params: {
  filter?: string;
  courseId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}) {
  const res = await api.get('/ops/recovery/files', { params });
  return res.data as {
    success: boolean;
    data: { items: RecoverableFile[]; nextCursor: string | null; hasMore: boolean };
  };
}

export async function fetchFileAuditTimeline(fileAssetId: string) {
  const res = await api.get(`/ops/recovery/files/${fileAssetId}/audit`);
  return res.data;
}

export async function fetchFileVersions(fileAssetId: string) {
  const res = await api.get(`/ops/recovery/files/${fileAssetId}/versions`);
  return res.data;
}

export async function previewRestore(fileAssetId: string) {
  const res = await api.get(`/ops/recovery/files/${fileAssetId}/restore-preview`);
  return res.data as {
    success: boolean;
    data: {
      eligibility: { eligible: boolean; reason: string };
      conflicts: unknown[];
      wouldRestoreBlob: boolean;
      dryRun: boolean;
    };
  };
}

export async function restoreFile(fileAssetId: string) {
  const res = await api.post(`/ops/recovery/files/${fileAssetId}/restore`);
  return res.data;
}

export async function restoreFileVersion(fileAssetId: string, versionId: string) {
  const res = await api.post(`/ops/recovery/files/${fileAssetId}/restore-version`, { versionId });
  return res.data;
}

export async function quarantineFile(fileAssetId: string, reason?: string) {
  const res = await api.post(`/ops/recovery/files/${fileAssetId}/quarantine`, { reason });
  return res.data;
}

export async function releaseQuarantine(fileAssetId: string) {
  const res = await api.post(`/ops/recovery/files/${fileAssetId}/release`);
  return res.data;
}

export async function postBulkRecovery(body: {
  action: string;
  fileAssetIds: string[];
  reason?: string;
  jobType?: string;
}) {
  const res = await api.post('/ops/recovery/bulk', body);
  return res.data;
}
