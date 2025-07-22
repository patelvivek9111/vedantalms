const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const gradesController = require('../controllers/grades.controller');

// GET /api/grades/student/course/:courseId
router.get('/student/course/:courseId', protect, gradesController.getStudentCourseGrade);

module.exports = router; 