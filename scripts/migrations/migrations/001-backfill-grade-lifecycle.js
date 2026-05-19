/**
 * Backfill FINALIZED lifecycle for course terms that already have frozen transcript snapshots.
 * Does not change grade values or snapshot rows.
 */
const Course = require('../../../models/course.model');
const CourseGradeLifecycle = require('../../../models/courseGradeLifecycle.model');
const StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');
const { getGradingEngineVersion } = require('../../../shared/grading/gradingEngineVersion.cjs');

module.exports = {
  id: '001-backfill-grade-lifecycle',
  description: 'Backfill FINALIZED CourseGradeLifecycle from existing frozen snapshots',
  async up({ dryRun, log, addStats }) {
    const groups = await StudentCourseGradeSnapshot.aggregate([
      { $match: { frozen: true, term: { $type: 'string' }, year: { $type: 'number' } } },
      {
        $group: {
          _id: { course: '$course', term: '$term', year: '$year' },
          count: { $sum: 1 },
          latestPolicyHash: { $last: '$gradingPolicyHash' },
          latestPolicyVersion: { $last: '$gradingPolicyVersion' },
          latestEngine: { $last: '$gradingEngineVersion' },
        },
      },
    ]);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const g of groups) {
      const { course: courseId, term, year } = g._id;
      const course = await Course.findById(courseId).select('_id title').lean();
      if (!course) {
        skipped += 1;
        continue;
      }

      let lifecycle = await CourseGradeLifecycle.findOne({ course: courseId, term, year });
      if (lifecycle && lifecycle.status === 'FINALIZED') {
        skipped += 1;
        continue;
      }

      const payload = {
        course: courseId,
        term,
        year: Number(year),
        status: 'FINALIZED',
        policyHash: g.latestPolicyHash || lifecycle?.policyHash,
        policyVersion: g.latestPolicyVersion || lifecycle?.policyVersion || 1,
        gradingEngineVersion: g.latestEngine || getGradingEngineVersion(),
        studentSnapshotCount: g.count,
        finalizedAt: lifecycle?.finalizedAt || new Date(),
      };

      if (dryRun) {
        log('would finalize lifecycle', { courseId: String(courseId), term, year, snapshots: g.count });
        if (!lifecycle) created += 1;
        else updated += 1;
        continue;
      }

      if (!lifecycle) {
        await CourseGradeLifecycle.create(payload);
        created += 1;
      } else {
        lifecycle.status = 'FINALIZED';
        lifecycle.policyHash = payload.policyHash;
        lifecycle.policyVersion = payload.policyVersion;
        lifecycle.gradingEngineVersion = payload.gradingEngineVersion;
        lifecycle.studentSnapshotCount = g.count;
        if (!lifecycle.finalizedAt) lifecycle.finalizedAt = new Date();
        await lifecycle.save();
        updated += 1;
      }
    }

    const stats = { groups: groups.length, created, updated, skipped };
    addStats(stats);
    log('done', stats);
    return stats;
  },
};
