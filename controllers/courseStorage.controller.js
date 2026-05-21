const courseStorageAnalytics = require('../services/courseStorageAnalytics.service');
const bulkDownload = require('../services/bulkDownload.service');

exports.getCourseStorage = async (req, res) => {
  try {
    await courseStorageAnalytics.assertCourseStorageAccess(req.user, req.params.courseId);
    const data = await courseStorageAnalytics.aggregateCourseStorage(req.params.courseId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.recalculateCourseStorage = async (req, res) => {
  try {
    await courseStorageAnalytics.assertCourseStorageAccess(req.user, req.params.courseId);
    const { job } = await courseStorageAnalytics.enqueueRecalculate(req.params.courseId, req.user);
    res.json({ success: true, data: { job } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.createCourseZip = async (req, res) => {
  try {
    const { type, assignmentId, category } = req.body;
    await courseStorageAnalytics.assertCourseStorageAccess(req.user, req.params.courseId);
    const scope = {
      type: type || 'course_resources',
      courseId: req.params.courseId,
      assignmentId,
      category,
    };
    const { job } = await bulkDownload.createScopeZipJob(scope, req.user, { label: scope.type });
    res.json({ success: true, data: { job } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
