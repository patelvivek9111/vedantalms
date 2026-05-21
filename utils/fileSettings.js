const SystemSettings = require('../models/systemSettings.model');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

let cachedSettings = null;
let cacheAt = 0;
const CACHE_MS = 60 * 1000;

async function loadUploadSettings() {
  const now = Date.now();
  if (cachedSettings && now - cacheAt < CACHE_MS) {
    return cachedSettings;
  }
  try {
    const doc = await SystemSettings.findOne().lean();
    const maxMb = doc?.general?.maxFileSize ?? 10;
    const allowed = doc?.general?.allowedFileTypes;
    cachedSettings = {
      maxFileSizeBytes: Math.max(1, Number(maxMb) || 10) * 1024 * 1024,
      allowedMimeTypes: mapAllowedTypesToMimes(allowed),
    };
  } catch {
    cachedSettings = {
      maxFileSizeBytes: DEFAULT_MAX_BYTES,
      allowedMimeTypes: DEFAULT_ALLOWED_MIMES,
    };
  }
  cacheAt = now;
  return cachedSettings;
}

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
};

function mapAllowedTypesToMimes(allowed) {
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return DEFAULT_ALLOWED_MIMES;
  }
  const mimes = new Set();
  for (const ext of allowed) {
    const key = String(ext).toLowerCase().replace(/^\./, '');
    if (EXT_TO_MIME[key]) mimes.add(EXT_TO_MIME[key]);
  }
  return mimes.size ? [...mimes] : DEFAULT_ALLOWED_MIMES;
}

function clearUploadSettingsCache() {
  cachedSettings = null;
  cacheAt = 0;
}

/** Infer MIME from filename when the browser sends an empty or generic type. */
function resolveUploadMimeType(fileName, mimeType) {
  const raw = (mimeType || '').toLowerCase().trim();
  if (raw && raw !== 'application/octet-stream') return raw;
  const ext = String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/^\./, '');
  return (ext && EXT_TO_MIME[ext]) || raw || 'application/octet-stream';
}

module.exports = {
  loadUploadSettings,
  clearUploadSettingsCache,
  resolveUploadMimeType,
  DEFAULT_MAX_BYTES,
  DEFAULT_ALLOWED_MIMES,
};
