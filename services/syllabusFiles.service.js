const mongoose = require('mongoose');
const FileAsset = require('../models/fileAsset.model');
const fileAssetService = require('./fileAsset.service');
const { assertCourseFilesMutable } = require('./fileLifecycle.service');

function extractFileAssetIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/api\/files\/([a-f0-9]{24})\//i);
  return m ? m[1] : null;
}

/**
 * Normalize legacy URL-only syllabus entries to canonical shape.
 */
function normalizeSyllabusEntry(entry, userId) {
  if (!entry) return null;
  const fileAssetId =
    entry.fileAssetId ||
    (typeof entry.fileAssetId === 'object' ? entry.fileAssetId?._id : null) ||
    extractFileAssetIdFromUrl(entry.url);
  const id = fileAssetId ? String(fileAssetId) : null;
  const url = id
    ? fileAssetService.buildDownloadPathForUser(id, userId)
    : entry.url || '';
  return {
    name: entry.name || entry.originalName || 'Syllabus file',
    url,
    size: entry.size || 0,
    fileAssetId: id,
    versionGroupId: entry.versionGroupId || null,
    order: entry.order ?? 0,
    uploadedAt: entry.uploadedAt || new Date(),
  };
}

async function serializeSyllabusFilesForClient(catalogFiles, userId) {
  const normalized = (catalogFiles || []).map((e) => normalizeSyllabusEntry(e, userId));
  const ids = normalized.map((n) => n.fileAssetId).filter(Boolean);
  if (!ids.length) return normalized;

  const assets = await FileAsset.find({ _id: { $in: ids }, isDeleted: false })
    .select('originalName size versionGroupId')
    .lean();
  const byId = new Map(assets.map((a) => [String(a._id), a]));

  return normalized.map((n) => {
    const asset = n.fileAssetId ? byId.get(n.fileAssetId) : null;
    if (!asset) return n;
    return {
      ...n,
      name: asset.originalName || n.name,
      size: asset.size ?? n.size,
      url: fileAssetService.buildDownloadPathForUser(asset._id, userId),
      versionGroupId: asset.versionGroupId || n.versionGroupId,
    };
  });
}

/**
 * Persist syllabus attachments via fileAssetIds (canonical).
 */
async function applySyllabusFileAssets(course, { fileAssetIds = [], removeFileAssetIds = [], user, audit = {} }) {
  if (!course) return course.catalog?.syllabusFiles || [];

  const courseId = course._id;
  if (fileAssetIds.length || removeFileAssetIds.length) {
    await assertCourseFilesMutable(course, user, { action: 'syllabus_attachment_update' });
  }

  let entries = [...(course.catalog?.syllabusFiles || [])];

  if (removeFileAssetIds.length) {
    const removeSet = new Set(removeFileAssetIds.map(String));
    for (const id of removeFileAssetIds) {
      await fileAssetService.deleteFileAsset(id, user, audit).catch(() => {});
    }
    entries = entries.filter((e) => !removeSet.has(String(e.fileAssetId || extractFileAssetIdFromUrl(e.url))));
  }

  if (fileAssetIds.length) {
    await fileAssetService.validateFileAssetIdsForAttach(fileAssetIds, {
      user,
      courseId,
      category: 'syllabus',
      ownerOnly: false,
    });
    await fileAssetService.attachFileAssets(fileAssetIds, {
      courseId,
      category: 'syllabus',
    });

    const assets = await FileAsset.find({ _id: { $in: fileAssetIds } }).lean();
    const existingIds = new Set(
      entries.map((e) => String(e.fileAssetId || extractFileAssetIdFromUrl(e.url) || '')).filter(Boolean)
    );

    let order = entries.length;
    for (const asset of assets) {
      const id = String(asset._id);
      if (existingIds.has(id)) continue;
      entries.push({
        name: asset.originalName,
        url: fileAssetService.buildDownloadPath(id),
        size: asset.size,
        fileAssetId: asset._id,
        versionGroupId: asset.versionGroupId || '',
        order: order++,
        uploadedAt: asset.createdAt || new Date(),
      });
      existingIds.add(id);
    }
  }

  entries.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!course.catalog) course.catalog = {};
  course.catalog.syllabusFiles = entries;
  course.markModified('catalog');
  return entries;
}

/**
 * Migrate URL-only syllabus entries to FileAsset references where URL maps to existing assets.
 */
async function migrateLegacySyllabusUrls({ dryRun = true, limit = 500 } = {}) {
  const Course = require('../models/course.model');
  const courses = await Course.find({ 'catalog.syllabusFiles.0': { $exists: true } }).limit(limit);
  const report = { scanned: 0, migrated: 0, unresolved: [], dryRun };

  for (const course of courses) {
    const files = course.catalog?.syllabusFiles || [];
    let changed = false;
    report.scanned += 1;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.fileAssetId) continue;
      const idFromUrl = extractFileAssetIdFromUrl(entry.url);
      if (!idFromUrl) {
        report.unresolved.push({ courseId: String(course._id), url: entry.url, name: entry.name });
        continue;
      }
      const asset = await FileAsset.findById(idFromUrl).lean();
      if (!asset) {
        report.unresolved.push({ courseId: String(course._id), fileAssetId: idFromUrl, reason: 'asset_missing' });
        continue;
      }
      if (!dryRun) {
        entry.fileAssetId = asset._id;
        entry.versionGroupId = asset.versionGroupId || '';
        entry.url = fileAssetService.buildDownloadPath(asset._id);
        entry.name = entry.name || asset.originalName;
        entry.size = entry.size || asset.size;
        entry.order = entry.order ?? i;
        if (!asset.courseId) {
          await FileAsset.updateOne({ _id: asset._id }, { $set: { courseId: course._id, category: 'syllabus' } });
        }
        changed = true;
        report.migrated += 1;
      } else {
        report.migrated += 1;
      }
    }
    if (changed && !dryRun) {
      course.markModified('catalog');
      await course.save();
    }
  }
  return report;
}

module.exports = {
  extractFileAssetIdFromUrl,
  normalizeSyllabusEntry,
  serializeSyllabusFilesForClient,
  applySyllabusFileAssets,
  migrateLegacySyllabusUrls,
};
