import React, { memo } from 'react';
import { Eye, X, RotateCcw } from 'lucide-react';
import { formatFileSize } from '../../utils/fileTypes';
import type { QueueItem } from '../../hooks/useFileUploadQueue';
import FileUploadProgress from './FileUploadProgress';
import FileGovernanceBadge from './FileGovernanceBadge';

interface FileUploadItemProps {
  item: QueueItem;
  onPreview?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  showPreview?: boolean;
  finalized?: boolean;
}

const FileUploadItem: React.FC<FileUploadItemProps> = memo(
  ({ item, onPreview, onRemove, onRetry, onCancel, showPreview = true, finalized }) => (
    <li className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {item.name?.trim() || 'Loading…'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(item.size)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <FileGovernanceBadge file={item} finalized={finalized} />
          {item.status === 'done' && showPreview && onPreview && (
            <button type="button" onClick={onPreview} className="p-1 text-indigo-600" aria-label={`Preview ${item.name}`}>
              <Eye className="w-4 h-4" />
            </button>
          )}
          {item.status === 'uploading' && onCancel && (
            <button type="button" onClick={onCancel} className="text-xs text-gray-500" aria-label="Cancel upload">
              Cancel
            </button>
          )}
          {item.status === 'error' && onRetry && (
            <button type="button" onClick={onRetry} className="p-1 text-amber-600" aria-label="Retry upload">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="p-1 text-red-600" aria-label={`Remove ${item.name}`}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {(item.status === 'uploading' || item.status === 'queued') && (
        <FileUploadProgress
          progress={item.progress ?? 0}
          label={
            item.status === 'queued'
              ? 'Queued'
              : item.bytesPerSecond && item.size
                ? `~${Math.max(1, Math.round((item.size * (1 - (item.progress ?? 0) / 100)) / item.bytesPerSecond))}s left`
                : undefined
          }
        />
      )}
      {item.status === 'error' && <p className="text-xs text-red-600 dark:text-red-400">{item.error}</p>}
    </li>
  )
);

FileUploadItem.displayName = 'FileUploadItem';

export default FileUploadItem;
