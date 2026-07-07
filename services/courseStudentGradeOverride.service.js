const CourseStudentGradeOverride = require('../models/courseStudentGradeOverride.model');

async function getActiveOverride(courseId, studentId) {
  return CourseStudentGradeOverride.findOne({
    course: courseId,
    student: studentId,
    active: true,
  }).lean();
}

async function setFinalGradeOverride(courseId, studentId, payload, userId) {
  const existing = await CourseStudentGradeOverride.findOne({
    course: courseId,
    student: studentId,
    active: true,
  });

  if (existing) {
    existing.finalPercent = payload.finalPercent;
    existing.letterGrade = payload.letterGrade || null;
    existing.reason = payload.reason || '';
    existing.overriddenBy = userId;
    await existing.save();
    return existing.toObject();
  }

  const doc = await CourseStudentGradeOverride.create({
    course: courseId,
    student: studentId,
    finalPercent: payload.finalPercent,
    letterGrade: payload.letterGrade || null,
    reason: payload.reason || '',
    overriddenBy: userId,
    active: true,
  });
  return doc.toObject();
}

async function clearFinalGradeOverride(courseId, studentId) {
  await CourseStudentGradeOverride.updateMany(
    { course: courseId, student: studentId, active: true },
    { active: false }
  );
}

module.exports = {
  getActiveOverride,
  setFinalGradeOverride,
  clearFinalGradeOverride,
};
