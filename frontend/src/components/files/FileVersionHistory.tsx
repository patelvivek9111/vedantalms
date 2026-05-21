import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { fetchFileVersions } from '../../services/fileUploadApi';
import { formatFileSize } from '../../utils/fileTypes';
import { LoadingInline, StatusBadge } from '../../design-system';
import { useFileDownload } from '../../hooks/useFileDownload';
import FileGovernanceBadge from './FileGovernanceBadge';

interface VersionRow {
  id: string;
  originalName: string;
  size?: number;
  versionNumber?: number;
  isCurrentVersion?: boolean;
  lifecycleLocked?: boolean;
  scanStatus?: string;
  createdAt?: string;
  uploadedBy?: { name?: string } | null;
  downloadUrl?: string;
}

interface FileVersionHistoryProps {
  fileAssetId?: string;
  finalized?: boolean;
}

const FileVersionHistory: React.FC<FileVersionHistoryProps> = ({ fileAssetId, finalized }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<VersionRow | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const { downloadFile } = useFileDownload();

  useEffect(() => {
    if (!open || !fileAssetId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchFileVersions(fileAssetId);
        if (!cancelled) {
          setCurrent((data?.current as VersionRow) || null);
          setVersions((data?.versions as VersionRow[]) || []);
        }
      } catch {
        if (!cancelled) {
          setCurrent(null);
          setVersions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fileAssetId]);

  if (!fileAssetId) return null;

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Version history
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <LoadingInline label="Loading versions…" />}
          {current && (
            <div className="flex items-center justify-between text-sm p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded">
              <div>
                <StatusBadge tone="success">Current</StatusBadge>
                <span className="ml-2">{current.originalName}</span>
                <span className="text-xs text-gray-500 ml-2">v{current.versionNumber || 1}</span>
              </div>
              <FileGovernanceBadge file={current} finalized={finalized} />
            </div>
          )}
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="min-w-0">
                <p className="truncate">{v.originalName}</p>
                <p className="text-xs text-gray-500">
                  v{v.versionNumber} · {formatFileSize(v.size)}
                  {v.createdAt ? ` · ${new Date(v.createdAt).toLocaleString()}` : ''}
                  {v.uploadedBy?.name ? ` · ${v.uploadedBy.name}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="p-1 text-indigo-600 disabled:opacity-40"
                disabled={finalized && v.lifecycleLocked}
                title={finalized ? 'Historical download only' : 'Download version'}
                onClick={() => downloadFile(v.downloadUrl || '', v.originalName, v.id)}
                aria-label={`Download ${v.originalName}`}
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!loading && !versions.length && (
            <p className="text-xs text-gray-500">No prior versions.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default FileVersionHistory;
