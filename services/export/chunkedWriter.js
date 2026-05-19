const path = require('path');
const { hashContent } = require('../../shared/portability/exportUtils.cjs');

/**
 * Memory-safe chunked JSON writer for large institution sections (Phase R6).
 */
async function writeSectionChunks(storage, batchId, sectionName, dataOrBatches, options = {}) {
  const files = [];
  let totalRecords = 0;

  const batches = Array.isArray(dataOrBatches) && !options.fromCursor
    ? dataOrBatches
    : [dataOrBatches];

  let chunkIndex = 0;
  for (const batch of batches) {
    if (!batch) continue;
    const isNested = batch && !Array.isArray(batch) && typeof batch === 'object' && options.nested;
    const recordCount = isNested
      ? Object.values(batch).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
      : Array.isArray(batch)
        ? batch.length
        : 1;

    if (recordCount === 0 && !isNested) continue;

    chunkIndex += 1;
    const fileName =
      batches.length > 1 || chunkIndex > 1
        ? `${sectionName}-${String(chunkIndex).padStart(4, '0')}.json`
        : `${sectionName}.json`;

    const rel = path.join(batchId, fileName);
    const serialized = JSON.stringify(batch, null, 0);
    await storage.writeFile(rel, serialized, { encoding: 'utf8' });
    const contentHash = hashContent(serialized);
    files.push({ file: fileName, recordCount, contentHash });
    totalRecords += recordCount;
  }

  const aggregateHash =
    files.length > 1
      ? hashContent(files.map((f) => f.contentHash).join(''))
      : files[0]?.contentHash;

  return {
    name: sectionName,
    files: files.map((f) => f.file),
    file: files[0]?.file,
    recordCount: totalRecords,
    contentHash: files.length === 1 ? files[0].contentHash : aggregateHash,
    aggregateHash: files.length > 1 ? aggregateHash : undefined,
    chunkCount: files.length,
  };
}

module.exports = { writeSectionChunks };
