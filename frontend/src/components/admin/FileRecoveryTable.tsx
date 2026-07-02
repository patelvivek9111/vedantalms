import React, { useCallback, useEffect, useState } from 'react';
import { fetchRecoverableFiles, type RecoverableFile } from '../../services/recoveryApi';
import { ErrorBanner, LoadingInline } from '../../design-system';

const PAGE_SIZE = 50;
const ROW_H = 44;
const VIEW_H = 360;

interface FileRecoveryTableProps {
  filter: string;
  search?: string;
  selectedId: string | null;
  onSelect: (file: RecoverableFile) => void;
  refreshKey?: number;
}

function statusLabel(file: RecoverableFile, filter: string) {
  if (file.isDeleted) return 'deleted';
  if (file.scanStatus === 'unsafe') return 'unsafe';
  if (filter === 'quarantine') return 'quarantine';
  return file.category || 'file';
}

const FileRecoveryTable: React.FC<FileRecoveryTableProps> = ({
  filter,
  search,
  selectedId,
  onSelect,
  refreshKey = 0,
}) => {
  const [items, setItems] = useState<RecoverableFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const res = await fetchRecoverableFiles({
          filter,
          search: search || undefined,
          cursor,
          limit: PAGE_SIZE,
        });
        if (!res.success) {
          setError('Failed to load recoverable files');
          return;
        }
        setItems((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
        setNextCursor(res.data.nextCursor);
        setHasMore(Boolean(res.data.hasMore && res.data.nextCursor));
      } catch {
        setError('Failed to load recoverable files');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, search]
  );

  useEffect(() => {
    void loadPage(undefined, false);
  }, [loadPage, refreshKey]);

  if (loading) return <LoadingInline label="Loading files…" />;
  if (error) return <ErrorBanner message={error} onRetry={() => void loadPage(undefined, false)} />;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col" style={{ height: VIEW_H }}>
      <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Recoverable files">
        {items.map((file) => (
          <button
            key={file._id}
            type="button"
            role="option"
            aria-selected={selectedId === file._id}
            onClick={() => onSelect(file)}
            className={`w-full text-left px-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 ${
              selectedId === file._id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            style={{ minHeight: ROW_H }}
          >
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
              {file.originalName}
            </span>
            <span className="text-xs text-gray-500 shrink-0 capitalize">{statusLabel(file, filter)}</span>
          </button>
        ))}
        {!items.length && <p className="p-4 text-sm text-gray-500">No files match this filter.</p>}
      </div>
      {hasMore && nextCursor && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadPage(nextCursor, true)}
            className="w-full text-xs py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FileRecoveryTable;
