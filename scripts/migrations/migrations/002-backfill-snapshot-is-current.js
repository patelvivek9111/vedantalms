/**
 * Ensure legacy frozen snapshots have isCurrent set (one current row per student/course/term).
 */
const StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');

module.exports = {
  id: '002-backfill-snapshot-is-current',
  description: 'Mark latest frozen snapshot per student/term as isCurrent',
  async up({ dryRun, log, addStats }) {
    const combos = await StudentCourseGradeSnapshot.aggregate([
      { $match: { frozen: true, term: { $type: 'string' }, year: { $type: 'number' } } },
      {
        $group: {
          _id: { student: '$student', course: '$course', term: '$term', year: '$year' },
          ids: { $push: { id: '$_id', computedAt: '$computedAt', createdAt: '$createdAt' } },
        },
      },
    ]);

    let groupsProcessed = 0;
    let rowsUpdated = 0;

    for (const combo of combos) {
      const sorted = combo.ids.sort((a, b) => {
        const da = new Date(a.computedAt || a.createdAt || 0).getTime();
        const db = new Date(b.computedAt || b.createdAt || 0).getTime();
        return db - da;
      });
      const currentId = sorted[0]?.id;
      if (!currentId) continue;
      groupsProcessed += 1;

      const allIds = sorted.map((s) => s.id);
      const supersededIds = allIds.filter((id) => String(id) !== String(currentId));

      if (dryRun) {
        rowsUpdated += allIds.length;
        continue;
      }

      await StudentCourseGradeSnapshot.updateMany(
        { _id: { $in: allIds } },
        { $set: { isCurrent: false } }
      );
      await StudentCourseGradeSnapshot.updateOne(
        { _id: currentId },
        { $set: { isCurrent: true }, $unset: { supersededAt: 1 } }
      );
      if (supersededIds.length) {
        await StudentCourseGradeSnapshot.updateMany(
          { _id: { $in: supersededIds } },
          { $set: { isCurrent: false, supersededAt: new Date() } }
        );
      }
      rowsUpdated += allIds.length;
    }

    const stats = { combos: combos.length, groupsProcessed, rowsUpdated };
    addStats(stats);
    log('done', stats);
    return stats;
  },
};
