import React, { useState } from 'react';
import { Paperclip, Eye, X } from 'lucide-react';
import {
  normalizeLegacyFiles,
  normalizeAttachmentSources,
  type NormalizedFile,
} from '../../utils/fileTypes';
import FilePreviewModal from './FilePreviewModal';

interface FileAttachmentChipsProps {
  files?: Array<string | Record<string, unknown>>;
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
  const first = files[0];
  if (typeof first === 'object' && first !== null && ('originalName' in first || 'fileAssetId' in first)) {
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
          <li key={f.fileAssetId || i}>
            <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs">
              <Paperclip className="w-3 h-3 shrink-0 text-gray-500" aria-hidden />
              <button
                type="button"
                className="hover:underline text-left"
                onClick={(e) => openPreview(f, e)}
              >
                {f.name}
              </button>
              <button
                type="button"
                className="text-indigo-600 dark:text-indigo-400 hover:opacity-80"
                aria-label={`Preview ${f.name}`}
                onClick={(e) => openPreview(f, e)}
              >
                <Eye className="w-3 h-3" />
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
