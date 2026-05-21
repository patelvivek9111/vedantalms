import React, { useMemo, useState } from 'react';
import type { QueueItem } from '../../hooks/useFileUploadQueue';
import FileUploadItem from './FileUploadItem';
import type { NormalizedFile } from '../../utils/fileTypes';

interface FileUploadListProps {
  items: QueueItem[] | NormalizedFile[];
  onPreview?: (file: NormalizedFile) => void;
  onRemove?: (index: number) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  reorderableCount?: number;
  finalized?: boolean;
  emptyLabel?: string;
}

const FileUploadList: React.FC<FileUploadListProps> = ({
  items,
  onPreview,
  onRemove,
  onRetry,
  onCancel,
  onReorder,
  reorderableCount = 0,
  finalized,
  emptyLabel = 'No files attached',
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const PAGE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  if (!items.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2" aria-label="Uploaded files">
      {visibleItems.map((item, index) => {
        const queueItem = item as QueueItem;
        const id = queueItem.id || String(index);
        const canDrag = Boolean(onReorder) && index < reorderableCount && !(queueItem.id?.startsWith('fq-'));
        return (
          <div
            key={id}
            draggable={canDrag}
            onDragStart={() => canDrag && setDragIndex(index)}
            onDragOver={(e) => canDrag && e.preventDefault()}
            onDrop={() => {
              if (canDrag && dragIndex != null && dragIndex !== index) {
                onReorder?.(dragIndex, index);
              }
              setDragIndex(null);
            }}
            className={canDrag ? 'cursor-grab active:cursor-grabbing' : undefined}
          >
          <FileUploadItem
            item={
              queueItem.id
                ? queueItem
                : {
                    ...item,
                    id: `static-${index}`,
                    status: 'done',
                    retries: 0,
                  }
            }
            finalized={finalized}
            onPreview={onPreview ? () => onPreview(item as NormalizedFile) : undefined}
            onRemove={onRemove ? () => onRemove(index) : undefined}
            onRetry={onRetry && queueItem.id ? () => onRetry(queueItem.id) : undefined}
            onCancel={onCancel && queueItem.id ? () => onCancel(queueItem.id) : undefined}
          />
          </div>
        );
      })}
      {items.length > visibleCount && (
        <li>
          <button
            type="button"
            className="text-sm text-indigo-600 dark:text-indigo-400"
            onClick={() => setVisibleCount((c) => c + PAGE)}
          >
            Show more ({items.length - visibleCount} remaining)
          </button>
        </li>
      )}
    </ul>
  );
};

export default FileUploadList;
