const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FileAsset = require('../models/fileAsset.model');
const academicAuditService = require('./academicAudit.service');
const fileAccessService = require('./fileAccess.service');
const { paths, isPathInside } = require('../config/paths');
const { createReadStreamForAsset } = require('./fileStorage.service');
const { isCourseGradingStaff, ADMIN_ROLES } = require('../middleware/academicPermissions');

const ZIP_DIR = path.join(paths.uploads, 'exports', 'zip');
const ZIP_RETENTION_HOURS = parseInt(process.env.ZIP_RETENTION_HOURS || '72', 10);

function normalizeZipName(name, fileAssetId) {
  const base = (name || 'file').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 180);
  return `${fileAssetId}-${base}`;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Resolve file IDs for scope with FERPA-aware filters.
 */
async function resolveScopeFileIds(scope, user) {
  const q = { isDeleted: false, scanStatus: { $ne: 'unsafe' } };
  if (scope.courseId) q.courseId = scope.courseId;
  if (scope.assignmentId) q.assignmentId = scope.assignmentId;
  if (scope.category) q.category = scope.category;
  if (scope.submissionIds?.length) q.submissionId = { $in: scope.submissionIds };
  if (scope.fileAssetIds?.length) q._id = { $in: scope.fileAssetIds };

  const assets = await FileAsset.find(q).select('_id courseId category uploadedBy').lean();
  const Course = require('../models/course.model');
  const allowed = [];
  for (const asset of assets) {
    if (ADMIN_ROLES.has(user.role)) {
      allowed.push(asset._id);
      continue;
    }
    if (scope.courseId) {
      const course = await Course.findById(scope.courseId).lean();
      if (course && isCourseGradingStaff(user, course)) {
        allowed.push(asset._id);
        continue;
      }
    }
    if (String(asset.uploadedBy) === String(user._id)) allowed.push(asset._id);
  }
  return allowed.map(String);
}

/**
 * Build ZIP on disk (streaming copy into store entries via archiver when available).
 */
async function buildZipArchive({ fileAssetIds, label, user, audit = {} }) {
  if (!fs.existsSync(ZIP_DIR)) fs.mkdirSync(ZIP_DIR, { recursive: true });
  const zipId = `zip-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const zipPath = path.join(ZIP_DIR, `${zipId}.zip`);
  const manifestEntries = [];

  let ZipArchive;
  try {
    ({ ZipArchive } = require('archiver'));
  } catch {
    return buildZipArchiveFolder({ fileAssetIds, label, user, audit });
  }
  if (!ZipArchive) {
    return buildZipArchiveFolder({ fileAssetIds, label, user, audit });
  }

  const assets = await FileAsset.find({ _id: { $in: fileAssetIds }, isDeleted: false });
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const asset of assets) {
      const stream = createReadStreamForAsset(asset);
      const entryName = normalizeZipName(asset.originalName, asset._id);
      if (!stream) {
        manifestEntries.push({ fileAssetId: String(asset._id), name: entryName, included: false });
        continue;
      }
      archive.append(stream, { name: entryName });
      manifestEntries.push({
        fileAssetId: String(asset._id),
        name: entryName,
        included: true,
        checksumSha256: asset.checksumSha256 || '',
      });
    }
    const manifestBody = {
      generatedAt: new Date().toISOString(),
      label,
      entries: manifestEntries,
    };
    archive.append(JSON.stringify(manifestBody, null, 2), { name: 'MANIFEST.json' });
    archive.finalize();
  });

  const zipChecksum = sha256File(zipPath);
  const { token, expiresAt } = fileAccessService.createFileDownloadToken(zipId, user._id, {
    ttlSeconds: ZIP_RETENTION_HOURS * 3600,
  });

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: 'bulk_zip',
    action: 'file_bulk_zip_created',
    metadata: { zipPath, count: manifestEntries.filter((e) => e.included).length, label },
    ip: audit.ip,
  }).catch(() => {});

  return {
    zipId,
    zipPath,
    zipChecksum,
    downloadToken: token,
    expiresAt,
    downloadUrl: `/api/files/zip/${zipId}/download?token=${encodeURIComponent(token)}`,
    manifest: manifestEntries,
    fileCount: manifestEntries.filter((e) => e.included).length,
  };
}

/** Fallback folder bundle when archiver not installed */
async function buildZipArchiveFolder({ fileAssetIds, label, user, audit }) {
  const bundleId = `zip-folder-${Date.now()}`;
  const bundleDir = path.join(ZIP_DIR, bundleId);
  fs.mkdirSync(bundleDir, { recursive: true });
  const assets = await FileAsset.find({ _id: { $in: fileAssetIds }, isDeleted: false });
  const manifestEntries = [];
  for (const asset of assets) {
    const stream = createReadStreamForAsset(asset);
    const name = normalizeZipName(asset.originalName, asset._id);
    if (!stream) {
      manifestEntries.push({ fileAssetId: String(asset._id), name, included: false });
      continue;
    }
    fs.copyFileSync(stream.path, path.join(bundleDir, name));
    manifestEntries.push({ fileAssetId: String(asset._id), name, included: true });
  }
  fs.writeFileSync(
    path.join(bundleDir, 'MANIFEST.json'),
    JSON.stringify({ label, entries: manifestEntries }, null, 2)
  );
  return { bundleDir, manifest: manifestEntries, format: 'folder' };
}

async function createScopeZipJob(scope, user, { label } = {}) {
  const fileAssetIds = await resolveScopeFileIds(scope, user);
  if (!fileAssetIds.length) {
    return {
      job: {
        status: 'completed',
        type: 'files.bulk.download',
        result: { empty: true, fileCount: 0, label: label || scope.type || 'bulk' },
      },
      async: false,
    };
  }
  const { enqueueJob } = require('./jobQueue.service');
  return enqueueJob(
    'files.bulk.download',
    { scope, label: label || scope.type || 'bulk', fileAssetIds },
    user
  );
}

async function purgeExpiredZips({ dryRun = true } = {}) {
  if (!fs.existsSync(ZIP_DIR)) return { purged: 0 };
  const cutoff = Date.now() - ZIP_RETENTION_HOURS * 3600 * 1000;
  let purged = 0;
  for (const name of fs.readdirSync(ZIP_DIR)) {
    const full = path.join(ZIP_DIR, name);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      if (!dryRun) {
        if (stat.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
        else fs.unlinkSync(full);
        purged += 1;
      } else purged += 1;
    }
  }
  return { purged, dryRun, retentionHours: ZIP_RETENTION_HOURS };
}

module.exports = {
  ZIP_DIR,
  resolveScopeFileIds,
  buildZipArchive,
  createScopeZipJob,
  purgeExpiredZips,
  normalizeZipName,
};
