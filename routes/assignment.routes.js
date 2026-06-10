const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { toggleAssignmentPublish, getUngradedAssignmentsTodo, getStudentAssignmentsDueThisWeek, getAllItemsDueThisWeek } = require('../controllers/assignment.controller');
const rateLimit = require('express-rate-limit');

const quizAttemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many quiz attempt requests. Please retry shortly.' },
});

// Create assignment (teacher/admin only)
router.post('/', protect, authorize(['teacher', 'admin']), upload.array('attachments', 5), assignmentController.createAssignment);

// Get all assignments for a module
router.get('/module/:moduleId', protect, assignmentController.getModuleAssignments);

// All module assignments for a course in one round-trip (must stay above /:id)
router.get('/course/:courseId/module-assignments', protect, assignmentController.getCourseModuleAssignmentsBulk);

// Timed quiz attempt lifecycle (must stay above /:id)
router.post('/:id/quiz/start', protect, authorize(['student']), quizAttemptLimiter, assignmentController.startTimedQuizAttempt);
router.get('/:id/quiz/attempt', protect, authorize(['student']), quizAttemptLimiter, assignmentController.getTimedQuizAttempt);
router.post('/:id/quiz/heartbeat', protect, authorize(['student']), quizAttemptLimiter, assignmentController.heartbeatTimedQuizAttempt);

// To-Do routes must be defined above generic /:id routes.
router.get('/todo/ungraded', protect, getUngradedAssignmentsTodo);
router.get('/todo/due', protect, getStudentAssignmentsDueThisWeek);
router.get('/todo/due-all', protect, getAllItemsDueThisWeek);

// Get a single assignment
router.get('/:id', protect, assignmentController.getAssignment);

// Update an assignment (teacher/admin only)
router.put('/:id', protect, authorize(['teacher', 'admin']), upload.array('attachments', 5), assignmentController.updateAssignment);

// Delete an assignment (teacher/admin only)
router.delete('/:id', protect, authorize(['teacher', 'admin']), assignmentController.deleteAssignment);

// Toggle assignment publish status (teacher/admin only)
router.patch('/:id/publish', protect, authorize(['teacher', 'admin']), toggleAssignmentPublish);

// Get all group assignments for a group set
router.get('/groupset/:groupSetId', protect, assignmentController.getGroupSetAssignments);

// Get all group assignments for a course
router.get('/course/:courseId/group-assignments', protect, assignmentController.getCourseGroupAssignments);

// Get assignment statistics (teacher/admin only)
router.get('/:id/stats', protect, authorize(['teacher', 'admin']), assignmentController.getAssignmentStats);

module.exports = router; 