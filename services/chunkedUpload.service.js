const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { paths } = require('../config/paths');
const fileAssetService = require('./fileAsset.service');
const fileQuotaService = require('./fileQuota.service');
const { loadUploadSettings, resolveUploadMimeType } = require('../utils/fileSettings');

const CHUNK_DIR = path.join(paths.uploads, '_chunks');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const sessions = new Map();

function ensureChunkDir() {
  if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true });
}

function sessionPath(uploadId) {
  return path.join(CHUNK_DIR, uploadId);
}

function metaFilePath(uploadId) {
  return path.join(sessionPath(uploadId), 'session.meta.json');
}

function sha256Buffer(buf) {
  if (!Buffer.isBuffer(buf)) {
    const err = new Error('Invalid chunk payload (expected binary data)');
    err.statusCode = 400;
    throw err;
  }
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function normalizeChunkBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (Array.isArray(body)) return Buffer.from(body);
  const err = new Error('Invalid chunk payload (expected binary data)');
  err.statusCode = 400;
  throw err;
}

function receivedChunkCount(meta) {
  if (meta.received instanceof Set) return meta.received.size;
  if (Array.isArray(meta.received)) return meta.received.length;
  return 0;
}

function persistSessionMeta(uploadId, meta) {
  const fp = metaFilePath(uploadId);
  const payload = {
    userId: meta.userId,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    mimeType: meta.mimeType,
    totalChunks: meta.totalChunks,
    category: meta.category,
    courseId: meta.courseId,
    assignmentId: meta.assignmentId,
    received: [...meta.received],
    chunkHashes: meta.chunkHashes || {},
    createdAt: meta.createdAt,
  };
  fs.writeFileSync(fp, JSON.stringify(payload));
}

function hydrateSessionsFromDisk() {
  ensureChunkDir();
  for (const name of fs.readdirSync(CHUNK_DIR)) {
    const dir = path.join(CHUNK_DIR, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, 'session.meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (Date.now() - raw.createdAt > SESSION_TTL_MS) continue;
      sessions.set(name, {
        ...raw,
        received: new Set(raw.received || []),
      });
    } catch {
      /* skip corrupt */
    }
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, meta] of sessions.entries()) {
    if (now - meta.createdAt > SESSION_TTL_MS) {
      const dir = sessionPath(id);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      sessions.delete(id);
    }
  }
  if (!fs.existsSync(CHUNK_DIR)) return;
  for (const name of fs.readdirSync(CHUNK_DIR)) {
    const metaPath = path.join(CHUNK_DIR, name, 'session.meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (now - raw.createdAt > SESSION_TTL_MS) {
        fs.rmSync(path.join(CHUNK_DIR, name), { recursive: true, force: true });
        sessions.delete(name);
      }
    } catch {
      /* ignore */
    }
  }
}

hydrateSessionsFromDisk();

async function initSession({ userId, fileName, fileSize, mimeType, totalChunks, category, courseId, assignmentId }) {
  ensureChunkDir();
  cleanupExpiredSessions();
  const settings = await loadUploadSettings();
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) {
    const err = new Error('Invalid file size');
    err.statusCode = 400;
    throw err;
  }
  if (size > settings.maxFileSizeBytes) {
    const maxMb = Math.round(settings.maxFileSizeBytes / (1024 * 1024));
    const err = new Error(`File exceeds maximum size (${maxMb} MB). Increase the limit in Admin → System Settings.`);
    err.statusCode = 400;
    throw err;
  }
  const resolvedMime = resolveUploadMimeType(fileName, mimeType);
  if (resolvedMime && !settings.allowedMimeTypes.includes(resolvedMime)) {
    const err = new Error(
      `File type is not allowed (${resolvedMime}). Add mp4/mov under allowed file types in Admin → System Settings.`
    );
    err.statusCode = 400;
    throw err;
  }
  const uploadId = crypto.randomBytes(16).toString('hex');
  const dir = sessionPath(uploadId);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    userId: String(userId),
    fileName,
    fileSize: size,
    mimeType: resolvedMime,
    totalChunks: Number(totalChunks),
    category: category || 'temporary',
    courseId: courseId || null,
    assignmentId: assignmentId || null,
    received: new Set(),
    chunkHashes: {},
    createdAt: Date.now(),
  };
  sessions.set(uploadId, meta);
  persistSessionMeta(uploadId, meta);
  return { uploadId, chunkSize: DEFAULT_CHUNK_SIZE };
}

