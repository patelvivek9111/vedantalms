/**
 * Delivery-time Cloudinary URL optimization (frontend mirror of utils/cloudinaryUrl.js).
 * Inserts f_auto,q_auto into the transformation segment for browser delivery.
 */

const CLOUDINARY_HOST = 'res.cloudinary.com';
const UPLOAD_PREFIX_RE =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|auto)\/upload)\/(.+)$/i;
const SIGNED_SEGMENT_RE = /\/s--[^/]+--\//;
const VERSION_PREFIX_RE = /^v\d+\//;
const VERSION_IN_PATH_RE = /\/v\d+\//;
const TRANSFORM_HINT_RE = /[,_=]|^(?:f_|q_|w_|c_|h_|e_|fl_|dpr_|r_)/;

export function isCloudinaryUrl(url: string): boolean {
  return typeof url === 'string' && url.includes(CLOUDINARY_HOST);
}

function splitUploadPath(afterUpload: string): { transforms: string[]; publicPath: string } {
  if (VERSION_PREFIX_RE.test(afterUpload)) {
    return { transforms: [], publicPath: afterUpload };
  }

  const versionMatch = afterUpload.match(VERSION_IN_PATH_RE);
  if (versionMatch && versionMatch.index != null && versionMatch.index > 0) {
    return {
      transforms: afterUpload
        .slice(0, versionMatch.index)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
      publicPath: afterUpload.slice(versionMatch.index + 1),
    };
  }

  const slash = afterUpload.indexOf('/');
  if (slash > 0) {
    const first = afterUpload.slice(0, slash);
    if (TRANSFORM_HINT_RE.test(first)) {
      return {
        transforms: first
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        publicPath: afterUpload.slice(slash + 1),
      };
    }
  }

  return { transforms: [], publicPath: afterUpload };
}

export type OptimizeCloudinaryOptions = {
  /** Cap delivery width (c_limit). Use for avatars / dock logos. */
  width?: number;
};

/**
 * Insert f_auto,q_auto (and optional w_<n>,c_limit) into a Cloudinary delivery URL.
 * Idempotent. Passes through non-Cloudinary, signed, raw/video, and empty values.
 */
export function optimizeCloudinaryUrl(
  url: string,
  options: OptimizeCloudinaryOptions = {}
): string {
  if (!url || typeof url !== 'string') return url || '';
  if (!isCloudinaryUrl(url)) return url;
  if (SIGNED_SEGMENT_RE.test(url)) return url;

  const match = url.match(UPLOAD_PREFIX_RE);
  if (!match) return url;

  const [, prefix, rest] = match;
  const qIndex = rest.indexOf('?');
  const pathPart = qIndex >= 0 ? rest.slice(0, qIndex) : rest;
  const querySuffix = qIndex >= 0 ? rest.slice(qIndex) : '';

  const { transforms, publicPath } = splitUploadPath(pathPart);
  const next = [...transforms];

  const hasFetchFormat = next.some((part) => part === 'f_auto' || part.startsWith('f_'));
  const hasQuality = next.some((part) => part === 'q_auto' || part.startsWith('q_'));
  const width =
    options.width != null && Number.isFinite(Number(options.width))
      ? Math.max(1, Math.round(Number(options.width)))
      : null;
  const hasWidth = width != null && next.some((part) => part.startsWith('w_'));

  if (!hasFetchFormat) next.unshift('f_auto');
  if (!hasQuality) {
    const fIdx = next.findIndex((part) => part === 'f_auto' || part.startsWith('f_'));
    next.splice(fIdx + 1, 0, 'q_auto');
  }
  if (width != null && !hasWidth) {
    next.push(`w_${width}`, 'c_limit');
  }

  return `${prefix}/${next.join(',')}/${publicPath}${querySuffix}`;
}
