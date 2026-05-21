const FileAsset = require('../models/fileAsset.model');
const fileAssetService = require('./fileAsset.service');

/**
 * Cursor-paginated file metadata (U41F) for large lists.
 */
async function listFileAssetsCursor({
  courseId,
  category,
  assignmentId,
  cursor,
  limit = 50,
  includeDeleted = false,
  userId,
} = {}) {
  const q = {};
  if (!includeDeleted) q.isDeleted = false;
  if (courseId) q.courseId = courseId;
  if (category) q.category = category;
  if (assignmentId) q.assignmentId = assignmentId;
  if (cursor) q._id = { $lt: cursor };

  const rows = await FileAsset.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select('originalName mimeType size category courseId assignmentId createdAt scanStatus isCurrentVersion metadata')
    .lean();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  const hydrated = items.map((row) => ({
    fileAssetId: String(row._id),
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    category: row.category,
    url: userId ? fileAssetService.buildDownloadPathForUser(row._id, userId) : fileAssetService.buildDownloadPath(row._id),
    createdAt: row.createdAt,
    scanStatus: row.scanStatus,
    previewStatus: row.metadata?.previewStatus,
  }));

  return { items: hydrated, nextCursor, hasMore };
}

async function batchMetadata(fileAssetIds, userId) {
  const assets = await FileAsset.find({ _id: { $in: fileAssetIds } })
    .select('originalName mimeType size category metadata.scanStatus metadata.previewStatus')
    .lean();
  return assets.map((a) => ({
    fileAssetId: String(a._id),
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    category: a.category,
    url: userId ? fileAssetService.buildDownloadPathForUser(a._id, userId) : fileAssetService.buildDownloadPath(a._id),
    scanStatus: a.scanStatus,
    previewStatus: a.metadata?.previewStatus,
    hasPreview: Boolean(a.metadata?.previewGeneratedAt),
  }));
}

module.exports = {
  listFileAssetsCursor,
  batchMetadata,
};
