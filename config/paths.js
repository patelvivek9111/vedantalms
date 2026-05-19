const path = require('path');

const ROOT = process.cwd();

/** Centralized filesystem paths — avoid hardcoding uploads/ in business logic. */
const paths = {
  root: ROOT,
  uploads: process.env.UPLOADS_DIR || path.join(ROOT, 'uploads'),
  jobExports: process.env.JOB_EXPORTS_DIR || path.join(ROOT, 'uploads', 'job-exports'),
  gradeArchives: process.env.GRADE_ARCHIVES_DIR || path.join(ROOT, 'uploads', 'archives', 'grade-snapshots'),
  institutionExports: process.env.INSTITUTION_EXPORTS_DIR || path.join(ROOT, 'uploads', 'exports', 'institution'),
  migrationTemp: process.env.MIGRATION_TEMP_DIR || path.join(ROOT, 'uploads', 'migration', 'temp'),
  migrationCheckpoints: process.env.MIGRATION_CHECKPOINTS_DIR || path.join(ROOT, 'uploads', 'migration', 'checkpoints'),
};

function resolveUnderRoot(relativePath) {
  return path.resolve(paths.root, relativePath);
}

function isPathInside(baseDir, targetPath) {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(baseDir);
  return resolved === base || resolved.startsWith(base + path.sep);
}

module.exports = {
  paths,
  resolveUnderRoot,
  isPathInside,
};
