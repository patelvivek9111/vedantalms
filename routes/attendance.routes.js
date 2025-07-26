const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect } = require('../middleware/auth');

// Get attendance for a course on a specific date
router.get('/courses/:courseId/attendance', protect, attendanceController.getAttendance);

// Save attendance for a course
router.post('/courses/:courseId/attendance', protect, attendanceController.saveAttendance);

// Get attendance statistics for a course
router.get('/courses/:courseId/attendance/stats', protect, attendanceController.getAttendanceStats);

// Get student's own attendance for a course
router.get('/courses/:courseId/attendance/student', protect, attendanceController.getStudentAttendance);

// Get attendance percentages for all students in a course
router.get('/courses/:courseId/attendance/percentages', protect, attendanceController.getAttendancePercentages);

// Test endpoint to check database state
router.get('/courses/:courseId/attendance/test', protect, attendanceController.testAttendance);

// Cleanup endpoint to fix database issues
router.post('/courses/:courseId/attendance/cleanup', protect, attendanceController.cleanupAttendance);

// Test endpoint to try saving a single attendance record
router.post('/courses/:courseId/attendance/test-save', protect, attendanceController.testSaveAttendance);

// Direct database fix endpoint
router.post('/courses/:courseId/attendance/fix-db', protect, attendanceController.fixDatabase);

// Deep database inspection endpoint
router.get('/courses/:courseId/attendance/inspect', protect, attendanceController.inspectDatabase);

module.exports = router; 