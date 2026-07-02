import React, { useEffect, useState } from 'react';
import { ErrorBanner, LoadingInline } from '../../design-system';
import { fetchOpsDashboard } from '../../services/opsApi';

interface JobRow {
  _id: string;
  type: string;
  status: string;
  createdAt: string;
  error?: string;
}

const OpsDashboardPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeJobs, setActiveJobs] = useState<JobRow[]>([]);
  const [failedJobs, setFailedJobs] = useState<JobRow[]>([]);
  const [exportQueue, setExportQueue] = useState<JobRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchOpsDashboard();
      if (res.success) {
        setActiveJobs(res.data.activeJobs || []);
        setFailedJobs(res.data.failedJobs || []);
        setExportQueue(res.data.exportQueue || []);
      }
    } catch {
      setError('Could not load operations dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingInline label="Loading operations…" />;
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;

  const JobTable = ({ title, jobs }: { title: string; jobs: JobRow[] }) => (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-800">
        {title} ({jobs.length})
      </div>
      {jobs.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">None</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {jobs.slice(0, 20).map((j) => (
            <li key={j._id} className="px-4 py-2 text-sm flex justify-between gap-2">
              <span className="font-mono text-xs">{j.type}</span>
              <span className="capitalize text-gray-600 dark:text-gray-400">{j.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Operations</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Background jobs, exports, and recent grading operations.
        </p>
      </div>
      <JobTable title="Gradebook exports in queue" jobs={exportQueue} />
      <JobTable title="Active jobs" jobs={activeJobs} />
      <JobTable title="Failed jobs (recent)" jobs={failedJobs} />
      <p className="text-xs text-gray-500">
        Institution backup/restore status is managed via server scripts — see docs/operations.md.
      </p>
    </div>
  );
};

export default OpsDashboardPanel;
