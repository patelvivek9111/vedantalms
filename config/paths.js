const path = require('path');

const ROOT = process.cwd();

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(ROOT, 'uploads');
}

/** Centralized filesystem paths — env vars are read lazily so tests can redirect dirs. */
const paths = {
  get root() {
    return ROOT;
  },
  get uploads() {
    return uploadsDir();
  },
  get jobExports() {
    return process.env.JOB_EXPORTS_DIR || path.join(uploadsDir(), 'job-exports');
  },
  get gradeArchives() {
    return process.env.GRADE_ARCHIVES_DIR || path.join(uploadsDir(), 'archives', 'grade-snapshots');
  },
  get institutionExports() {
    return (
      process.env.INSTITUTION_EXPORTS_DIR || path.join(uploadsDir(), 'exports', 'institution')
    );
  },
  get migrationTemp() {
    return process.env.MIGRATION_TEMP_DIR || path.join(uploadsDir(), 'migration', 'temp');
  },
  get migrationCheckpoints() {
    return (
      process.env.MIGRATION_CHECKPOINTS_DIR || path.join(uploadsDir(), 'migration', 'checkpoints')
    );
  },
  get fileReports() {
    return process.env.FILE_REPORTS_DIR || path.join(uploadsDir(), 'reports');
  },
  get institutionBlobs() {
    return process.env.INSTITUTION_BLOBS_DIR || path.join(uploadsDir(), 'exports', 'institution');
  },
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
