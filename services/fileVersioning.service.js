const crypto = require('crypto');
const FileAsset = require('../models/fileAsset.model');
const { recordFileReplacement } = require('./fileGovernance.service');

function newVersionGroupId() {
  return `vg_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Mark prior submission/assignment file versions superseded; attach new current versions.
 */
async function supersedeFileAssets({
  previousAssetIds = [],
  newAssetIds = [],
  patch = {},
  audit = {},
}) {
  if (!newAssetIds.length) return { superseded: [], current: [] };

  const previous = previousAssetIds.length
    ? await FileAsset.find({ _id: { $in: previousAssetIds } })
    : [];

  let versionGroupId = previous[0]?.versionGroupId;
  if (!versionGroupId) {
    versionGroupId = newVersionGroupId();
  }

  const maxVersion = previous.reduce((m, a) => Math.max(m, a.versionNumber || 1), 0);
  const nextVersion = maxVersion + 1;

  const superseded = [];
  for (const asset of previous) {
    if (!asset.isCurrentVersion) continue;
    asset.isCurrentVersion = false;
    asset.supersededBy = newAssetIds[0];
    if (!asset.versionGroupId) asset.versionGroupId = versionGroupId;
    await asset.save();
    superseded.push(asset._id);
  }

  const current = [];
  for (let i = 0; i < newAssetIds.length; i++) {
    const id = newAssetIds[i];
    const update = {
      ...patch,
      versionGroupId,
      versionNumber: nextVersion,
      isCurrentVersion: true,
      supersedes: i === 0 && superseded[0] ? superseded[0] : undefined,
    };
    await FileAsset.findByIdAndUpdate(id, { $set: update });
    current.push(id);
  }

  if (audit.userId) {
    await recordFileReplacement(audit, {
      oldAssetIds: superseded.map(String),
      newAssetIds: current.map(String),
      context: { versionGroupId, versionNumber: nextVersion },
    }).catch(() => {});
  }

  return { superseded, current, versionGroupId, versionNumber: nextVersion };
}

async function getCurrentVersionsForGroup(versionGroupId) {
  return FileAsset.find({ versionGroupId, isCurrentVersion: true, isDeleted: false }).lean();
}

async function listVersionsForAsset(assetId) {
  const asset = await FileAsset.findById(assetId).lean();
  if (!asset) return { current: null, versions: [] };

  const groupId = asset.versionGroupId || asset._id.toString();
  const versions = await FileAsset.find({
    $or: [{ versionGroupId: groupId }, { _id: asset._id }],
    isDeleted: false,
  })
    .sort({ versionNumber: -1, createdAt: -1 })
    .populate('uploadedBy', 'firstName lastName email')
    .lean();

  const current = versions.find((v) => v.isCurrentVersion) || versions[0] || null;
  const previous = versions.filter((v) => String(v._id) !== String(current?._id));

  return { current, versions: previous };
}

module.exports = {
  newVersionGroupId,
  supersedeFileAssets,
  getCurrentVersionsForGroup,
  listVersionsForAsset,
};
