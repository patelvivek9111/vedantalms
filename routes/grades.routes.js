const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const {
  requireCapability,
  loadCourse,
  CAPABILITIES,
} = require('../middleware/academicPermissions');
const gradesController = require('../controllers/grades.controller');
const gradeLifecycleController = require('../controllers/gradeLifecycle.controller');

const skipLimit = () => process.env.DISABLE_RATE_LIMIT === 'true';

const gradingLifecycleLimiter = rateLimit({
  windowMs: parseInt(process.env.GRADING_LIFECYCLE_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.GRADING_LIFECYCLE_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many grading lifecycle requests. Please slow down.' },
  skip: skipLimit,
});

const transcriptLimiter = rateLimit({
  windowMs: parseInt(process.env.TRANSCRIPT_RATE_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.TRANSCRIPT_RATE_MAX || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many transcript requests.' },
  skip: skipLimit,
});

// GET /api/grades/student/course/:courseId
router.get('/student/course/:courseId', protect, gradesController.getStudentCourseGrade);

// GET /api/grades/courses/averages?courseIds=
router.get('/courses/averages', protect, gradesController.getCourseClassAveragesBatch);

// GET /api/grades/course/:courseId/average
router.get('/course/:courseId/average', protect, gradesController.getCourseClassAverage);

router.get('/course/:courseId/gradebook', protect, gradesController.getCourseGradebook);
router.post(
  '/course/:courseId/gradebook/export',
  gradingLifecycleLimiter,
  protect,
  gradesController.enqueueGradebookExport
);
router.post(
  '/course/:courseId/transcript/regenerate',
  gradingLifecycleLimiter,
  protect,
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  gradesController.regenerateTranscriptSnapshots
);

// Grade lifecycle (Wave A + B)
router.get(
  '/course/:courseId/lifecycle',
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  gradeLifecycleController.getCourseGradeLifecycle
);

router.get(
  '/course/:courseId/amendments',
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  gradeLifecycleController.getCourseAmendmentHistory
);

router.get(
  '/course/:courseId/audit',
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  gradeLifecycleController.getCourseAuditHistory
);

router.get(
  '/course/:courseId/provenance',
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  gradeLifecycleController.getCourseGradeProvenance
);

router.get(
  '/course/:courseId/audit-timeline',
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  gradeLifecycleController.getCourseAuditTimeline
);

router.post(
  '/course/:courseId/post',
  gradingLifecycleLimiter,
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.POST_GRADES, { courseParam: true }),
  gradeLifecycleController.postCourseGrades
);

router.post(
  '/course/:courseId/finalize',
  gradingLifecycleLimiter,
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  gradeLifecycleController.finalizeCourseGrades
);

router.post(
  '/course/:courseId/amend',
  gradingLifecycleLimiter,
  protect,
  loadCourse,
  requireCapability(CAPABILITIES.AMEND_GRADES),
  gradeLifecycleController.amendCourseGrades
);

module.exports = router;
module.exports.transcriptLimiter = transcriptLimiter;
