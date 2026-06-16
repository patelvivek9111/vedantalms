import React, { useEffect, useMemo, useState } from 'react';
import FileUploadDropzone from './FileUploadDropzone';
import FileUploadList from './FileUploadList';
import FilePreviewModal from './FilePreviewModal';
import FileReplaceDialog from './FileReplaceDialog';
import FileAccessBanner from './FileAccessBanner';
import FileVersionHistory from './FileVersionHistory';
import { useFileUploadQueue } from '../../hooks/useFileUploadQueue';
import { useFileDownload } from '../../hooks/useFileDownload';
import type { NormalizedFile } from '../../utils/fileTypes';
import {
  extractFileAssetId,
  needsFileNameHydration,
  normalizeLegacyFiles,
} from '../../utils/fileTypes';
import { fetchFilesMetadataBatch } from '../../services/fileUploadApi';

interface FileAttachmentPanelProps {
  files: NormalizedFile[];
  onChange: (files: NormalizedFile[]) => void;
  courseId?: string;
  assignmentId?: string;
  category?: string;
  disabled?: boolean;
  finalized?: boolean;
  lockedMessage?: string;
  confirmReplace?: boolean;
  showVersionHistory?: boolean;
  versionHistoryAssetId?: string;
  label?: string;
  accept?: string;
  multiple?: boolean;
  className?: string;
  onRemoveFile?: (file: NormalizedFile, index: number) => void;
}

const FileAttachmentPanel: React.FC<FileAttachmentPanelProps> = ({
  files,
  onChange,
  courseId,
  assignmentId,
  category = 'temporary',
  disabled = false,
  finalized = false,
  lockedMessage,
  confirmReplace = false,
  showVersionHistory = false,
  versionHistoryAssetId,
  label = 'Choose files to attach',
  accept,
  multiple = true,
  className = '',
  onRemoveFile,
}) => {
  const [preview, setPreview] = useState<NormalizedFile | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [showReplace, setShowReplace] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const { error: downloadError, clearError } = useFileDownload();

  const {
    items,
    enqueue,
    cancel,
    retry,
    remove,
    isUploading,
    interrupted,
    recoveryBanner,
    dismissInterrupted,
    resume: resumeQueue,
  } = useFileUploadQueue({
    category,
    courseId,
    assignmentId,
    persistKey: `panel:${category}:${courseId || ''}:${assignmentId || ''}`,
  });

  const hydrateKey = files
    .filter(needsFileNameHydration)
    .map((f) => f.fileAssetId)
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (!hydrateKey) return;
    let cancelled = false;
    const ids = hydrateKey.split(',');
    fetchFilesMetadataBatch(ids)
      .then((metaList) => {
        if (cancelled) return;
        const byId = new Map(metaList.map((m) => [m.fileAssetId, m]));
        const next = files.map((f) => {
          const meta = f.fileAssetId ? byId.get(f.fileAssetId) : undefined;
          if (!meta || !needsFileNameHydration(f)) return f;
          return {
            ...f,
            name: meta.originalName || f.name,
            size: f.size ?? meta.size,
            mimeType: f.mimeType ?? meta.mimeType,
          };
        });
        if (next.some((f, i) => f.name !== files[i].name)) onChange(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when unresolved file ids change
  }, [hydrateKey]);

  useEffect(() => {
    const newlyDone = items.filter(
      (i) =>
        i.status === 'done' &&
        i.fileAssetId &&
        !files.some((f) => f.fileAssetId === i.fileAssetId)
    );
    if (!newlyDone.length) return;
    onChange([
      ...files,
      ...newlyDone.map(({ fileAssetId, name, url, size, mimeType }) => ({
        fileAssetId,
        name,
        url,
        size,
        mimeType,
        status: 'done' as const,
      })),
    ]);
    newlyDone.forEach((i) => remove(i.id));
  }, [items, files, onChange, remove]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      resumeQueue();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [resumeQueue]);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (disabled || finalized) return;
    const next = [...files];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  const displayItems = useMemo(() => {
    const queued = items.filter((i) => i.status !== 'done' && i.status !== 'cancelled');
    return [...files, ...queued];
  }, [files, items]);

  const handleIncoming = (incoming: File[]) => {
    if (disabled || finalized) return;
    if (confirmReplace && files.length > 0) {
      setPendingFiles(incoming);
      setShowReplace(true);
      return;
    }
    enqueue(incoming);
  };

  const handleRemove = (index: number) => {
    if (disabled || finalized) return;
    const file = displayItems[index] as NormalizedFile;
    if (onRemoveFile && file?.fileAssetId) onRemoveFile(file, index);
    if (file && 'id' in file && (file as { id?: string }).id?.startsWith('fq-')) {
      remove((file as { id: string }).id);
      return;
    }
    onChange(files.filter((_, i) => i !== index));
  };

  const historyId = versionHistoryAssetId || files[0]?.fileAssetId;

  return (
    <div className={className}>
      {lockedMessage && finalized && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3" role="status">
          {lockedMessage}
        </p>
      )}
      {offline && (
        <p className="text-sm text-amber-600 mb-2" role="status">
          You appear offline. Uploads will resume when your connection returns.
        </p>
      )}
      {recoveryBanner && (
        <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2 rounded border border-indigo-200 dark:border-indigo-800 p-2" role="status">
          {recoveryBanner}
        </p>
      )}
      {interrupted.length > 0 && (
        <div className="text-sm text-amber-700 dark:text-amber-300 mb-2 rounded border border-amber-200 dark:border-amber-800 p-2" role="status">
          <p className="font-medium">Interrupted uploads</p>
          <p className="text-xs mt-1">
            {interrupted.length} file(s) did not finish before you left. Re-select files to upload again.
          </p>
          <ul className="text-xs mt-1 list-disc pl-4">
            {interrupted.map((i) => (
              <li key={i.id}>{i.name}</li>
            ))}
          </ul>
          <button type="button" className="text-xs underline mt-1" onClick={dismissInterrupted}>
            Dismiss
          </button>
        </div>
      )}
      <FileAccessBanner message={downloadError} onDismiss={clearError} />

      {!disabled && !finalized && (
        <FileUploadDropzone
          onFilesSelected={handleIncoming}
          disabled={disabled || finalized || isUploading}
          multiple={multiple}
          accept={accept}
          label={label}
        />
      )}

      {displayItems.length > 0 && (
        <div className="mt-3">
          <FileUploadList
            items={displayItems}
            finalized={finalized}
            onPreview={(f) => setPreview(f)}
            onRemove={handleRemove}
            onRetry={retry}
            onCancel={cancel}
            onReorder={!finalized && !disabled ? handleReorder : undefined}
            reorderableCount={files.length}
          />
        </div>
      )}

      {showVersionHistory && <FileVersionHistory fileAssetId={historyId} finalized={finalized} />}

      <FilePreviewModal file={preview} open={!!preview} onClose={() => setPreview(null)} />

      <FileReplaceDialog
        open={showReplace}
        onCancel={() => {
          setShowReplace(false);
          setPendingFiles(null);
        }}
        onConfirm={() => {
          if (pendingFiles) enqueue(pendingFiles);
          setShowReplace(false);
          setPendingFiles(null);
        }}
      />
    </div>
  );
};

export { normalizeLegacyFiles } from '../../utils/fileTypes';

export default FileAttachmentPanel;
