const fs = require('fs');
const path = require('path');

/**
 * Resumable export/import checkpoint (Phase R6).
 * Stored as checkpoint.json inside the export batch directory.
 */
function readCheckpoint(checkpointPath) {
  if (!fs.existsSync(checkpointPath)) return { completedSections: [], sectionChunks: {} };
  return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
}

function writeCheckpoint(checkpointPath, data) {
  const dir = path.dirname(checkpointPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(checkpointPath, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
}

function markSectionComplete(checkpointPath, sectionName, chunkFiles = []) {
  const cp = readCheckpoint(checkpointPath);
  if (!cp.completedSections.includes(sectionName)) {
    cp.completedSections.push(sectionName);
  }
  cp.sectionChunks = cp.sectionChunks || {};
  cp.sectionChunks[sectionName] = chunkFiles;
  writeCheckpoint(checkpointPath, cp);
  return cp;
}

function isSectionComplete(checkpointPath, sectionName) {
  const cp = readCheckpoint(checkpointPath);
  return cp.completedSections.includes(sectionName);
}

module.exports = {
  readCheckpoint,
  writeCheckpoint,
  markSectionComplete,
  isSectionComplete,
};
