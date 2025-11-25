const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect, authorize } = require('../middleware/auth');

// Get attendance for a course on a specific date
router.get('/courses/:courseId/attendance', protect, attendanceController.getAttendance);

// Save attendance for a course (instructor/admin only)
router.post('/courses/:courseId/attendance', protect, authorize(['teacher', 'admin']), attendanceController.saveAttendance);

// Get attendance statistics for a course (instructor/admin only)
router.get('/courses/:courseId/attendance/stats', protect, authorize(['teacher', 'admin']), attendanceController.getAttendanceStats);

// Get student's own attendance for a course
router.get('/courses/:courseId/attendance/student', protect, attendanceController.getStudentAttendance);

// Get attendance percentages for all students in a course (instructor/admin only)
router.get('/courses/:courseId/attendance/percentages', protect, authorize(['teacher', 'admin']), attendanceController.getAttendancePercentages);

// Test endpoint to check database state
router.get('/courses/:courseId/attendance/test', protect, attendanceController.testAttendance);

// Cleanup endpoint to fix database issues (admin only)
router.post('/courses/:courseId/attendance/cleanup', protect, authorize('admin'), attendanceController.cleanupAttendance);

// Test endpoint to try saving a single attendance record (instructor/admin only)
router.post('/courses/:courseId/attendance/test-save', protect, authorize(['teacher', 'admin']), attendanceController.testSaveAttendance);

// Direct database fix endpoint (admin only)
router.post('/courses/:courseId/attendance/fix-db', protect, authorize('admin'), attendanceController.fixDatabase);

// Deep database inspection endpoint (admin only)
router.get('/courses/:courseId/attendance/inspect', protect, authorize('admin'), attendanceController.inspectDatabase);

module.exports = router; 