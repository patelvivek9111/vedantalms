const mongoose = require('mongoose');
const fileAssetService = require('./fileAsset.service');

const FILE_ASSET_URL_RE = /\/api\/files\/([a-f0-9]{24})/i;

function normalizeObjectIdList(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    if (value == null) continue;
    const str = String(value).trim();
    if (mongoose.Types.ObjectId.isValid(str)) {
      unique.add(str);
    }
  }
  return [...unique];
}

function extractFileAssetIdFromLegacyUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (mongoose.Types.ObjectId.isValid(url)) return url;
  const match = url.match(FILE_ASSET_URL_RE);
  return match ? match[1] : null;
}

function parseLegacyAttachmentUrls(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());
}

/**
 * Resolve inbox attachments: prefer fileAssetIds; legacy URL strings optional.
 */
async function resolveMessageAttachments({
  user,
  courseId,
  fileAssetIds,
  legacyAttachments,
}) {
  const ids = normalizeObjectIdList(fileAssetIds);

  // Allow legacy URL arrays to supply file asset IDs when clients send download paths
  for (const url of parseLegacyAttachmentUrls(legacyAttachments)) {
    const extracted = extractFileAssetIdFromLegacyUrl(url);
    if (extracted) ids.push(extracted);
  }

  const uniqueIds = [...new Set(ids)];
  let validatedAssets = [];

  if (uniqueIds.length) {
    validatedAssets = await fileAssetService.validateFileAssetIdsForAttach(uniqueIds, {
      user,
      courseId: courseId || undefined,
      category: 'message',
      ownerOnly: true,
    });

    const patch = { category: 'message' };
    if (courseId) patch.courseId = courseId;
    await fileAssetService.attachFileAssets(
      validatedAssets.map((a) => a._id),
      patch
    );
  }

  const legacyUrls = parseLegacyAttachmentUrls(legacyAttachments).filter(
    (url) => !extractFileAssetIdFromLegacyUrl(url)
  );

  if (legacyUrls.length && process.env.INBOX_REJECT_LEGACY_ATTACHMENTS === 'true') {
    const err = new Error(
      'Legacy attachment URLs are not allowed. Upload files through the file platform.'
    );
    err.statusCode = 400;
    err.code = 'LEGACY_ATTACHMENTS_REJECTED';
    throw err;
  }

  return {
    fileAssetIds: validatedAssets.map((a) => a._id),
    attachments: legacyUrls,
  };
}

function assertAttachmentInputs({ attachments, fileAssetIds }) {
  if (attachments !== undefined && !Array.isArray(attachments)) {
    const err = new Error('Attachments must be an array');
    err.statusCode = 400;
    throw err;
  }
  if (fileAssetIds !== undefined && !Array.isArray(fileAssetIds)) {
    const err = new Error('fileAssetIds must be an array');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  resolveMessageAttachments,
  assertAttachmentInputs,
  normalizeObjectIdList,
  extractFileAssetIdFromLegacyUrl,
};
