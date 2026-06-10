/**
 * Sync MongoDB indexes for planner enrollment lookup collections.
 */
const MODELS = [
  require('../../../models/module.model'),
  require('../../../models/Group'),
];

module.exports = {
  id: '005-sync-planner-indexes',
  description: 'syncIndexes() on Module and Group planner lookup indexes',
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
