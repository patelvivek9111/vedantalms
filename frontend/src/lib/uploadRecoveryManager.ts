/**
 * U51F/U52F — client-side upload checkpoint persistence and recovery.
 */
import { fileFingerprint, type ChunkedUploadOptions } from '../services/chunkedUploadApi';

const STORAGE_PREFIX = 'vedanta:upload-checkpoint:';
const GLOBAL_INDEX_KEY = 'vedanta:upload-checkpoints-index';

export interface UploadCheckpoint {
  queueItemId: string;
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fingerprint: string;
  totalChunks: number;
  receivedChunks: number[];
  category?: string;
  courseId?: string;
  assignmentId?: string;
  updatedAt: string;
  stalledAt?: string;
}

function indexKey(persistKey: string) {
  return `${GLOBAL_INDEX_KEY}:${persistKey}`;
}

export const uploadRecoveryManager = {
  saveCheckpoint(persistKey: string, cp: UploadCheckpoint) {
    try {
      const key = `${STORAGE_PREFIX}${persistKey}:${cp.queueItemId}`;
      localStorage.setItem(key, JSON.stringify(cp));
      const idx = uploadRecoveryManager.listCheckpointIds(persistKey);
      if (!idx.includes(cp.queueItemId)) {
        idx.push(cp.queueItemId);
        localStorage.setItem(indexKey(persistKey), JSON.stringify(idx));
      }
    } catch {
      /* quota */
    }
  },

  loadCheckpoint(persistKey: string, queueItemId: string): UploadCheckpoint | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${persistKey}:${queueItemId}`);
      return raw ? (JSON.parse(raw) as UploadCheckpoint) : null;
    } catch {
      return null;
    }
  },

  listCheckpointIds(persistKey: string): string[] {
    try {
      const raw = localStorage.getItem(indexKey(persistKey));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  },

  listCheckpoints(persistKey: string): UploadCheckpoint[] {
    return uploadRecoveryManager
      .listCheckpointIds(persistKey)
      .map((id) => uploadRecoveryManager.loadCheckpoint(persistKey, id))
      .filter((c): c is UploadCheckpoint => Boolean(c));
  },

  clearCheckpoint(persistKey: string, queueItemId: string) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${persistKey}:${queueItemId}`);
      const idx = uploadRecoveryManager.listCheckpointIds(persistKey).filter((id) => id !== queueItemId);
      localStorage.setItem(indexKey(persistKey), JSON.stringify(idx));
    } catch {
      /* ignore */
    }
  },

  matchFileToCheckpoint(file: File, persistKey: string): UploadCheckpoint | null {
    const fp = fileFingerprint(file);
    return uploadRecoveryManager.listCheckpoints(persistKey).find((c) => c.fingerprint === fp) || null;
  },

  markStalled(persistKey: string, queueItemId: string) {
    const cp = uploadRecoveryManager.loadCheckpoint(persistKey, queueItemId);
    if (!cp) return;
    cp.stalledAt = new Date().toISOString();
    uploadRecoveryManager.saveCheckpoint(persistKey, cp);
  },

  toChunkOptions(cp: UploadCheckpoint): Pick<
    ChunkedUploadOptions,
    'uploadId' | 'receivedChunks' | 'category' | 'courseId' | 'assignmentId'
  > {
    return {
      uploadId: cp.uploadId,
      receivedChunks: cp.receivedChunks,
      category: cp.category,
      courseId: cp.courseId,
      assignmentId: cp.assignmentId,
    };
  },
};

export default uploadRecoveryManager;
