const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { transcriptLimiter } = require('./grades.routes');
const {
  getAvailableSemesters,
  getStudentTranscript,
  getStudentReportCard,
  issueStudentTranscript,
  getTranscriptIssuanceHistory,
} = require('../controllers/reports.controller');
const { requireCapability, CAPABILITIES } = require('../middleware/academicPermissions');

router.get('/semesters', protect, authorize('student'), getAvailableSemesters);
router.get('/transcript', transcriptLimiter, protect, authorize('student'), getStudentTranscript);
router.get('/report-card', transcriptLimiter, protect, authorize('student'), getStudentReportCard);

router.post(
  '/transcript/issue',
  transcriptLimiter,
  protect,
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  issueStudentTranscript
);
router.get(
  '/transcript/issue-history/:studentId',
  protect,
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  getTranscriptIssuanceHistory
);

module.exports = router;
