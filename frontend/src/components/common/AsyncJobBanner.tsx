import React from 'react';
import { LoadingInline } from '../../design-system';
import type { AsyncJobStatus } from '../../types/grading';

interface AsyncJobBannerProps {
  job: AsyncJobStatus | null;
  polling: boolean;
  error?: string;
  label?: string;
  onDismiss?: () => void;
  onDownload?: () => void;
}

const AsyncJobBanner: React.FC<AsyncJobBannerProps> = ({
  job,
  polling,
  error,
  label = 'Background job',
  onDismiss,
  onDownload,
}) => {
  if (!job && !error && !polling) return null;

  const progress =
    job?.progress && job.progress.total > 0
      ? Math.round((job.progress.completed / job.progress.total) * 100)
      : null;

  return (
    <div
      className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-900/20"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-blue-900 dark:text-blue-100">{label}</span>
          {job && (
            <span className="ml-2 text-blue-700 dark:text-blue-300 capitalize">{job.status}</span>
          )}
          {progress != null && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">{progress}%</span>
          )}
          {polling && <span className="ml-2 inline-block"><LoadingInline label="" /></span>}
          {error && <p className="mt-1 text-red-600 dark:text-red-400">{error}</p>}
          {job?.status === 'failed' && job.error && (
            <p className="mt-1 text-red-600 dark:text-red-400">{job.error}</p>
          )}
        </div>
        <div className="flex gap-2">
          {job?.status === 'completed' && onDownload && (
            <button type="button" className="text-sm font-medium text-blue-700 underline dark:text-blue-300" onClick={onDownload}>
              Download
            </button>
          )}
          {onDismiss && (
            <button type="button" className="text-sm text-gray-600 dark:text-gray-400" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AsyncJobBanner;
