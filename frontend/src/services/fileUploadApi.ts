import api, { getImageUrl } from './api';
import { getMemoryAuthToken } from '../utils/authToken';
import { extractFileAssetId, isMongoObjectId, buildSecureDownloadPath, mapUploadResponse, type NormalizedFile } from '../utils/fileTypes';

export interface UploadOptions {
  category?: string;
  courseId?: string;
  assignmentId?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

export async function uploadFiles(
  files: File[],
  options: UploadOptions = {}
): Promise<NormalizedFile[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (options.category) formData.append('category', options.category);
  if (options.courseId) formData.append('courseId', options.courseId);
  if (options.assignmentId) formData.append('assignmentId', options.assignmentId);

  const res = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal: options.signal,
    onUploadProgress: (evt) => {
      if (!evt.total || !options.onProgress) return;
      options.onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });

  const list = Array.isArray(res.data?.files) ? res.data.files : [];
  return list.map((f: Record<string, unknown>) => mapUploadResponse(f));
}

export function resolveSecureFileUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http')) return url;
  if (isMongoObjectId(url)) return getImageUrl(buildSecureDownloadPath(url));
  if (url.startsWith('/api/files/')) return getImageUrl(url);
  const id = extractFileAssetId(url);
  if (id) return getImageUrl(buildSecureDownloadPath(id));
  return getImageUrl(url);
}

export async function fetchFileMetadata(fileAssetId: string) {
  const res = await api.get(`/files/${fileAssetId}/metadata`);
  return res.data?.data;
}

export async function fetchFilesMetadataBatch(fileAssetIds: string[]) {
  if (!fileAssetIds.length) return [];
  const res = await api.post('/files/batch-metadata', { fileAssetIds });
  const list = res.data?.data;
  return Array.isArray(list) ? list : [];
}

export async function refreshDownloadToken(fileAssetId: string) {
  const res = await api.post(`/files/${fileAssetId}/download-token`);
  return res.data?.data as { token: string; downloadUrl: string; expiresAt: string };
}

type CachedDownloadToken = {
  token: string;
  downloadUrl: string;
  expiresAtMs: number;
};

const downloadTokenCache = new Map<string, CachedDownloadToken>();
const pendingTokenRequests = new Map<string, Promise<{ token: string; downloadUrl: string; expiresAt: string } | null>>();
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function downloadTokenCacheKey(fileAssetId: string): string {
  const userKey = getMemoryAuthToken()?.slice(-16) || 'anon';
  return `${userKey}:${fileAssetId}`;
}

/** Reuse a cached download token when still valid to cut preview API load. */
export async function getDownloadToken(
  fileAssetId: string
): Promise<{ token: string; downloadUrl: string; expiresAt: string } | null> {
  const key = downloadTokenCacheKey(fileAssetId);
  const cached = downloadTokenCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAtMs - TOKEN_REFRESH_BUFFER_MS > now) {
    return {
      token: cached.token,
      downloadUrl: cached.downloadUrl,
      expiresAt: new Date(cached.expiresAtMs).toISOString(),
    };
  }

  const pending = pendingTokenRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const refreshed = await refreshDownloadToken(fileAssetId);
      if (refreshed?.token) {
        const expiresAtMs = refreshed.expiresAt
          ? new Date(refreshed.expiresAt).getTime()
          : now + 55 * 60 * 1000;
        if (Number.isFinite(expiresAtMs)) {
          downloadTokenCache.set(key, {
            token: refreshed.token,
            downloadUrl: refreshed.downloadUrl,
            expiresAtMs,
          });
        }
      }
      return refreshed ?? null;
    } catch {
      return null;
    } finally {
      pendingTokenRequests.delete(key);
    }
  })();

  pendingTokenRequests.set(key, request);
  return request;
}

export function clearDownloadTokenCache(): void {
  downloadTokenCache.clear();
  pendingTokenRequests.clear();
}

/** Follow CDN/storage redirects without leaking LMS auth headers. */
async function fetchRedirectTarget(location: string): Promise<Response> {
  const url = location.startsWith('http') ? location : resolveSecureFileUrl(location);
  return fetch(url);
}

/** Fetch a protected file path with Bearer auth (+ optional download token). */
export async function fetchAuthenticatedFile(
  fileAssetId: string,
  resourcePath: string
): Promise<Response> {
  const suffix = resourcePath.replace(/^\//, '');
  let path = `/api/files/${fileAssetId}/${suffix}`;
  try {
    const refreshed = await getDownloadToken(fileAssetId);
    if (refreshed?.token) {
      path += `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(refreshed.token)}`;
    }
  } catch {
    /* Bearer-only */
  }
  const target = resolveSecureFileUrl(path);
  const authToken = getMemoryAuthToken();
  const authHeaders: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  // Match download: follow API → Cloudinary redirects. manual + cross-origin yields status 0
  // (opaqueredirect) when Location is hidden, which breaks blob previews inconsistently.
  const followed = await fetch(target, { headers: authHeaders, redirect: 'follow' });
  if (followed.ok) {
    return followed;
  }

  // Fallback for same-origin proxies that expose Location on manual redirect.
  const manual = await fetch(target, { headers: authHeaders, redirect: 'manual' });
  const needsRedirectFollow =
    manual.status === 0 ||
    manual.type === 'opaqueredirect' ||
    (manual.status >= 300 && manual.status < 400);
  if (needsRedirectFollow) {
    const location = manual.headers.get('Location');
    if (location) {
      const redirected = await fetchRedirectTarget(location);
      if (redirected.ok) return redirected;
    }
    const retryFollow = await fetch(target, { headers: authHeaders, redirect: 'follow' });
    if (retryFollow.ok) return retryFollow;
  }

  return followed.status ? followed : manual;
}

export async function fetchAuthenticatedFileBlob(
  fileAssetId: string,
  resourcePath = 'stream'
): Promise<Blob> {
  const res = await fetchAuthenticatedFile(fileAssetId, resourcePath);
  if (!res.ok) {
    const err = new Error(`File fetch failed (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.blob();
}

export async function fetchFileVersions(fileAssetId: string) {
  const res = await api.get(`/files/${fileAssetId}/versions`);
  return res.data?.data as {
    current: Record<string, unknown> | null;
    versions: Record<string, unknown>[];
  };
}

export function buildStreamUrl(fileAssetId: string, downloadUrl?: string): string {
  if (downloadUrl) return resolveSecureFileUrl(downloadUrl);
  return resolveSecureFileUrl(`/api/files/${fileAssetId}/stream`);
}
