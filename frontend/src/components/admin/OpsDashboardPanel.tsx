import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ErrorBanner, LoadingInline } from '../../design-system';
import { dismissJob, fetchOpsDashboard, retryJob } from '../../services/opsApi';

interface JobRow {
  _id: string;
  type: string;
  status: string;
  createdAt: string;
  error?: string;
}

interface WorkerStatus {
  mode: string;
  running: boolean;
  heartbeatAt?: string | null;
}

interface FileMetrics {
  integrity?: { orphanCandidateCount?: number; integrityFailureSignals?: number };
  security?: { unsafeFileCount?: number; failedUploadsLast7d?: number };
}

const formatJobType = (type: string) => type.replace(/\./g, ' · ');

const OpsDashboardPanel: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');
  const [activeJobs, setActiveJobs] = useState<JobRow[]>([]);
  const [failedJobs, setFailedJobs] = useState<JobRow[]>([]);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [fileMetrics, setFileMetrics] = useState<FileMetrics | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setInitialLoading(true);
    setError('');
    try {
      const res = await fetchOpsDashboard();
      if (res.success) {
        setActiveJobs(res.data.activeJobs || []);
        setFailedJobs(res.data.failedJobs || []);
        setWorker(res.data.worker || null);
        setFileMetrics(res.data.fileMetrics || null);
      }
    } catch {
      setError('Could not load operations dashboard.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleRetry = async (jobId: string) => {
    setActionId(jobId);
    try {
      await retryJob(jobId);
      await load(true);
    } catch {
      setError('Retry failed. Check that Redis is reachable and try again.');
    } finally {
      setActionId('');
    }
  };

  const handleDismiss = async (jobId: string) => {
    setActionId(jobId);
    try {
      await dismissJob(jobId);
      await load(true);
    } catch {
      setError('Could not dismiss job.');
    } finally {
      setActionId('');
    }
  };

  if (initialLoading) return <LoadingInline label="Loading operations…" />;
  if (error && !activeJobs.length && !failedJobs.length) {
    return <ErrorBanner message={error} onRetry={() => void load(false)} />;
  }

  const jobs = [...activeJobs, ...failedJobs];
  const workerOk = worker?.running !== false;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Operations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Background jobs and file health. Jobs run automatically with the API server.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          workerOk
            ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
        }`}
      >
        <span className="font-medium">Job worker:</span>{' '}
        {workerOk ? 'Running' : 'Not running'}
        {worker?.mode ? ` (${worker.mode})` : ''}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Orphan files" value={fileMetrics?.integrity?.orphanCandidateCount} />
        <Metric label="Integrity issues" value={fileMetrics?.integrity?.integrityFailureSignals} />
        <Metric label="Unsafe files" value={fileMetrics?.security?.unsafeFileCount} />
        <Metric label="Failed uploads (7d)" value={fileMetrics?.security?.failedUploadsLast7d} />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-800">
          Background jobs ({jobs.length})
        </div>
        {jobs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">No active or failed jobs.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.map((j) => (
              <li key={j._id} className="px-4 py-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs">{formatJobType(j.type)}</span>
                  <span className="capitalize text-gray-600 dark:text-gray-400">{j.status}</span>
                </div>
                {j.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 break-words">{j.error}</p>
                )}
                {(j.status === 'failed' || j.status === 'pending') && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actionId === j._id}
                      onClick={() => void handleRetry(j._id)}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      disabled={actionId === j._id}
                      onClick={() => void handleDismiss(j._id)}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{value ?? 0}</p>
    </div>
  );
}

export default OpsDashboardPanel;
