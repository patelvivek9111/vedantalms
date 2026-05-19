/**
 * Sync MongoDB indexes for grading / audit collections.
 */
const MODELS = [
  require('../../../models/courseGradeLifecycle.model'),
  require('../../../models/studentCourseGradeSnapshot.model'),
  require('../../../models/systemAuditEvent.model'),
  require('../../../models/gradeAmendmentRecord.model'),
  require('../../../models/asyncJob.model'),
  require('../../../models/transcriptIssueLog.model'),
  require('../../../models/migrationRun.model'),
  require('../../../models/gradingPolicyAudit.model'),
];

module.exports = {
  id: '003-sync-grading-indexes',
  description: 'syncIndexes() on grading and audit models',
  async up({ dryRun, log, addStats }) {
    const synced = [];
    for (const Model of MODELS) {
      if (dryRun) {
        log('would syncIndexes', { model: Model.modelName });
        synced.push(Model.modelName);
        continue;
      }
      await Model.syncIndexes();
      log('synced', { model: Model.modelName });
      synced.push(Model.modelName);
    }
    const stats = { models: synced };
    addStats(stats);
    return stats;
  },
};
