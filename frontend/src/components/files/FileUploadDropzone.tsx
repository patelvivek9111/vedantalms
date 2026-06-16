import React, { useCallback, useId, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { ErrorBanner } from '../../design-system';

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
  maxFileSizeBytes?: number;
  /** Mobile camera capture: environment | user */
  capture?: 'environment' | 'user' | boolean;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const tokens = accept.split(',').map((t) => t.trim().toLowerCase());
  const name = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return mime.startsWith(token.replace('/*', '/'));
    return mime === token;
  });
}

const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  onFilesSelected,
  disabled = false,
  multiple = true,
  accept,
  label = 'Choose files to attach',
  hint = 'Click to browse or drag files here',
  className = '',
  maxFileSizeBytes = DEFAULT_MAX_BYTES,
  capture,
}) => {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndEmit = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const accepted: File[] = [];
      const rejected: string[] = [];
      for (const file of Array.from(list)) {
        if (!matchesAccept(file, accept)) {
          rejected.push(`${file.name}: type not allowed`);
          continue;
        }
        if (file.size > maxFileSizeBytes) {
          rejected.push(`${file.name}: exceeds size limit`);
          continue;
        }
        accepted.push(file);
      }
      if (rejected.length) setRejectMsg(rejected.join('; '));
      else setRejectMsg(null);
      if (accepted.length) onFilesSelected(accepted);
    },
    [accept, maxFileSizeBytes, onFilesSelected]
  );

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    validateAndEmit(e.dataTransfer.files);
  };

  return (
    <div className={className}>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="relative"
      >
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          onClick={openPicker}
          className={`flex w-full min-h-[48px] items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition touch-manipulation dark:bg-slate-900 ${
            disabled
              ? 'cursor-not-allowed border-slate-200 opacity-50 dark:border-slate-700'
              : dragOver
                ? 'border-indigo-400 bg-indigo-50/80 ring-2 ring-indigo-500/30 dark:border-indigo-500 dark:bg-indigo-950/30'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-indigo-600 dark:hover:bg-slate-800/80'
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              dragOver
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
            aria-hidden
          >
            <Paperclip className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {label}
            </span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{hint}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white dark:bg-indigo-500">
            Browse
          </span>
        </button>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        multiple={multiple}
        accept={accept}
        capture={capture === true ? 'environment' : capture || undefined}
        disabled={disabled}
        onChange={(e) => {
          validateAndEmit(e.target.files);
          e.target.value = '';
        }}
      />
      {rejectMsg && <ErrorBanner className="mt-2" message={rejectMsg} onRetry={() => setRejectMsg(null)} />}
    </div>
  );
};

export default FileUploadDropzone;
