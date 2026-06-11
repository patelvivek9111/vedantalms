const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const PreviewManifest = require('../models/previewManifest.model');
const academicAuditService = require('./academicAudit.service');
const { readStoredContent } = require('./fileStorage.service');
const previewStorage = require('./previewStorage.service');

const PREVIEW_DIR = previewStorage.PREVIEW_DIR;

function ensurePreviewDir() {
  previewStorage.ensurePreviewDir();
}

function detectPreviewKind(mime, name) {
  const m = mime || '';
  const ext = path.extname(name || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.includes('text') || ext === '.txt' || ext === '.md' || ext === '.json') return 'text';
  if (/\.(docx|pptx|xlsx|doc|ppt|xls)$/i.test(ext)) return 'office';
  return 'unsupported';
}

/** .docx is rendered in the browser (docx-preview); skip server text extraction. */
function isClientRenderedDocx(mime, name) {
  const ext = path.extname(name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    ext === '.docx' ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

async function upsertManifest(fileAssetId, patch) {
  return PreviewManifest.findOneAndUpdate(
    { fileAssetId },
    { $set: { fileAssetId, ...patch } },
    { upsert: true, new: true }
  );
}

/**
 * Async preview generation (U38F) — never blocks downloads on failure.
 */
function tryGeneratePdfThumbnail(buf, assetId) {
  try {
    const sharp = require('sharp');
    return sharp(buf, { density: 72 }).resize(320, 420, { fit: 'inside' }).png().toBuffer();
  } catch {
    return null;
  }
}

async function extractOfficeMetadata(buf, ext) {
  const meta = {};
  const str = buf.toString('binary');
  if (ext === '.pptx') {
    const slides = (str.match(/ppt\/slides\/slide/g) || []).length;
    if (slides) meta.slideCount = slides;
  }
  if (ext === '.xlsx') {
    const sheets = (str.match(/xl\/worksheets\/sheet/g) || []).length;
    if (sheets) meta.sheetCount = sheets;
  }
  return meta;
}

const MAX_PREVIEW_REGEN = 5;

async function invalidatePreviewCache(fileAssetId) {
  return previewStorage.invalidatePreviewCache(fileAssetId);
}

function tryVideoPosterFrame(buf, assetId, ext) {
  try {
    const { execSync } = require('child_process');
    const tmpIn = path.join(PREVIEW_DIR, `${assetId}-video-src${ext || '.mp4'}`);
    const tmpOut = path.join(PREVIEW_DIR, `${assetId}-poster.jpg`);
    fs.writeFileSync(tmpIn, buf);
    execSync(
      `ffmpeg -y -i "${tmpIn}" -ss 00:00:01 -vframes 1 -q:v 2 "${tmpOut}"`,
      { stdio: 'ignore', timeout: 15000 }
    );
    if (fs.existsSync(tmpOut)) {
      fs.unlinkSync(tmpIn);
      return tmpOut;
    }
  } catch {
    return null;
  }
  return null;
}

function detectPreviewCorruption(buf, asset) {
  if (!buf?.length) return true;
  if (asset.checksumSha256 && Buffer.isBuffer(buf)) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    if (hash !== asset.checksumSha256) return true;
  }
  return false;
}

async function processPreviewJob(fileAssetId, options = {}) {
  ensurePreviewDir();
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset) {
    const err = new Error('File asset not found');
    err.statusCode = 404;
    throw err;
  }

  const existing = await PreviewManifest.findOne({ fileAssetId });
  const regenAttempts = (existing?.previewRegenerationAttempts || 0) + (options.regenerate ? 1 : 0);
  if (options.regenerate) await invalidatePreviewCache(fileAssetId);
  if (regenAttempts > MAX_PREVIEW_REGEN) {
    await upsertManifest(fileAssetId, {
      status: 'failed',
      error: 'max_regeneration_attempts',
      previewRegenerationAttempts: regenAttempts,
    });
    return { fileAssetId: String(fileAssetId), status: 'failed', error: 'max_regeneration_attempts' };
  }

  await upsertManifest(fileAssetId, {
    status: 'processing',
    mimeType: asset.mimeType,
    previewRegenerationAttempts: regenAttempts,
  });
  const kind = detectPreviewKind(asset.mimeType, asset.originalName);
  const out = { fileAssetId: String(asset._id), previewKind: kind, status: 'ready', previews: {} };
  let officeMetadata = {};
  let waveformMetadata = {};
  let previewCorrupted = false;
  const clientDocx =
    kind === 'office' && isClientRenderedDocx(asset.mimeType, asset.originalName);

  try {
    let buf = null;
    if (!clientDocx) {
      buf = await readStoredContent(asset);
      previewCorrupted = detectPreviewCorruption(buf, asset);
    }

    if (kind === 'image') {
      const thumbRef = await previewStorage.storePreviewArtifact({
        assetId: asset._id,
        suffix: 'thumb',
        buffer: buf,
        resourceType: 'image',
      });
      out.previews.thumbnail = thumbRef;
      out.previews.optimized = thumbRef;
    } else if (kind === 'pdf') {
      const pdfRef = await previewStorage.storePreviewArtifact({
        assetId: asset._id,
        suffix: 'preview',
        buffer: buf,
        resourceType: 'raw',
      });
      out.previews.pdf = pdfRef;
      const thumbBuf = tryGeneratePdfThumbnail(buf, asset._id);
      if (thumbBuf) {
        const thumbRef = await previewStorage.storePreviewArtifact({
          assetId: asset._id,
          suffix: 'pdf-thumb',
          buffer: thumbBuf,
          resourceType: 'image',
        });
        out.previews.thumbnail = thumbRef;
      } else {
        out.previews.thumbnail = pdfRef;
      }
    } else if (kind === 'video') {
      const ext = path.extname(asset.originalName || '') || '.mp4';
      const posterPath = tryVideoPosterFrame(buf, asset._id, ext);
      if (posterPath) {
        const posterBuf = fs.readFileSync(posterPath);
        const posterRef = await previewStorage.storePreviewArtifact({
          assetId: asset._id,
          suffix: 'poster',
          buffer: posterBuf,
          resourceType: 'image',
        });
        out.previews.poster = posterRef;
        out.previews.thumbnail = posterRef;
        if (!previewStorage.useCloudPreviewStorage()) {
          try {
            fs.unlinkSync(posterPath);
          } catch {
            /* ignore */
          }
        }
      } else {
        const posterMetaRef = await previewStorage.storePreviewJson({
          assetId: asset._id,
          suffix: 'video-meta',
          data: { durationSec: Math.max(1, Math.round(buf.length / 50000)), posterAvailable: false, note: 'metadata_only' },
        });
        out.previews.poster = posterMetaRef;
      }
    } else if (kind === 'audio') {
      waveformMetadata = { durationSec: Math.max(1, Math.round(buf.length / 16000)), sampleCount: 64 };
      const waveRef = await previewStorage.storePreviewJson({
        assetId: asset._id,
        suffix: 'waveform',
        data: waveformMetadata,
      });
      out.previews.waveform = waveRef;
    } else if (kind === 'text') {
      const textRef = await previewStorage.storePreviewText({
        assetId: asset._id,
        suffix: 'preview',
        text: buf.slice(0, 100000).toString('utf8'),
      });
      out.previews.text = textRef;
    } else if (kind === 'office') {
      const ext = path.extname(asset.originalName || '').toLowerCase();
      if (clientDocx) {
        officeMetadata = { clientRendered: true };
      } else {
        officeMetadata = await extractOfficeMetadata(buf, ext);
        if (ext === '.pptx' || ext === '.xlsx') {
          const textRef = await previewStorage.storePreviewText({
            assetId: asset._id,
            suffix: 'office',
            text: `[${ext} metadata preview]`.slice(0, 50000),
          });
          out.previews.text = textRef;
        } else {
          out.status = 'unsupported';
        }
      }
    } else {
      out.status = 'unsupported';
    }

    if (previewCorrupted) out.status = 'failed';

    const now = new Date();
    const manifestPatch = {
      status: out.status,
      previewKind: kind,
      thumbnailPath: out.previews.thumbnail,
      previewPath: out.previews.pdf || out.previews.text,
      posterPath: typeof out.previews.poster === 'string' ? out.previews.poster : undefined,
      generatedAt: now,
      previewLastGeneratedAt: now,
      previewCorrupted,
      previewRegenerationAttempts: regenAttempts,
      officeMetadata: Object.keys(officeMetadata).length ? officeMetadata : undefined,
      clientRendered: clientDocx || undefined,
      waveformMetadata: Object.keys(waveformMetadata).length ? waveformMetadata : undefined,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      error: previewCorrupted ? 'checksum_mismatch' : undefined,
    };
    await upsertManifest(fileAssetId, manifestPatch);

    asset.metadata = {
      ...(asset.metadata || {}),
      previews: out.previews,
      previewGeneratedAt: new Date().toISOString(),
      previewStatus: out.status,
    };
    await asset.save();

    await academicAuditService.recordAuditEvent({
      actorId: options.actorId,
      entityType: 'file_asset',
      entityId: fileAssetId,
      action: 'file_preview_generated',
      metadata: { kind, status: out.status },
    }).catch(() => {});
  } catch (err) {
    out.status = 'failed';
    out.error = err.message;
    await upsertManifest(fileAssetId, { status: 'failed', error: err.message });
    await academicAuditService.recordAuditEvent({
      actorId: options.actorId,
      entityType: 'file_asset',
      entityId: fileAssetId,
      action: 'file_preview_job_failed',
      severity: 'warning',
      metadata: { error: err.message },
    }).catch(() => {});
  }

  return out;
}

async function getPreviewManifest(fileAssetId) {
  return PreviewManifest.findOne({ fileAssetId }).lean();
}

function resolveSecurePreviewPath(manifest, kind = 'thumbnail') {
  const ref = previewStorage.resolveSecurePreviewRef(manifest, kind);
  return ref?.type === 'local' ? ref.path : null;
}

function resolveSecurePreviewRef(manifest, kind = 'thumbnail') {
  return previewStorage.resolveSecurePreviewRef(manifest, kind);
}

function queuePreviewGeneration(fileAssetId, user) {
  const { enqueueJob } = require('./jobQueue.service');
  return enqueueJob('files.preview', { fileAssetIds: [fileAssetId] }, user);
}

function queuePreviewRegeneration(fileAssetId, user) {
  const { enqueueJob } = require('./jobQueue.service');
  return enqueueJob('files.preview', { fileAssetIds: [fileAssetId], regenerate: true }, user);
}

module.exports = {
  processPreviewJob,
  getPreviewManifest,
  resolveSecurePreviewPath,
  resolveSecurePreviewRef,
  queuePreviewGeneration,
  queuePreviewRegeneration,
  detectPreviewKind,
  isClientRenderedDocx,
  PREVIEW_DIR,
};
