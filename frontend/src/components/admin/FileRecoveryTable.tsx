import React, { useCallback, useEffect, useState } from 'react';
import { useVirtualWindow } from '../../hooks/useVirtualWindow';
import { fetchRecoverableFiles, type RecoverableFile } from '../../services/recoveryApi';
import { ErrorBanner, LoadingInline } from '../../design-system';

const ROW_H = 44;
const VIEW_H = 400;

interface FileRecoveryTableProps {
  filter: string;
  search?: string;
  selectedId: string | null;
  onSelect: (file: RecoverableFile) => void;
  refreshKey?: number;
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
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all: RecoverableFile[] = [];
      let cursor: string | undefined;
      do {
        const res = await fetchRecoverableFiles({ filter, search, cursor, limit: 100 });
        if (!res.success) break;
        all.push(...res.data.items);
        cursor = res.data.hasMore ? res.data.nextCursor || undefined : undefined;
      } while (cursor && all.length < 2000);
      setItems(all);
    } catch {
      setError('Failed to load recoverable files');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const { range, onScroll, enabled } = useVirtualWindow({
    itemCount: items.length,
    estimatedItemHeight: ROW_H,
    containerHeight: VIEW_H,
    threshold: 80,
  });

  if (loading) return <LoadingInline label="Loading files…" />;
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;

  const visible = enabled ? items.slice(range.start, range.end) : items;

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      style={{ height: VIEW_H }}
      onScroll={onScroll}
      role="listbox"
      aria-label="Recoverable files"
    >
      <div style={{ paddingTop: enabled ? range.paddingTop : 0, paddingBottom: enabled ? range.paddingBottom : 0 }}>
        {visible.map((file) => (
          <button
            key={file._id}
            type="button"
            role="option"
            aria-selected={selectedId === file._id}
            onClick={() => onSelect(file)}
            className={`w-full text-left px-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 ${
              selectedId === file._id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            style={{ height: ROW_H }}
          >
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
              {file.originalName}
            </span>
            <span className="text-xs text-gray-500 shrink-0">{file.scanStatus || file.category}</span>
          </button>
        ))}
      </div>
      {!items.length && <p className="p-4 text-sm text-gray-500">No files match this filter.</p>}
    </div>
  );
};

export default FileRecoveryTable;
