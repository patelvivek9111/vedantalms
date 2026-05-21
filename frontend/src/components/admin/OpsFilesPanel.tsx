import React, { useEffect, useState } from 'react';
import { ErrorBanner, LoadingInline, StatusBadge } from '../../design-system';
import { fetchOpsFiles } from '../../services/opsApi';

interface OpsFilesMetrics {
  storage?: { uploadsDirBytes?: number; academicAssets?: number };
  integrity?: Record<string, number>;
  security?: Record<string, number>;
  versioning?: Record<string, number>;
  largestCoursesByStorage?: Array<{
    courseId?: string;
    bytes?: number;
    totalSize?: number;
    fileCount?: number;
    count?: number;
  }>;
  exportBlobCoverage?: { byCategory?: Array<{ _id?: string; count?: number; size?: number }> };
  byCategory?: Array<{ _id?: string; count?: number; size?: number }>;
  blobRetention?: {
    quarantineBlobCount?: number;
    restoreEligibleAssets?: number;
    retentionDays?: number;
    quarantineDirBytes?: number;
  } | null;
  uploadPlatform?: {
    previewJobs?: { ready?: number; failed?: number; pending?: number; corrupted?: number };
    pendingQuarantineDeletes?: number;
  };
}

const formatBytes = (n?: number) => {
  if (n == null) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const OpsFilesPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<OpsFilesMetrics | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchOpsFiles();
      if (res.success) setData(res.data);
      else setError('Could not load file operations metrics.');
    } catch {
      setError('Could not load file operations metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingInline label="Loading file operations…" />;
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const storage = data.storage || {};
  const integrity = data.integrity || {};
  const security = data.security || {};
  const versioning = data.versioning || {};
  const largestCourses = data.largestCoursesByStorage || [];
  const byCategory = data.exportBlobCoverage?.byCategory || data.byCategory || [];
  const blobRetention = data.blobRetention;
  const uploadPlatform = data.uploadPlatform;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">File storage</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Uploads on disk: {formatBytes(storage.uploadsDirBytes)} · Registered assets:{' '}
          {storage.academicAssets ?? '—'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Orphan candidates" value={integrity.orphanCandidateCount} tone="warning" />
        <MetricCard label="Integrity signals" value={integrity.integrityFailureSignals} tone="danger" />
        <MetricCard label="Blob mismatch est." value={integrity.blobMismatchEstimate} />
        <MetricCard label="Unsafe files" value={security.unsafeFileCount} tone="danger" />
        <MetricCard label="Suspicious downloads (7d)" value={security.suspiciousDownloadsLast7d} tone="warning" />
        <MetricCard label="Failed uploads (7d)" value={security.failedUploadsLast7d} />
        <MetricCard label="Versioned files" value={versioning.versionedFileCount} />
      </div>

      {blobRetention && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Quarantined blobs" value={blobRetention.quarantineBlobCount} tone="warning" />
          <MetricCard label="Restore eligible" value={blobRetention.restoreEligibleAssets} />
          <MetricCard label="Retention (days)" value={blobRetention.retentionDays} />
        </div>
      )}

      {uploadPlatform && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Preview ready" value={uploadPlatform.previewJobs?.ready} />
          <MetricCard label="Preview failed" value={uploadPlatform.previewJobs?.failed} tone="warning" />
          <MetricCard label="Preview corrupted" value={uploadPlatform.previewJobs?.corrupted} tone="danger" />
          <MetricCard
            label="Pending quarantine"
            value={uploadPlatform.pendingQuarantineDeletes}
            tone="warning"
          />
        </div>
      )}

      {largestCourses.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Largest courses by storage</h4>
          <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
            {largestCourses.slice(0, 5).map((c, i) => (
              <li key={c.courseId || i}>
                Course {String(c.courseId).slice(-6)} — {formatBytes(c.bytes ?? c.totalSize)} ({c.fileCount ?? c.count} files)
              </li>
            ))}
          </ul>
        </div>
      )}

      {byCategory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Storage by category</h4>
          <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
            {byCategory.map((row) => (
              <li key={row._id}>
                {row._id}: {row.count} files ({formatBytes(row.size)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Run `npm run verify:upload-platform:final` before production release. Also: `verify:file-platform`,
        `verify:file-integrity`, `verify:blob-reconciliation`.
      </p>
    </div>
  );
};

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value?: number;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="mt-1">
        <StatusBadge tone={tone === 'neutral' ? 'info' : tone}>{value ?? 0}</StatusBadge>
      </div>
    </div>
  );
}

export default OpsFilesPanel;
