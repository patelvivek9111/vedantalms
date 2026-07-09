const CourseGradingPeriod = require('../models/courseGradingPeriod.model');
const gradingPeriodAssignmentService = require('./gradingPeriodAssignment.service');

function buildWeightWarning(remainingPeriods) {
  const withWeights = (remainingPeriods || []).filter(
    (p) => p.weight != null && Number(p.weight) > 0
  );
  if (withWeights.length === 0) return null;
  const total = withWeights.reduce((sum, p) => sum + Number(p.weight), 0);
  if (Math.abs(total - 100) > 0.01) {
    return `Remaining grading period weights total ${total}% (not 100%). Update period weights so course totals calculate correctly.`;
  }
  return null;
}

async function listGradingPeriods(courseId) {
  return CourseGradingPeriod.find({ course: courseId })
    .sort({ position: 1, createdAt: 1 })
    .lean();
}

async function createGradingPeriod(courseId, payload, userId) {
  const count = await CourseGradingPeriod.countDocuments({ course: courseId });
  return CourseGradingPeriod.create({
    course: courseId,
    name: payload.name,
    position: payload.position != null ? payload.position : count,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    closeDate: payload.closeDate || null,
    closed: !!payload.closed,
    weight: payload.weight != null && payload.weight !== '' ? Number(payload.weight) : null,
  });
}

async function updateGradingPeriod(periodId, courseId, payload) {
  return CourseGradingPeriod.findOneAndUpdate(
    { _id: periodId, course: courseId },
    {
      ...(payload.name != null ? { name: payload.name } : {}),
      ...(payload.position != null ? { position: payload.position } : {}),
      ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
      ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
      ...(payload.closeDate !== undefined ? { closeDate: payload.closeDate || null } : {}),
      ...(payload.closed != null ? { closed: !!payload.closed } : {}),
      ...(payload.weight !== undefined
        ? { weight: payload.weight != null && payload.weight !== '' ? Number(payload.weight) : null }
        : {}),
    },
    { new: true }
  ).lean();
}

/**
 * Preview Canvas-style deletion impact (assignments unassigned, grades preserved).
 */
async function getDeletionImpact(periodId, courseId) {
  const period = await CourseGradingPeriod.findOne({ _id: periodId, course: courseId }).lean();
  if (!period) return null;

  const { assignmentCount, discussionCount } =
    await gradingPeriodAssignmentService.countItemsInPeriod(courseId, periodId);

  const remaining = await CourseGradingPeriod.find({
    course: courseId,
    _id: { $ne: periodId },
  }).lean();

  const deletedHadWeight = period.weight != null && Number(period.weight) > 0;
  const weightWarning =
    deletedHadWeight || remaining.some((p) => p.weight != null && Number(p.weight) > 0)
      ? buildWeightWarning(remaining)
      : null;

  return {
    period,
    assignmentCount,
    discussionCount,
    hasAssignmentsOrGrades: assignmentCount > 0 || discussionCount > 0,
    periodWasClosed: gradingPeriodAssignmentService.isPeriodClosed(period),
    remainingPeriodCount: remaining.length,
    weightWarning,
    preservesSnapshots: true,
  };
}

/**
 * Canvas-style delete:
 * - Remove period metadata only
 * - Unassign affected assignments/discussions (gradingPeriodId → null)
 * - Never delete grades or submissions
 * - Never auto-re-slot into other periods
 * - Frozen transcript snapshots are untouched (immutable)
 */
async function deleteGradingPeriod(periodId, courseId) {
  const impact = await getDeletionImpact(periodId, courseId);
  if (!impact) return null;

  const { assignmentsUnassigned, discussionsUnassigned } =
    await gradingPeriodAssignmentService.unassignItemsFromPeriod(courseId, periodId);

  await CourseGradingPeriod.deleteOne({ _id: periodId, course: courseId });

  const remaining = await CourseGradingPeriod.find({ course: courseId })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  const weightWarning = buildWeightWarning(remaining);

  return {
    deletedPeriod: impact.period,
    assignmentsUnassigned,
    discussionsUnassigned,
    remainingPeriodCount: remaining.length,
    totalRemainingWeight: remaining.reduce((sum, p) => sum + (Number(p.weight) || 0), 0),
    weightWarning,
    periodWasClosed: impact.periodWasClosed,
    preservesSnapshots: true,
  };
}

module.exports = {
  listGradingPeriods,
  createGradingPeriod,
  updateGradingPeriod,
  getDeletionImpact,
  deleteGradingPeriod,
  buildWeightWarning,
};
