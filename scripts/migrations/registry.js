module.exports = [
  require('./migrations/001-backfill-grade-lifecycle'),
  require('./migrations/002-backfill-snapshot-is-current'),
  require('./migrations/003-sync-grading-indexes'),
];
