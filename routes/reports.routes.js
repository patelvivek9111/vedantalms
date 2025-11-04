const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const {
  getAvailableSemesters,
  getStudentTranscript
} = require('../controllers/reports.controller');

// All routes require authentication and student role
router.get('/semesters', protect, authorize('student'), getAvailableSemesters);
router.get('/transcript', protect, authorize('student'), getStudentTranscript);

module.exports = router;
