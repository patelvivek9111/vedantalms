import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJobStatus, openJobDownload } from '../services/jobsApi';
import type { AsyncJobStatus } from '../types/grading';

const POLL_MS = 1500;

export function useAsyncJob() {
  const [job, setJob] = useState<AsyncJobStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPolling(false);
  }, []);

  const pollJob = useCallback(
    async (jobId: string, onComplete?: (j: AsyncJobStatus) => void) => {
      stopPolling();
      setPolling(true);
      setError('');

      const tick = async () => {
        try {
          const res = await fetchJobStatus(jobId);
          if (!res.success) return;
          const data = res.data;
          setJob(data);
          if (data.status === 'completed' || data.status === 'failed') {
            stopPolling();
            onComplete?.(data);
          }
        } catch {
          setError('Could not check job status.');
          stopPolling();
        }
      };

      await tick();
      timerRef.current = window.setInterval(() => void tick(), POLL_MS);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startFromEnqueue = useCallback(
    async (
      jobId: string,
      options?: { downloadUrl?: string | null; onComplete?: (j: AsyncJobStatus) => void }
    ) => {
      if (options?.downloadUrl) {
        openJobDownload(options.downloadUrl);
        return;
      }
      await pollJob(jobId, (completed) => {
        options?.onComplete?.(completed);
      });
    },
    [pollJob]
  );

  const reset = useCallback(() => {
    stopPolling();
    setJob(null);
    setError('');
  }, [stopPolling]);

  return { job, polling, error, pollJob, startFromEnqueue, reset, stopPolling };
}
