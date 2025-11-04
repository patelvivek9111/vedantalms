const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const gradesController = require('../controllers/grades.controller');

// GET /api/grades/student/course/:courseId
router.get('/student/course/:courseId', protect, gradesController.getStudentCourseGrade);

// GET /api/grades/course/:courseId/average
router.get('/course/:courseId/average', protect, gradesController.getCourseClassAverage);

module.exports = router; 