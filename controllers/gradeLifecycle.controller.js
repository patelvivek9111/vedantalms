const Course = require('../models/course.model');
const gradeLifecycleService = require('../services/gradeLifecycle.service');
const academicAuditService = require('../services/academicAudit.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const { canGradeDraft, canPostGrades } = require('../middleware/academicPermissions');

exports.getCourseGradeLifecycle = async (req, res) => {
  try {
    const course = req.course || (await Course.findById(req.params.courseId).lean());
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const { term, year } = getSemesterFromCourse(course);
    const lifecycle = await gradeLifecycleService.getOrCreateLifecycle(course);
    const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');

    res.json({
      success: true,
      data: {
        lifecycle: lifecycle.toObject ? lifecycle.toObject() : lifecycle,
        term,
        year,
        gradingEngineVersion: getGradingEngineVersion(),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.postCourseGrades = async (req, res) => {
  try {
    const course = req.course;
    const lifecycle = await gradeLifecycleService.transitionToPosted(
      course._id,
      req.user,
      course
    );
    res.json({ success: true, data: lifecycle });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.finalizeCourseGrades = async (req, res) => {
  try {
    const course = req.course;
    const studentCount = (course.students || []).length;
    const jobQueueService = require('../services/jobQueue.service');
    const useAsync =
      req.query.async === 'true' ||
      (req.query.async !== 'false' && jobQueueService.shouldUseAsyncJob(studentCount));

    if (useAsync) {
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'grades.finalize',
        { courseId: String(course._id), userId: String(req.user._id) },
        req.user
      );
      const statusCode = isAsync ? 202 : 200;
      return res.status(statusCode).json({
        success: true,
        data: {
          jobId: job._id,
          status: job.status,
          async: isAsync,
          result: job.result,
        },
      });
    }

    const result = await gradeLifecycleService.transitionToFinalized(
      req.params.courseId,
      req.user
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.amendCourseGrades = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await gradeLifecycleService.transitionToAmended(req.params.courseId, req.user, {
      reason,
      ip: req.ip,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getCourseAmendmentHistory = async (req, res) => {
  try {
    const course = req.course || (await Course.findById(req.params.courseId).lean());
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    const { term, year } = getSemesterFromCourse(course);
    const amendments = await gradeLifecycleService.listAmendments(course._id, term, year);
    res.json({ success: true, data: amendments });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getCourseAuditHistory = async (req, res) => {
  try {
    const lifecycle = await gradeLifecycleService.getOrCreateLifecycle(req.course);
    const events = await academicAuditService.listAuditEvents(
      'course_grade_lifecycle',
      lifecycle._id,
      { limit: 100 }
    );
    const amendments = await gradeLifecycleService.listAmendments(
      req.course._id,
      lifecycle.term,
      lifecycle.year
    );
    res.json({
      success: true,
      data: { lifecycleEvents: events, amendments },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getCourseGradeProvenance = async (req, res) => {
  try {
    const academicAuditTimelineService = require('../services/academicAuditTimeline.service');
    const data = await academicAuditTimelineService.getCourseGradeProvenance(req.course);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getCourseAuditTimeline = async (req, res) => {
  try {
    const academicAuditTimelineService = require('../services/academicAuditTimeline.service');
    const limit = Math.min(200, parseInt(req.query.limit || '100', 10));
    const timeline = await academicAuditTimelineService.getCourseAuditTimeline(req.course, {
      limit,
    });
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
