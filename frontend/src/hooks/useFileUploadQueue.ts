import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadFiles } from '../services/fileUploadApi';
import {
  uploadFileChunked,
  DEFAULT_CHUNK_SIZE,
  fileFingerprint,
} from '../services/chunkedUploadApi';
import { uploadRecoveryManager, type UploadCheckpoint } from '../lib/uploadRecoveryManager';
import { dedupeFileNames, type NormalizedFile } from '../utils/fileTypes';

export interface QueueItem extends NormalizedFile {
  id: string;
  file?: File;
  retries: number;
  startedAt?: number;
  bytesPerSecond?: number;
  uploadMode?: 'chunked' | 'multipart';
}

interface UseFileUploadQueueOptions {
  concurrency?: number;
  chunkConcurrency?: number;
  maxRetries?: number;
  useChunked?: boolean;
  category?: string;
  courseId?: string;
  assignmentId?: string;
  persistKey?: string;
  onComplete?: (items: NormalizedFile[]) => void;
}

interface PersistedQueueSnapshot {
  items: Array<{ id: string; name: string; size?: number; mimeType?: string; status: string; error?: string }>;
  savedAt: string;
}

function buildPersistKey(options: UseFileUploadQueueOptions) {
  return (
    options.persistKey ||
    `upload-queue:${options.category || 'tmp'}:${options.courseId || ''}:${options.assignmentId || ''}`
  );
}

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `fq-${idSeq}`;
}

const STALL_MS = 90_000;

function shouldFallbackToMultipart(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404 || status === 501 || status === 405) return true;
  const msg = String((err as Error)?.message || '');
  return msg.includes('Chunk init failed') || msg.includes('Network Error');
}

