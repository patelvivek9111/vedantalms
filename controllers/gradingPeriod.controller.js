const gradingPeriodService = require('../services/gradingPeriod.service');
const Course = require('../models/course.model');

async function assertCourseAccess(req, courseId) {
  const course = await Course.findById(courseId).select('instructor teachingAssistants').lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }
  const uid = String(req.user._id);
  const isStaff =
    req.user.role === 'admin' ||
    req.user.role === 'registrar' ||
    String(course.instructor) === uid ||
    (course.teachingAssistants || []).some((ta) => String(ta) === uid);
  if (!isStaff) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }
  return course;
}

exports.listGradingPeriods = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    await assertCourseAccess(req, courseId);
    const periods = await gradingPeriodService.listGradingPeriods(courseId);
    res.json({ success: true, data: periods });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.createGradingPeriod = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    await assertCourseAccess(req, courseId);
    if (!req.body?.name?.trim()) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const period = await gradingPeriodService.createGradingPeriod(
      courseId,
      req.body,
      req.user._id
    );
    res.status(201).json({ success: true, data: period });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.updateGradingPeriod = async (req, res) => {
  try {
    const { courseId, periodId } = req.params;
    await assertCourseAccess(req, courseId);
    const period = await gradingPeriodService.updateGradingPeriod(periodId, courseId, req.body);
    if (!period) return res.status(404).json({ success: false, message: 'Period not found' });
    res.json({ success: true, data: period });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
