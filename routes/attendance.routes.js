const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect } = require('../middleware/auth');

router.get('/courses/:courseId/attendance', protect, attendanceController.getAttendance);
router.post('/courses/:courseId/attendance', protect, attendanceController.saveAttendance);
router.get('/courses/:courseId/attendance/stats', protect, attendanceController.getAttendanceStats);
router.get('/courses/:courseId/attendance/student', protect, attendanceController.getStudentAttendance);
router.get('/courses/:courseId/attendance/percentages', protect, attendanceController.getAttendancePercentages);

module.exports = router;
