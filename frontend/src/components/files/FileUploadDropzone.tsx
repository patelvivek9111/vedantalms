import React, { useCallback, useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
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
  label = 'Drop files here or browse',
  hint = 'Secure upload — files are stored as institutional assets',
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    validateAndEmit(e.dataTransfer.files);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onKeyDown={onKeyDown}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors touch-manipulation ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" aria-hidden />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Keyboard: focus and press Enter to browse</p>
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
