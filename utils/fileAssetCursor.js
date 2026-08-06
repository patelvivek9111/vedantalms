const FileAsset = require('../models/fileAsset.model');

/**
 * Load FileAssets matching filter in _id-ascending batches (avoids one unbounded query).
 * @param {object} filter
 * @param {{ batchSize?: number, limit?: number, select?: string|object }} [options]
 */
async function loadFileAssetsInBatches(filter = {}, options = {}) {
  const batchSize = Math.min(Math.max(options.batchSize || 500, 1), 2000);
  const hardLimit = options.limit || null;
  const assets = [];
  let lastId = null;

  for (;;) {
    if (hardLimit != null && assets.length >= hardLimit) break;
    const pageLimit =
      hardLimit != null ? Math.min(batchSize, hardLimit - assets.length) : batchSize;
    const q = lastId ? { ...filter, _id: { $gt: lastId } } : { ...filter };

    let query = FileAsset.find(q).sort({ _id: 1 }).limit(pageLimit);
    if (options.select) query = query.select(options.select);
    const batch = await query.lean();
    if (!batch.length) break;

    assets.push(...batch);
    lastId = batch[batch.length - 1]._id;
    if (batch.length < pageLimit) break;
  }

  return assets;
}

/**
 * Process FileAssets in batches without retaining the full collection in memory.
 * @param {object} filter
 * @param {(batch: object[]) => Promise<void>|void} onBatch
 * @param {{ batchSize?: number, limit?: number, select?: string|object }} [options]
 * @returns {Promise<number>} total documents processed
 */
async function forEachFileAssetBatch(filter, onBatch, options = {}) {
  const batchSize = Math.min(Math.max(options.batchSize || 500, 1), 2000);
  const hardLimit = options.limit || null;
  let lastId = null;
  let processed = 0;

  for (;;) {
    if (hardLimit != null && processed >= hardLimit) break;
    const pageLimit =
      hardLimit != null ? Math.min(batchSize, hardLimit - processed) : batchSize;
    const q = lastId ? { ...filter, _id: { $gt: lastId } } : { ...filter };

    let query = FileAsset.find(q).sort({ _id: 1 }).limit(pageLimit);
    if (options.select) query = query.select(options.select);
    const batch = await query.lean();
    if (!batch.length) break;

    await onBatch(batch);
    processed += batch.length;
    lastId = batch[batch.length - 1]._id;
    if (batch.length < pageLimit) break;
  }

  return processed;
}

module.exports = {
  loadFileAssetsInBatches,
  forEachFileAssetBatch,
};