export function useFileUploadQueue(options: UseFileUploadQueueOptions = {}) {
  const concurrency = options.concurrency ?? 2;
  const chunkConcurrency = options.chunkConcurrency ?? 3;
  const maxRetries = options.maxRetries ?? 2;
  const useChunked = options.useChunked !== false;
  const persistKey = buildPersistKey(options);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interrupted, setInterrupted] = useState<PersistedQueueSnapshot['items']>([]);
  const [recoveryBanner, setRecoveryBanner] = useState<string | null>(null);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
  const activeRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const stallTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const persistSnapshot = useCallback(() => {
    try {
      const pending = queueRef.current.filter(
        (i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'error'
      );
      if (!pending.length) {
        sessionStorage.removeItem(persistKey);
        return;
      }
      const snap: PersistedQueueSnapshot = {
        savedAt: new Date().toISOString(),
        items: pending.map((i) => ({
          id: i.id,
          name: i.name,
          size: i.size,
          mimeType: i.mimeType,
          status: i.status,
          error: i.error,
        })),
      };
      sessionStorage.setItem(persistKey, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  }, [persistKey]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(persistKey);
      if (raw) {
        const snap = JSON.parse(raw) as PersistedQueueSnapshot;
        if (snap?.items?.length) setInterrupted(snap.items);
      }
      const checkpoints = uploadRecoveryManager.listCheckpoints(persistKey);
      if (checkpoints.length) {
        setRecoveryBanner(
          `${checkpoints.length} upload(s) can be resumed — re-select the same file(s) to continue.`
        );
      }
    } catch {
      /* ignore */
    }
  }, [persistKey]);

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    queueRef.current = queueRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it));
  }, []);

  const clearStallTimer = (id: string) => {
    const t = stallTimers.current.get(id);
    if (t) clearTimeout(t);
    stallTimers.current.delete(id);
  };

  const armStallTimer = useCallback(
    (id: string) => {
      clearStallTimer(id);
      stallTimers.current.set(
        id,
        setTimeout(() => {
          uploadRecoveryManager.markStalled(persistKey, id);
          updateItem(id, { error: 'Upload stalled — retry when connection improves' });
        }, STALL_MS)
      );
    },
    [persistKey, updateItem]
  );

  const processOne = useCallback(
    async (item: QueueItem) => {
      if (!item.file) return;
      const controller = new AbortController();
      abortRefs.current.set(item.id, controller);
      const startedAt = Date.now();
      updateItem(item.id, { status: 'uploading', progress: 0, error: undefined, startedAt });
      armStallTimer(item.id);

      const existingCp = uploadRecoveryManager.matchFileToCheckpoint(item.file, persistKey);
      const chunkOpts = existingCp
        ? { ...uploadRecoveryManager.toChunkOptions(existingCp), ...options }
        : options;

      const saveProgress = (pct: number, bytesPerSecond?: number) => {
        clearStallTimer(item.id);
        armStallTimer(item.id);
        updateItem(item.id, { progress: pct, bytesPerSecond });
      };

      try {
        let uploaded: NormalizedFile;
        if (useChunked && item.file.size >= DEFAULT_CHUNK_SIZE / 10) {
          try {
            updateItem(item.id, { uploadMode: 'chunked' });
            uploaded = await uploadFileChunked(item.file, {
              category: options.category,
              courseId: options.courseId,
              assignmentId: options.assignmentId,
              chunkConcurrency,
              uploadId: chunkOpts.uploadId,
              receivedChunks: chunkOpts.receivedChunks,
              signal: controller.signal,
              onProgress: (pct, meta) => saveProgress(pct, meta?.bytesPerSecond),
              onCheckpoint: ({ uploadId, totalChunks, receivedChunks }) => {
                const cp: UploadCheckpoint = {
                  queueItemId: item.id,
                  uploadId,
                  fileName: item.file!.name,
                  fileSize: item.file!.size,
                  mimeType: item.file!.type,
                  fingerprint: fileFingerprint(item.file!),
                  totalChunks,
                  receivedChunks,
                  category: options.category,
                  courseId: options.courseId,
                  assignmentId: options.assignmentId,
                  updatedAt: new Date().toISOString(),
                };
                uploadRecoveryManager.saveCheckpoint(persistKey, cp);
              },
            });
            uploadRecoveryManager.clearCheckpoint(persistKey, item.id);
          } catch (chunkErr) {
            if (!shouldFallbackToMultipart(chunkErr) || controller.signal.aborted) throw chunkErr;
            updateItem(item.id, { uploadMode: 'multipart' });
            const [fallback] = await uploadFiles([item.file], {
              category: options.category,
              courseId: options.courseId,
              assignmentId: options.assignmentId,
              signal: controller.signal,
              onProgress: (pct) => saveProgress(pct),
            });
            uploaded = fallback;
          }
        } else {
          updateItem(item.id, { uploadMode: 'multipart' });
          const [single] = await uploadFiles([item.file], {
            category: options.category,
            courseId: options.courseId,
            assignmentId: options.assignmentId,
            signal: controller.signal,
            onProgress: (pct) => saveProgress(pct),
          });
          uploaded = single;
        }

        clearStallTimer(item.id);
        uploadRecoveryManager.clearCheckpoint(persistKey, item.id);
        updateItem(item.id, { ...uploaded, status: 'done', progress: 100, file: undefined });
      } catch (err: unknown) {
        clearStallTimer(item.id);
        const aborted = (err as { code?: string })?.code === 'ERR_CANCELED';
        if (aborted) {
          updateItem(item.id, { status: 'cancelled', error: 'Cancelled' });
        } else if (item.retries < maxRetries) {
          updateItem(item.id, { retries: item.retries + 1, status: 'queued', error: undefined });
        } else {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          updateItem(item.id, { status: 'error', error: msg || 'Upload failed (retries exhausted)' });
        }
      } finally {
        abortRefs.current.delete(item.id);
      }
    },
    [
      armStallTimer,
      chunkConcurrency,
      maxRetries,
      options,
      persistKey,
      updateItem,
      useChunked,
    ]
  );

  const pump = useCallback(async () => {
    if (paused) return;
    setIsUploading(true);
    while (queueRef.current.some((i) => i.status === 'queued')) {
      if (paused) break;
      while (activeRef.current < concurrency) {
        const next = queueRef.current.find((i) => i.status === 'queued');
        if (!next) break;
        activeRef.current += 1;
        updateItem(next.id, { status: 'uploading' });
        processOne(next).finally(() => {
          activeRef.current -= 1;
          void pump();
        });
      }
      await new Promise((r) => setTimeout(r, 100));
      if (activeRef.current === 0 && !queueRef.current.some((i) => i.status === 'queued')) break;
    }
    setIsUploading(false);
    const done = queueRef.current.filter((i) => i.status === 'done');
    options.onComplete?.(done);
  }, [concurrency, options, paused, processOne, updateItem]);

  const enqueue = useCallback(
    (files: File[]) => {
      const deduped = dedupeFileNames(files);
      const seen = new Set(items.map((i) => i.name));
      const toAdd: QueueItem[] = [];
      for (const file of deduped) {
        if (seen.has(file.name)) continue;
        seen.add(file.name);
        const id = nextId();
        const resumeCp = uploadRecoveryManager.matchFileToCheckpoint(file, persistKey);
        if (resumeCp && resumeCp.queueItemId !== id) {
          uploadRecoveryManager.saveCheckpoint(persistKey, { ...resumeCp, queueItemId: id });
        }
        toAdd.push({
          id,
          name: file.name,
          url: '',
          size: file.size,
          mimeType: file.type,
          status: 'queued',
          progress: resumeCp ? Math.round((resumeCp.receivedChunks.length / resumeCp.totalChunks) * 100) : 0,
          retries: 0,
          file,
        });
      }
      queueRef.current = [...queueRef.current, ...toAdd];
      setItems((prev) => [...prev, ...toAdd]);
      if (toAdd.some((t) => uploadRecoveryManager.matchFileToCheckpoint(t.file!, persistKey))) {
        setRecoveryBanner('Resuming interrupted upload(s)…');
      }
      void pump();
    },
    [items, persistKey, pump]
  );

  const cancel = useCallback(
    (id: string) => {
      abortRefs.current.get(id)?.abort();
      clearStallTimer(id);
      uploadRecoveryManager.clearCheckpoint(persistKey, id);
      updateItem(id, { status: 'cancelled' });
    },
    [persistKey, updateItem]
  );

  const retry = useCallback(
    (id: string) => {
      const item = queueRef.current.find((i) => i.id === id);
      if (!item || !item.file) return;
      updateItem(id, { status: 'queued', error: undefined, retries: 0 });
      void pump();
    },
    [pump, updateItem]
  );

  const remove = useCallback(
    (id: string) => {
      cancel(id);
      queueRef.current = queueRef.current.filter((i) => i.id !== id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [cancel]
  );

  const clearCompleted = useCallback(() => {
    queueRef.current = queueRef.current.filter((i) => i.status !== 'done' && i.status !== 'cancelled');
    setItems((prev) => prev.filter((i) => i.status !== 'done' && i.status !== 'cancelled'));
  }, []);

  const completedFiles = items.filter((i) => i.status === 'done');

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setPaused(false);
    setRecoveryBanner(null);
    void pump();
  }, [pump]);

  const dismissInterrupted = useCallback(() => {
    setInterrupted([]);
    setRecoveryBanner(null);
    sessionStorage.removeItem(persistKey);
  }, [persistKey]);

  useEffect(() => {
    persistSnapshot();
  }, [items, persistSnapshot]);

  useEffect(() => {
    const onOnline = () => {
      setPaused(false);
      setRecoveryBanner('Connection restored — continuing uploads…');
      const retryable = queueRef.current.filter(
        (i) => (i.status === 'error' || i.status === 'uploading') && i.file
      );
      retryable.forEach((i) => {
        updateItem(i.id, { status: 'queued', error: undefined, retries: 0 });
      });
      if (retryable.length) void pump();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pump, updateItem]);

  return {
    items,
    completedFiles,
    isUploading,
    paused,
    interrupted,
    recoveryBanner,
    enqueue,
    cancel,
    retry,
    remove,
    clearCompleted,
    pause,
    resume,
    dismissInterrupted,
  };
}
