const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submission.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Create a submission (student only)
router.post('/', protect, authorize(['student']), submissionController.createSubmission);

// Get all submissions for an assignment (instructor only)
router.get('/assignment/:assignmentId', protect, authorize(['teacher', 'admin']), submissionController.getAssignmentSubmissions);

// Get all submissions for a student for a course (more specific route first)
router.get('/student/course/:courseId', protect, submissionController.getStudentSubmissionsForCourse);

// Download all submissions for an assignment as zip (instructor only) - must be before /:id routes
router.get('/assignment/:assignmentId/download', protect, authorize(['teacher', 'admin']), submissionController.downloadSubmissions);

// Download a single submission - must be before /:id routes and /student routes
router.get('/:submissionId/download', protect, submissionController.downloadSingleSubmission);

// Get a student's submission for an assignment (less specific route after)
router.get('/student/:assignmentId', protect, submissionController.getStudentSubmission);

// Grade a submission (instructor only) - with file upload support
router.put('/:id', protect, authorize(['teacher', 'admin']), upload.array('teacherFeedbackFiles', 10), submissionController.gradeSubmission);
router.post('/:id/grade', protect, authorize(['teacher', 'admin']), upload.array('teacherFeedbackFiles', 10), submissionController.gradeSubmission);

// Create or update manual grade for offline assignment (instructor only)
router.post('/manual-grade', protect, authorize(['teacher', 'admin']), submissionController.createOrUpdateManualGrade);

// Delete a submission
router.delete('/:id', protect, submissionController.deleteSubmission);

module.exports = router; 