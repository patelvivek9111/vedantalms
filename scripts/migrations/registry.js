module.exports = [
  require('./migrations/001-backfill-grade-lifecycle'),
  require('./migrations/002-backfill-snapshot-is-current'),
  require('./migrations/003-sync-grading-indexes'),
  require('./migrations/004-backfill-inbox-unread-counts'),
  require('./migrations/005-sync-planner-indexes'),
  require('./migrations/006-p2-scale-indexes'),
];
