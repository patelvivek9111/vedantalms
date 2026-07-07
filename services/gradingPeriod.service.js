const CourseGradingPeriod = require('../models/courseGradingPeriod.model');

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
    closed: !!payload.closed,
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
      ...(payload.closed != null ? { closed: !!payload.closed } : {}),
    },
    { new: true }
  ).lean();
}

module.exports = {
  listGradingPeriods,
  createGradingPeriod,
  updateGradingPeriod,
};
