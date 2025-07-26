const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  enrollStudent,
  unenrollStudent,
  publishCourse,
  getCourseModules,
  updateOverviewConfig,
  assignInstructor
} = require('../controllers/course.controller');
const Course = require('../models/course.model');
const announcementController = require('../controllers/announcement.controller');
const upload = require('../middleware/upload');
const mongoose = require('mongoose');

// Validation middleware
const courseValidation = [
  check('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  check('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters')
];

// Routes
router
  .route('/')
  .get(protect, getCourses)
  .post(protect, authorize('teacher', 'admin'), courseValidation, createCourse);

router
  .route('/:id')
  .get(protect, getCourse)
  .put(protect, authorize('teacher', 'admin'), courseValidation, updateCourse)
  .delete(protect, authorize('admin'), deleteCourse);

router
  .route('/:id/publish')
  .patch(protect, authorize('teacher', 'admin'), publishCourse);

router
  .route('/:id/assign-instructor')
  .patch(protect, authorize('teacher', 'admin'), assignInstructor);

router
  .route('/:id/enroll')
  .post(protect, authorize('teacher', 'admin'), enrollStudent);

router.post('/:courseId/unenroll', protect, authorize('teacher', 'admin'), unenrollStudent);

// Add new route to get students in a course
router.get('/:courseId/students', protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Validate courseId - check for undefined, null, empty string, or "undefined" string
    if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '' || courseId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required and must be valid'
      });
    }

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(courseId)
      .populate('students', 'firstName lastName email profilePicture');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to the course
    if (req.user.role === 'student' && 
        !course.students.some(student => student._id.toString() === req.user.id) &&
        course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this course'
      });
    }

    res.json(course.students);
  } catch (err) {
    console.error('Get course students error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching course students',
      error: err.message 
    });
  }
});

// Announcements routes
router.get('/:courseId/announcements', protect, announcementController.getAnnouncementsByCourse);
router.post('/:courseId/announcements', protect, authorize('teacher', 'admin'), upload.array('attachments'), announcementController.createAnnouncement);

// Add route to get all modules for a course
router.get('/:courseId/modules', protect, getCourseModules);

// Add route to update overview configuration
router.put('/:id/overview-config', protect, authorize('teacher', 'admin'), updateOverviewConfig);

module.exports = router; 