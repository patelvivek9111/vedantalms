const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Page = require('../models/page.model');
const Announcement = require('../models/announcement.model');
const User = require('../models/user.model');
const { paths } = require('../config/paths');
const { walkUploadsDir, resolveLocalPathFromUrl, normalizeLegacyUrl } = require('../utils/fileBlobUtils');
const { isCourseFinalized } = require('./fileGovernance.service');
const { writeReport } = require('../utils/fileReports');

const PROTECTED_CATEGORIES = new Set(['grade-export', 'transcript']);

async function collectReferencedAssetIds() {
  const refs = new Set();
  const [assignments, submissions, pages, announcements, users] = await Promise.all([
    Assignment.find({ fileAssets: { $exists: true, $ne: [] } }).select('fileAssets attachments').lean(),
    Submission.find({ fileAssets: { $exists: true, $ne: [] } }).select('fileAssets files').lean(),
    Page.find({ fileAssets: { $exists: true, $ne: [] } }).select('fileAssets attachments').lean(),
    Announcement.find({ fileAssets: { $exists: true, $ne: [] } }).select('fileAssets attachments').lean(),
    User.find({ profilePicture: /\/api\/files\// }).select('profilePicture').lean(),
  ]);

  const addIds = (ids) => ids?.forEach((id) => refs.add(String(id)));
  assignments.forEach((a) => addIds(a.fileAssets));
  submissions.forEach((s) => addIds(s.fileAssets));
  pages.forEach((p) => addIds(p.fileAssets));
  announcements.forEach((a) => addIds(a.fileAssets));

  for (const u of users) {
    const m = String(u.profilePicture || '').match(/\/api\/files\/([a-f0-9]{24})/i);
    if (m) refs.add(m[1]);
  }

  return refs;
}

async function detectOrphans(options = {}) {
  const referenced = await collectReferencedAssetIds();
  const assets = await FileAsset.find({ isDeleted: false, cleanupState: { $ne: 'HARD_DELETED' } }).lean();

  const unattachedStaged = [];
  const missingBlobs = [];
  const missingDbRefs = [];
  const protectedOrphans = [];
  const duplicateChecksums = new Map();
  const diskFiles = walkUploadsDir();
  const diskByKey = new Map(diskFiles.map((f) => [f.relativePath, f.absolutePath]));
  const registeredKeys = new Set();

  for (const asset of assets) {
    registeredKeys.add(asset.storageKey);
    if (asset.checksumSha256) {
      const list = duplicateChecksums.get(asset.checksumSha256) || [];
      list.push(String(asset._id));
      duplicateChecksums.set(asset.checksumSha256, list);
    }

    if (PROTECTED_CATEGORIES.has(asset.category) || asset.lifecycleLocked) {
      continue;
    }

    if (asset.category === 'temporary' && !referenced.has(String(asset._id))) {
      unattachedStaged.push(asset);
    }

    if (asset.category === 'submission' && asset.isCurrentVersion === false) {
      unattachedStaged.push({ ...asset, reason: 'superseded_submission_version' });
    }

    if (asset.provider === 'local' || !asset.metadata?.providerUrl) {
      const local = resolveLocalPathFromUrl(asset.path) || path.join(paths.uploads, asset.storageKey);
      if (!fs.existsSync(local)) {
        missingBlobs.push({ fileAssetId: String(asset._id), storageKey: asset.storageKey });
      }
    }

    if (asset.courseId && (await isCourseFinalized(asset.courseId))) {
      if (!referenced.has(String(asset._id)) && asset.category !== 'temporary') {
        protectedOrphans.push({ fileAssetId: String(asset._id), reason: 'finalized_course' });
      }
    }
  }

  for (const disk of diskFiles) {
    const hasAsset = assets.some(
      (a) => a.storageKey === disk.relativePath || a.path === `/uploads/${disk.relativePath}`
    );
    if (!hasAsset) {
      missingDbRefs.push({ relativePath: disk.relativePath, absolutePath: disk.absolutePath });
    }
  }

  const duplicateGroups = [...duplicateChecksums.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([checksum, ids]) => ({ checksum, fileAssetIds: ids }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAssets: assets.length,
      referencedCount: referenced.size,
      unattachedStaged: unattachedStaged.length,
      missingBlobs: missingBlobs.length,
      missingDbRefs: missingDbRefs.length,
      protectedOrphans: protectedOrphans.length,
      duplicateChecksumGroups: duplicateGroups.length,
    },
    unattachedStaged: unattachedStaged.map((a) => ({
      fileAssetId: String(a._id),
      category: a.category,
      storageKey: a.storageKey,
      reason: a.reason,
    })),
    missingBlobs,
    missingDbRefs: missingDbRefs.slice(0, options.limit || 500),
    protectedOrphans,
    duplicateChecksumGroups: duplicateGroups,
  };
}

async function markOrphanCandidates(report, { dryRun = true } = {}) {
  const ids = report.unattachedStaged
    .filter((r) => !report.protectedOrphans.some((p) => p.fileAssetId === r.fileAssetId))
    .map((r) => r.fileAssetId);

  if (dryRun) {
    return { wouldMark: ids.length, ids };
  }

  const result = await FileAsset.updateMany(
    { _id: { $in: ids }, cleanupState: 'ACTIVE', lifecycleLocked: false },
    { $set: { cleanupState: 'ORPHAN_CANDIDATE' } }
  );
  return { marked: result.modifiedCount || 0, ids };
}

async function advanceCleanup({ dryRun = true, toState = 'PENDING_DELETE' } = {}) {
  const candidates = await FileAsset.find({
    cleanupState: 'ORPHAN_CANDIDATE',
    lifecycleLocked: false,
    category: { $nin: [...PROTECTED_CATEGORIES] },
  }).lean();

  const safe = [];
  for (const asset of candidates) {
    if (asset.courseId && (await isCourseFinalized(asset.courseId))) continue;
    safe.push(asset._id);
  }

  if (dryRun) return { wouldAdvance: safe.length };

  const result = await FileAsset.updateMany(
    { _id: { $in: safe } },
    { $set: { cleanupState: toState } }
  );
  return { advanced: result.modifiedCount || 0 };
}

async function runOrphanVerification(options = {}) {
  const report = await detectOrphans(options);
  const pathWritten = writeReport('file-orphan-report.json', report);
  return { report, reportPath: pathWritten };
}

async function runOrphanCleanup(options = {}) {
  const { dryRun = true } = options;
  const { report } = await runOrphanVerification(options);
  const mark = await markOrphanCandidates(report, { dryRun });
  const advance = await advanceCleanup({ dryRun });
  const payload = {
    dryRun,
    mark,
    advance,
    note: dryRun
      ? 'No deletions performed. Re-run with --apply to advance cleanup state only (no hard deletes).'
      : 'Cleanup states advanced; HARD_DELETED requires separate explicit policy.',
  };
  writeReport('file-orphan-cleanup-result.json', payload);
  return payload;
}

module.exports = {
  detectOrphans,
  markOrphanCandidates,
  advanceCleanup,
  runOrphanVerification,
  runOrphanCleanup,
};
