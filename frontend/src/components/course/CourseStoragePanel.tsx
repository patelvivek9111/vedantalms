import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { LoadingInline } from '../../design-system';
import { useAsyncJob } from '../../hooks/useAsyncJob';
import { openJobDownload } from '../../services/jobsApi';

const formatBytes = (n: number) => {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

interface CourseStoragePanelProps {
  courseId: string;
}

const CourseStoragePanel: React.FC<CourseStoragePanelProps> = ({ courseId }) => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { job, polling, error: jobError, pollJob, reset } = useAsyncJob();

  useEffect(() => {
    setLoading(true);
    api
      .get(`/courses/${courseId}/storage`)
      .then((res) => {
        if (res.data.success) setData(res.data.data);
        else setError('Could not load storage analytics');
      })
      .catch(() => setError('Could not load storage analytics'))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (job?.status === 'completed') {
      const url =
        (job.result as { downloadUrl?: string })?.downloadUrl ||
        (job.result as { downloadToken?: string; zipId?: string })?.zipId
          ? `/api/files/zip/${(job.result as { zipId: string }).zipId}/download?token=${encodeURIComponent((job.result as { downloadToken: string }).downloadToken)}`
          : null;
      if (url) {
        setDownloadUrl(url);
        setZipMessage('ZIP ready. Click download below.');
      } else {
        setZipMessage('ZIP job completed.');
      }
      setZipBusy(false);
    }
    if (job?.status === 'failed') {
      setZipMessage(job.error || 'ZIP generation failed.');
      setZipBusy(false);
    }
  }, [job]);

  const requestCourseZip = async () => {
    setZipBusy(true);
    setZipMessage('');
    setDownloadUrl(null);
    reset();
    try {
      const res = await api.post(`/courses/${courseId}/storage/zip`, {
        type: 'course_resources',
      });
      if (res.data.success && res.data.data?.job?._id) {
        setZipMessage('Building course ZIP…');
        await pollJob(res.data.data.job._id);
      } else if (res.data.success) {
        setZipMessage('ZIP job queued.');
      } else {
        setZipMessage('Could not queue ZIP download.');
        setZipBusy(false);
      }
    } catch {
      setZipMessage('Could not queue ZIP download.');
      setZipBusy(false);
    }
  };

  if (loading) return <LoadingInline label="Loading storage analytics…" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const quota = (data.quota || {}) as { percentUsed?: number; courseUsed?: number; courseLimit?: number };
  const byCategory = (data.byCategory || []) as Array<{ category: string; bytes: number; count: number }>;
  const largest = (data.largestFiles || []) as Array<{ originalName: string; size: number; category: string }>;

  const totalBytesFromCategories = byCategory.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0);
  const totalFilesFromCategories = byCategory.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const totalBytes = Number(data.totalBytes) || totalBytesFromCategories;
  const totalFiles = Number(data.totalFiles) || totalFilesFromCategories;
  const courseLimit = Number(quota.courseLimit) || 0;
  const courseUsed = Number(quota.courseUsed) || totalBytes;
  const percentUsed =
    quota.percentUsed ??
    (courseLimit > 0 ? Math.min(100, Math.round((courseUsed / courseLimit) * 100)) : 0);

  const statCards = [
    {
      label: 'Total used',
      value: formatBytes(totalBytes),
      detail: `${totalFiles} files`,
    },
    {
      label: 'Quota used',
      value: `${percentUsed}%`,
      detail: formatBytes(courseUsed),
    },
    {
      label: 'Course limit',
      value: formatBytes(courseLimit),
      detail: 'Maximum allowed',
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Course storage</h3>
        <button
          type="button"
          onClick={requestCourseZip}
          disabled={zipBusy || polling}
          className="min-h-[40px] rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {zipBusy || polling ? 'Building ZIP…' : 'Download course ZIP'}
        </button>
      </div>
      {(zipMessage || jobError) && (
        <p className="text-xs text-gray-600 dark:text-gray-400" role="status">
          {jobError || zipMessage}
          {job?.progress != null && polling ? ` (${job.progress}%)` : null}
        </p>
      )}
      {downloadUrl && (
        <button
          type="button"
          className="min-h-[40px] rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          onClick={() => openJobDownload(downloadUrl)}
        >
          Download ZIP file
        </button>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex min-h-[5.5rem] flex-col justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {card.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{card.detail}</p>
          </div>
        ))}
      </div>
      {byCategory.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">By category</h4>
          <div className="space-y-2 md:hidden">
            {byCategory.map((row) => (
              <div
                key={row.category}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">{row.category}</div>
                <div className="mt-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>{row.count} files</span>
                  <span>{formatBytes(row.bytes)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Category</th>
                  <th>Files</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((row) => (
                  <tr key={row.category} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1">{row.category}</td>
                    <td>{row.count}</td>
                    <td>{formatBytes(row.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {largest.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Largest files</h4>
          <div className="overflow-hidden rounded-lg ring-1 ring-gray-200/70 divide-y divide-gray-100 dark:ring-gray-700/60 dark:divide-gray-700/50">
            {largest.slice(0, 5).map((f, i) => (
              <div
                key={`${f.originalName}-${f.size}-${i}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {f.originalName}
                </p>
                <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="tabular-nums">{formatBytes(f.size)}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {f.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseStoragePanel;
