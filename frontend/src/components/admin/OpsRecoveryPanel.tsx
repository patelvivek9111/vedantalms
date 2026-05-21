import React, { useCallback, useEffect, useState } from 'react';
import { LoadingInline } from '../../design-system';
import {
  fetchRecoverySummary,
  postRecoveryAction,
  type RecoverySummary,
} from '../../services/opsApi';

const OpsRecoveryPanel: React.FC = () => {
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRecoverySummary();
      if (res.success) setSummary(res.data);
    } catch {
      setMessage('Failed to load recovery summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: string, dryRun = true) => {
    setActionLoading(action);
    setMessage('');
    try {
      const res = await postRecoveryAction({ action, dryRun });
      if (res.success) {
        setMessage(`${action} ${dryRun ? '(dry-run) ' : ''}completed`);
        await load();
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || `Action ${action} failed`);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <LoadingInline label="Loading recovery tools…" />;

  return (
    <div className="space-y-4 text-sm">
      <p className="text-gray-600 dark:text-gray-400">
        Operational recovery for failed uploads, stuck jobs, orphans, and integrity signals. All
        actions are audited; dry-run is default unless you apply changes.
      </p>
      {message && (
        <p className="rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 px-3 py-2">
          {message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Orphan candidates</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {summary?.orphanReport?.candidates?.length ??
              summary?.orphanReport?.summary?.candidateCount ??
              '—'}{' '}
            detected (preview)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded border text-xs"
              disabled={!!actionLoading}
              onClick={() => runAction('mark_orphans', true)}
            >
              Dry-run mark
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs"
              disabled={!!actionLoading}
              onClick={() => {
                if (window.confirm('Mark orphan candidates for cleanup? This is audited.')) {
                  void runAction('mark_orphans', false);
                }
              }}
            >
              Apply marks
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed jobs</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {summary?.failedJobs?.length ?? 0} recent failed async jobs
          </p>
          <button
            type="button"
            className="px-3 py-1.5 rounded border text-xs"
            disabled={!!actionLoading}
            onClick={() => runAction('integrity_report', true)}
          >
            Generate integrity report
          </button>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:col-span-2">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">File metrics</h4>
          <pre className="text-xs overflow-auto max-h-40 bg-gray-50 dark:bg-gray-900 p-2 rounded">
            {JSON.stringify(summary?.fileMetrics ?? summary, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default OpsRecoveryPanel;
