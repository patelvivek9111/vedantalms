const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { paths, isPathInside } = require('../config/paths');

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return { checksum: hash.digest('hex'), size: buf.length };
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function normalizeLegacyUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('cloudinary.com')) return url;
  const trimmed = url.replace(/^https?:\/\/[^/]+/i, '');
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  if (!trimmed.startsWith('/')) return `/uploads/${trimmed}`;
  return trimmed;
}

function resolveLocalPathFromUrl(url) {
  const normalized = normalizeLegacyUrl(url);
  if (!normalized || normalized.includes('cloudinary.com')) return null;
  const relative = normalized.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  const full = path.join(paths.uploads, relative);
  const resolved = path.resolve(full);
  if (!isPathInside(paths.uploads, resolved)) return null;
  return fs.existsSync(resolved) ? resolved : null;
}

function inferMimeFromName(name) {
  const ext = path.extname(name || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function storageKeyFromRelative(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function isSkippableUploadsDir(relativePath) {
  const p = relativePath.replace(/\\/g, '/');
  return (
    p.startsWith('public/') ||
    p.startsWith('reports/') ||
    p.startsWith('exports/') ||
    p.startsWith('job-exports/') ||
    p.startsWith('archives/') ||
    p.startsWith('migration/')
  );
}

function walkUploadsDir(dir = paths.uploads, base = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!isSkippableUploadsDir(rel)) {
        results.push(...walkUploadsDir(path.join(dir, entry.name), rel));
      }
    } else if (entry.isFile()) {
      if (!isSkippableUploadsDir(rel)) {
        results.push({ relativePath: rel.replace(/\\/g, '/'), absolutePath: path.join(dir, entry.name) });
      }
    }
  }
  return results;
}

module.exports = {
  sha256File,
  sha256Buffer,
  normalizeLegacyUrl,
  resolveLocalPathFromUrl,
  inferMimeFromName,
  storageKeyFromRelative,
  isSkippableUploadsDir,
  walkUploadsDir,
};
