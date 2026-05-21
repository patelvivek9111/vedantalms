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

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Course storage</h3>
        <button
          type="button"
          onClick={requestCourseZip}
          disabled={zipBusy || polling}
          className="text-xs rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
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
          className="text-xs rounded-md bg-indigo-600 text-white px-3 py-1.5"
          onClick={() => openJobDownload(downloadUrl)}
        >
          Download ZIP file
        </button>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs text-gray-500">Total used</p>
          <p className="text-lg font-semibold">{formatBytes(Number(data.totalBytes) || 0)}</p>
          <p className="text-xs text-gray-500">{Number(data.totalFiles) || 0} files</p>
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs text-gray-500">Quota used</p>
          <p className="text-lg font-semibold">{quota.percentUsed ?? 0}%</p>
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs text-gray-500">Course limit</p>
          <p className="text-lg font-semibold">{formatBytes(Number(quota.courseLimit) || 0)}</p>
        </div>
      </div>
      {byCategory.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">By category</h4>
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
      )}
      {largest.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Largest files</h4>
          <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
            {largest.slice(0, 5).map((f, i) => (
              <li key={i} className="truncate">
                {f.originalName} — {formatBytes(f.size)} ({f.category})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CourseStoragePanel;
