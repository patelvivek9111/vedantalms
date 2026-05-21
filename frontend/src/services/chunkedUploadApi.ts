import api from './api';
import { mapUploadResponse, type NormalizedFile } from '../utils/fileTypes';

export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const CHUNK_TIMEOUT_MS = 120_000;
const MAX_CHUNK_RETRIES = 5;

export interface ChunkedUploadOptions {
  category?: string;
  courseId?: string;
  assignmentId?: string;
  chunkSize?: number;
  chunkConcurrency?: number;
  uploadId?: string;
  receivedChunks?: number[];
  onProgress?: (pct: number, meta?: { bytesPerSecond?: number }) => void;
  onCheckpoint?: (data: {
    uploadId: string;
    totalChunks: number;
    receivedChunks: number[];
  }) => void;
  signal?: AbortSignal;
}

export interface ChunkInitResponse {
  uploadId: string;
  chunkSize: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withBackoff<T>(fn: () => Promise<T>, attempt: number, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { code: 'ERR_CANCELED' });
  try {
    return await fn();
  } catch (err) {
    if (attempt >= MAX_CHUNK_RETRIES || signal?.aborted) throw err;
    const delay = Math.min(30_000, 1000 * 2 ** attempt);
    await sleep(delay);
    return withBackoff(fn, attempt + 1, signal);
  }
}

export async function initChunkSession(
  file: File,
  options: ChunkedUploadOptions
): Promise<ChunkInitResponse & { totalChunks: number }> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const res = await api.post('/upload/chunk/init', {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    category: options.category,
    courseId: options.courseId,
    assignmentId: options.assignmentId,
  });
  const data = res.data as { uploadId: string; chunkSize?: number; success?: boolean };
  if (!data?.uploadId) throw new Error('Chunk init failed');
  return {
    uploadId: data.uploadId,
    chunkSize: data.chunkSize ?? chunkSize,
    totalChunks,
  };
}

export async function fetchChunkStatus(uploadId: string) {
  const res = await api.get(`/upload/chunk/${uploadId}/status`);
  return res.data as {
    success: boolean;
    received: number[];
    totalChunks: number;
    complete: boolean;
  };
}

export async function uploadChunk(
  uploadId: string,
  chunkIndex: number,
  blob: Blob,
  signal?: AbortSignal
) {
  await api.post(`/upload/chunk/${uploadId}/${chunkIndex}`, blob, {
    headers: { 'Content-Type': 'application/octet-stream' },
    signal,
    timeout: CHUNK_TIMEOUT_MS,
  });
}

export async function completeChunkSession(uploadId: string): Promise<NormalizedFile[]> {
  const res = await api.post(`/upload/chunk/${uploadId}/complete`);
  const list = Array.isArray(res.data?.files) ? res.data.files : [];
  return list.map((f: Record<string, unknown>) => mapUploadResponse(f));
}

/** Probe whether chunk API is reachable (authenticated). */
export async function isChunkUploadAvailable(): Promise<boolean> {
  try {
    await api.get('/upload/chunk/__probe__/status').catch(() => null);
    return true;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 401) return status === 401;
    return false;
  }
}

/**
 * Upload a single file via chunked API with parallel chunk uploads and resume support.
 */
export async function uploadFileChunked(
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<NormalizedFile> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkConcurrency = options.chunkConcurrency ?? 3;
  let uploadId = options.uploadId;
  let totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const receivedSet = new Set(options.receivedChunks || []);

  if (!uploadId) {
    const init = await initChunkSession(file, options);
    uploadId = init.uploadId;
    totalChunks = init.totalChunks;
    options.onCheckpoint?.({ uploadId, totalChunks, receivedChunks: [...receivedSet] });
  } else {
    try {
      const status = await fetchChunkStatus(uploadId);
      if (status?.received) status.received.forEach((i) => receivedSet.add(i));
      totalChunks = status.totalChunks || totalChunks;
    } catch {
      const init = await initChunkSession(file, options);
      uploadId = init.uploadId;
      totalChunks = init.totalChunks;
      receivedSet.clear();
    }
  }

  const pending: number[] = [];
  for (let i = 0; i < totalChunks; i += 1) {
    if (!receivedSet.has(i)) pending.push(i);
  }

  const startedAt = Date.now();
  let uploadedBytes = receivedSet.size * chunkSize;

  const uploadOneChunk = async (index: number) => {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    await withBackoff(
      () => uploadChunk(uploadId!, index, blob, options.signal),
      0,
      options.signal
    );
    receivedSet.add(index);
    uploadedBytes = Math.min(file.size, uploadedBytes + (end - start));
    const pct = Math.round((uploadedBytes / file.size) * 100);
    const elapsed = (Date.now() - startedAt) / 1000;
    options.onProgress?.(pct, {
      bytesPerSecond: elapsed > 0 ? uploadedBytes / elapsed : undefined,
    });
    options.onCheckpoint?.({
      uploadId: uploadId!,
      totalChunks,
      receivedChunks: [...receivedSet].sort((a, b) => a - b),
    });
  };

  let cursor = 0;
  const workers = Array.from({ length: Math.min(chunkConcurrency, pending.length) }, async () => {
    while (cursor < pending.length) {
      if (options.signal?.aborted) throw Object.assign(new Error('Cancelled'), { code: 'ERR_CANCELED' });
      const idx = pending[cursor];
      cursor += 1;
      await uploadOneChunk(idx);
    }
  });
  await Promise.all(workers);

  const results = await completeChunkSession(uploadId);
  if (!results[0]) throw new Error('Chunk complete returned no file');
  return results[0];
}

export function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
