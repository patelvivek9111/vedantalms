export interface NormalizedFile {
  fileAssetId?: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  progress?: number;
  status?: 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';
  error?: string;
  lifecycleLocked?: boolean;
  scanStatus?: string;
  isCurrentVersion?: boolean;
  versionNumber?: number;
  blobQuarantined?: boolean;
  cleanupState?: string;
  previewStatus?: string;
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isMongoObjectId(value: string): boolean {
  return MONGO_OBJECT_ID_RE.test(value);
}

/** Collect validated file asset IDs from upload panel state for API payloads. */
export function fileAssetIdsFromFiles(files: NormalizedFile[]): string[] {
  return files
    .map((f) => f.fileAssetId)
    .filter((id): id is string => Boolean(id && isMongoObjectId(id)));
}

export function extractFileAssetId(url: string): string | null {
  if (!url) return null;
  if (isMongoObjectId(url)) return url;
  const m = url.match(/\/api\/files\/([a-f0-9]{24})/i);
  return m ? m[1] : null;
}

export function buildSecureDownloadPath(fileAssetId: string): string {
  return `/api/files/${fileAssetId}/download`;
}

export function buildSecureStreamPath(fileAssetId: string): string {
  return `/api/files/${fileAssetId}/stream`;
}

export function getExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export type PreviewKind = 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'office' | 'unsupported';

const OFFICE_EXTENSIONS = ['doc', 'docx', 'odt', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods', 'rtf'];

/** Modern Word (.docx) — rendered in-browser with docx-preview. */
export function isDocxFile(file: { name: string; mimeType?: string }): boolean {
  const ext = getExtension(file.name);
  const mime = (file.mimeType || '').toLowerCase();
  return (
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function isOfficeFile(file: { name: string; mimeType?: string }): boolean {
  const ext = getExtension(file.name);
  const mime = (file.mimeType || '').toLowerCase();
  if (OFFICE_EXTENSIONS.includes(ext)) return true;
  return (
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml') ||
    mime.includes('presentationml') ||
    mime === 'application/msword' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/rtf'
  );
}

export function detectPreviewKind(file: { name: string; mimeType?: string }): PreviewKind {
  const ext = getExtension(file.name);
  const mime = (file.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
  if (isOfficeFile(file)) return 'office';
  if (
    mime.startsWith('text/') ||
    ['txt', 'csv', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css'].includes(ext)
  ) {
    return 'text';
  }
  return 'unsupported';
}

export function dedupeFileNames(files: File[]): File[] {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const base = f.name;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    if (count === 0) return f;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    return new File([f], `${stem} (${count + 1})${ext}`, { type: f.type });
  });
}

export function mapUploadResponse(file: Record<string, unknown>): NormalizedFile {
  const url = String(file.path || file.url || '');
  const extractedId = extractFileAssetId(url);
  const rawId = file.fileAssetId || file._id || extractedId;
  const id =
    rawId && isMongoObjectId(String(rawId)) ? String(rawId) : extractedId || undefined;
  return {
    fileAssetId: id,
    name: String(file.originalname || file.originalName || file.name || 'file'),
    url: url || (id ? buildSecureDownloadPath(id) : ''),
    size: typeof file.size === 'number' ? file.size : undefined,
    mimeType: typeof file.mimeType === 'string' ? file.mimeType : undefined,
    status: 'done',
  };
}

/** True when the UI label is a placeholder and should be resolved from file metadata. */
export function needsFileNameHydration(file: NormalizedFile): boolean {
  if (!file.fileAssetId) return false;
  const n = (file.name || '').trim();
  if (!n || n === 'file' || n === 'attachment') return true;
  if (/^file-\d+$/i.test(n)) return true;
  if (!getExtension(n) && !file.mimeType) return true;
  return false;
}

export function normalizeLegacyFiles(
  raw: Array<string | Record<string, unknown>>
): NormalizedFile[] {
  return raw.map((item) => {
    if (typeof item === 'string') {
      const fileAssetId = extractFileAssetId(item);
      if (fileAssetId) {
        return {
          fileAssetId,
          name: '',
          url: isMongoObjectId(item) ? buildSecureDownloadPath(fileAssetId) : item,
          status: 'done' as const,
        };
      }
      return { name: item.split('/').pop() || 'attachment', url: item, status: 'done' };
    }
    const url = String(item.url || item.path || '');
    const id = String(item.fileAssetId || item._id || extractFileAssetId(url) || '');
    return mapUploadResponse({
      ...item,
      fileAssetId: id || item.fileAssetId,
      path: url || (id ? buildSecureDownloadPath(id) : ''),
      originalname: item.name || item.originalname || item.originalName,
    });
  });
}

/** Prefer a human-readable filename (with extension) over generic placeholders. */
export function preferFileDisplayName(existing: string, candidate?: string): string {
  const current = (existing || '').trim();
  const next = (candidate || '').trim();
  if (!next) return current || 'file';
  if (!current || current === 'file' || current === 'attachment' || current === 'download') {
    return next;
  }
  if (!getExtension(current) && getExtension(next)) return next;
  if (needsFileNameHydration({ name: current, fileAssetId: 'a'.repeat(24) })) return next;
  return current;
}

/**
 * Normalize submission attachments for instructor grading — pairs fileAsset IDs with
 * legacy filename paths when clientFiles only contains legacy entries.
 */
export function normalizeSubmissionAttachments(submission: {
  clientFiles?: Array<Record<string, unknown>>;
  files?: Array<string | Record<string, unknown>>;
  fileAssets?: Array<string | Record<string, unknown>>;
}): NormalizedFile[] {
  const secureClientFiles = (submission.clientFiles || []).filter((a) => {
    const url = String(a.url || a.path || '');
    const id = String(a.fileAssetId || a._id || extractFileAssetId(url) || '');
    return Boolean(id && isMongoObjectId(id));
  });

  if (secureClientFiles.length) {
    return normalizeAttachmentSources({ attachmentFiles: secureClientFiles });
  }

  const assetIds = (submission.fileAssets || [])
    .map((id) => (typeof id === 'string' ? id : String((id as { _id?: string })._id || id)))
    .filter((id) => isMongoObjectId(id));

  const legacyFiles = submission.files || [];

  if (assetIds.length) {
    return assetIds.map((id, index) => {
      const legacy = legacyFiles[index] ?? legacyFiles[0];
      const legacyNorm = legacy ? normalizeLegacyFiles([legacy])[0] : null;
      const name = preferFileDisplayName(legacyNorm?.name || '', legacyNorm?.name);
      return {
        fileAssetId: id,
        name: name || 'attachment',
        url: buildSecureDownloadPath(id),
        mimeType: legacyNorm?.mimeType,
        status: 'done' as const,
      };
    });
  }

  if (legacyFiles.length) {
    return normalizeLegacyFiles(legacyFiles);
  }

  return [];
}

/** Prefer API attachmentFiles; fall back to legacy attachment id/url lists. */
export function normalizeAttachmentSources(source: {
  attachmentFiles?: Array<Record<string, unknown>>;
  attachments?: Array<string | Record<string, unknown>>;
  fileAssets?: Array<string | Record<string, unknown>>;
}): NormalizedFile[] {
  const secureAttachmentFiles = (source.attachmentFiles || []).filter((a) => {
    const url = String(a.url || a.path || '');
    const id = String(a.fileAssetId || a._id || extractFileAssetId(url) || '');
    return Boolean(id && isMongoObjectId(id));
  });

  if (secureAttachmentFiles.length) {
    return secureAttachmentFiles.map((a) => {
      const url = String(a.url || a.path || '');
      const fileAssetId = String(a.fileAssetId || a._id || extractFileAssetId(url) || '');
      const legacyName = url.split('/').pop() || '';
      return mapUploadResponse({
        fileAssetId: fileAssetId || undefined,
        originalname: preferFileDisplayName(
          legacyName,
          String(a.originalName || a.originalname || a.name || '')
        ),
        path: url || (fileAssetId ? buildSecureDownloadPath(fileAssetId) : ''),
        size: a.size,
        mimeType: a.mimeType,
      });
    });
  }
  const raw =
    source.attachments?.length
      ? source.attachments
      : (source.fileAssets || []).map((id) => (typeof id === 'string' ? id : String(id)));
  return normalizeLegacyFiles(raw);
}

export function fileAccessErrorMessage(status?: number, fallback?: string): string {
  if (status === 401) return 'Your session expired. Sign in again to access this file.';
  if (status === 403) return 'You do not have permission to access this file.';
  if (status === 410) return 'This download link expired. Refresh the page to get a new link.';
  return fallback || 'Unable to access this file.';
}
