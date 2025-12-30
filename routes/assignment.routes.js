const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { toggleAssignmentPublish, getUngradedAssignmentsTodo, getStudentAssignmentsDueThisWeek, getAllItemsDueThisWeek } = require('../controllers/assignment.controller');

// Create assignment (teacher/admin only)
router.post('/', protect, authorize(['teacher', 'admin']), upload.array('attachments', 5), assignmentController.createAssignment);

// Get all assignments for a module
router.get('/module/:moduleId', protect, assignmentController.getModuleAssignments);

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

// To-Do: Get all assignments with ungraded submissions for the logged-in teacher/admin
router.get('/todo/ungraded', protect, getUngradedAssignmentsTodo);

// To-Do: Get all assignments due this week for the logged-in student
router.get('/todo/due', protect, getStudentAssignmentsDueThisWeek);

// To-Do: Get all items due this week for the logged-in student (assignments + discussions)
router.get('/todo/due-all', protect, getAllItemsDueThisWeek);

module.exports = router; 