const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACTS_ROOT_FILE = path.join(__dirname, '.jest-artifacts-root');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createJestArtifactsRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-jest-artifacts-'));
  ensureDir(path.join(root, 'job-exports'));
  ensureDir(path.join(root, 'exports', 'institution'));
  fs.writeFileSync(ARTIFACTS_ROOT_FILE, root, 'utf8');
  return root;
}

function readJestArtifactsRoot() {
  if (!fs.existsSync(ARTIFACTS_ROOT_FILE)) {
    return createJestArtifactsRoot();
  }
  return fs.readFileSync(ARTIFACTS_ROOT_FILE, 'utf8').trim();
}

function applyJestExportPaths(root = readJestArtifactsRoot()) {
  process.env.JOB_EXPORTS_DIR = path.join(root, 'job-exports');
  process.env.INSTITUTION_EXPORTS_DIR = path.join(root, 'exports', 'institution');

  const { resetStorageService } = require('../services/storage');
  resetStorageService();
  return root;
}

function removeJestArtifactsRoot() {
  if (!fs.existsSync(ARTIFACTS_ROOT_FILE)) return;
  const root = fs.readFileSync(ARTIFACTS_ROOT_FILE, 'utf8').trim();
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch (_) {
    /* best effort */
  }
  try {
    fs.unlinkSync(ARTIFACTS_ROOT_FILE);
  } catch (_) {
    /* already removed */
  }
}

module.exports = {
  ARTIFACTS_ROOT_FILE,
  createJestArtifactsRoot,
  readJestArtifactsRoot,
  applyJestExportPaths,
  removeJestArtifactsRoot,
};
