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

// Get a student's submission for an assignment (less specific route after)
router.get('/student/:assignmentId', protect, submissionController.getStudentSubmission);

// Grade a submission (instructor only)
router.put('/:id', protect, authorize(['teacher', 'admin']), submissionController.gradeSubmission);

// Delete a submission
router.delete('/:id', protect, submissionController.deleteSubmission);

module.exports = router; 