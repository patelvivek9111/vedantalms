import React, { useState } from 'react';
import { Paperclip, Eye, X } from 'lucide-react';
import {
  normalizeLegacyFiles,
  normalizeAttachmentSources,
  isNormalizedFileList,
  type NormalizedFile,
} from '../../utils/fileTypes';
import FilePreviewModal from './FilePreviewModal';

interface FileAttachmentChipsProps {
  files?: Array<string | Record<string, unknown> | NormalizedFile>;
  attachmentSources?: {
    attachmentFiles?: Array<Record<string, unknown>>;
    attachments?: Array<string | Record<string, unknown>>;
    fileAssets?: Array<string | Record<string, unknown>>;
  };
  className?: string;
  removable?: boolean;
  onRemove?: (file: NormalizedFile, index: number) => void;
}

function normalizeChipFiles(props: FileAttachmentChipsProps): NormalizedFile[] {
  if (props.attachmentSources) {
    return normalizeAttachmentSources(props.attachmentSources);
  }
  const files = props.files;
  if (!files?.length) return [];

  // Callers like AssignmentGrading already run normalizeSubmissionAttachments —
  // do not re-run normalizeAttachmentSources (it used to drop legacy CDN files).
  if (isNormalizedFileList(files)) {
    return files;
  }

  const first = files[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    ('originalName' in first ||
      (typeof (first as { fileAssetId?: unknown }).fileAssetId === 'string' &&
        (first as { fileAssetId: string }).fileAssetId.length === 24))
  ) {
    return normalizeAttachmentSources({
      attachmentFiles: files as Array<Record<string, unknown>>,
    });
  }
  return normalizeLegacyFiles(files as Array<string | Record<string, unknown>>);
}

const FileAttachmentChips: React.FC<FileAttachmentChipsProps> = ({
  files = [],
  attachmentSources,
  className = '',
  removable = false,
  onRemove,
}) => {
  const normalized = normalizeChipFiles({ files, attachmentSources });
  const [preview, setPreview] = useState<NormalizedFile | null>(null);

  const openPreview = (file: NormalizedFile, e: React.MouseEvent) => {
    // Chips often render inside a clickable list row; keep the click from
    // bubbling to that row handler so we open the preview, not the detail view.
    e.stopPropagation();
    setPreview(file);
  };

  if (!normalized.length) return null;

  return (
    <>
      <ul className={`flex flex-wrap gap-2 mt-2 ${className}`} aria-label="Attachments">
        {normalized.map((f, i) => (
          <li key={f.fileAssetId || f.url || i}>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              <Paperclip className="w-3 h-3 shrink-0 text-slate-400" aria-hidden />
              <button
                type="button"
                className="font-medium hover:text-slate-900 dark:hover:text-white"
                onClick={(e) => openPreview(f, e)}
              >
                {f.name}
              </button>
              <button
                type="button"
                className="text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
                aria-label={`Preview ${f.name}`}
                onClick={(e) => openPreview(f, e)}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              {removable && onRemove && (
                <button
                  type="button"
                  className="text-red-600 dark:text-red-400 hover:opacity-80"
                  aria-label={`Remove ${f.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(f, i);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <FilePreviewModal file={preview} open={!!preview} onClose={() => setPreview(null)} />
    </>
  );
};

export default FileAttachmentChips;
