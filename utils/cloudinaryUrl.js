/**
 * Delivery-time Cloudinary URL optimization.
 *
 * Stored providerUrl values stay as the raw secure_url from upload. This helper
 * inserts f_auto,q_auto (and optional width) into the transformation segment so
 * browsers get WebP/AVIF at a sensible quality without re-uploading.
 *
 * Shape: https://res.cloudinary.com/<cloud>/<type>/upload/<transforms>/<public_id>
 */

const CLOUDINARY_HOST = 'res.cloudinary.com';
/** image + auto only — raw/video delivery should not get image transforms. */
const UPLOAD_PREFIX_RE =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|auto)\/upload)\/(.+)$/i;
const SIGNED_SEGMENT_RE = /\/s--[^/]+--\//;
const VERSION_PREFIX_RE = /^v\d+\//;
const VERSION_IN_PATH_RE = /\/v\d+\//;
const TRANSFORM_HINT_RE = /[,_=]|^(?:f_|q_|w_|c_|h_|e_|fl_|dpr_|r_)/;

/**
 * @param {string} url
 * @returns {boolean}
 */
function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes(CLOUDINARY_HOST);
}

/**
 * Split the path after /upload/ into existing transforms + remaining public path.
 * @param {string} afterUpload
 * @returns {{ transforms: string[], publicPath: string }}
 */
function splitUploadPath(afterUpload) {
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

/**
 * Insert f_auto,q_auto (and optional w_<n>,c_limit) into a Cloudinary delivery URL.
 * Idempotent. Passes through non-Cloudinary, signed, raw/video, and empty values.
 *
 * @param {string} url
 * @param {{ width?: number }} [options]
 * @returns {string}
 */
function optimizeCloudinaryUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url || '';
  if (!isCloudinaryUrl(url)) return url;
  // Signed URLs must include transforms at signing time — mutating them invalidates the sig.
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

module.exports = {
  optimizeCloudinaryUrl,
  isCloudinaryUrl,
};