function saveChunk(uploadId, chunkIndex, buffer) {
  const chunkBuf = normalizeChunkBuffer(buffer);
  let meta = sessions.get(uploadId);
  if (!meta && fs.existsSync(metaFilePath(uploadId))) {
    hydrateSessionsFromDisk();
    meta = sessions.get(uploadId);
  }
  if (!meta) {
    const err = new Error('Upload session not found or expired');
    err.statusCode = 404;
    throw err;
  }
  const dir = sessionPath(uploadId);
  const chunkPath = path.join(dir, `part-${chunkIndex}`);
  const hash = sha256Buffer(chunkBuf);

  if (fs.existsSync(chunkPath)) {
    const existing = fs.readFileSync(chunkPath);
    const existingHash = sha256Buffer(existing);
    if (existingHash === hash) {
      meta.received.add(Number(chunkIndex));
      meta.chunkHashes[chunkIndex] = hash;
      persistSessionMeta(uploadId, meta);
      return { received: receivedChunkCount(meta), total: meta.totalChunks, duplicate: true };
    }
    const err = new Error('Chunk hash mismatch — corrupted or duplicate upload');
    err.statusCode = 409;
    throw err;
  }

  fs.writeFileSync(chunkPath, chunkBuf);
  meta.received.add(Number(chunkIndex));
  meta.chunkHashes[chunkIndex] = hash;
  persistSessionMeta(uploadId, meta);
  return { received: receivedChunkCount(meta), total: meta.totalChunks };
}

async function completeSession(uploadId, user, audit = {}) {
  let meta = sessions.get(uploadId);
  if (!meta) {
    hydrateSessionsFromDisk();
    meta = sessions.get(uploadId);
  }
  if (!meta) {
    const err = new Error('Upload session not found or expired');
    err.statusCode = 404;
    throw err;
  }
  if (receivedChunkCount(meta) !== meta.totalChunks) {
    const err = new Error('Not all chunks received');
    err.statusCode = 400;
    throw err;
  }
  if (String(user._id) !== meta.userId) {
    const err = new Error('Upload session does not belong to user');
    err.statusCode = 403;
    throw err;
  }

  await fileQuotaService.assertUploadWithinQuota({
    user,
    courseId: meta.courseId,
    additionalBytes: meta.fileSize,
    audit,
  });

  const dir = sessionPath(uploadId);
  const assembled = path.join(dir, 'assembled');
  const writeStream = fs.createWriteStream(assembled);
  try {
    for (let i = 0; i < meta.totalChunks; i += 1) {
      const partPath = path.join(dir, `part-${i}`);
      if (!fs.existsSync(partPath)) {
        const err = new Error(`Missing chunk ${i}`);
        err.statusCode = 400;
        throw err;
      }
      await pipeline(fs.createReadStream(partPath), writeStream, { end: false });
    }
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  } catch (err) {
    writeStream.destroy();
    throw err;
  }

  const stat = fs.statSync(assembled);
  if (stat.size !== meta.fileSize) {
    const err = new Error(`Assembled size ${stat.size} does not match expected ${meta.fileSize}`);
    err.statusCode = 400;
    throw err;
  }

  const buffer = fs.readFileSync(assembled);
  const file = {
    originalname: meta.fileName,
    mimetype: meta.mimeType,
    size: buffer.length,
    buffer,
  };

  const asset = await fileAssetService.createFileAsset({
    file,
    uploadedBy: user,
    category: meta.category,
    courseId: meta.courseId,
    assignmentId: meta.assignmentId,
    metadata: { uploadId, chunked: true, ...audit },
    skipLifecycleCheck: meta.category === 'temporary',
  });

  fs.rmSync(dir, { recursive: true, force: true });
  sessions.delete(uploadId);

  return asset;
}

function getSessionStatus(uploadId) {
  let meta = sessions.get(uploadId);
  if (!meta) {
    hydrateSessionsFromDisk();
    meta = sessions.get(uploadId);
  }
  if (!meta) return null;
  return {
    uploadId,
    received: [...meta.received].sort((a, b) => a - b),
    totalChunks: meta.totalChunks,
    complete: meta.received.size === meta.totalChunks,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    expired: Date.now() - meta.createdAt > SESSION_TTL_MS,
  };
}

function listActiveSessions() {
  cleanupExpiredSessions();
  hydrateSessionsFromDisk();
  return [...sessions.entries()].map(([uploadId, meta]) => ({
    uploadId,
    fileName: meta.fileName,
    received: meta.received.size,
    totalChunks: meta.totalChunks,
    createdAt: meta.createdAt,
    ageMs: Date.now() - meta.createdAt,
  }));
}

module.exports = {
  initSession,
  saveChunk,
  completeSession,
  getSessionStatus,
  listActiveSessions,
  cleanupExpiredSessions,
  CHUNK_DIR,
  DEFAULT_CHUNK_SIZE,
  SESSION_TTL_MS,
};
