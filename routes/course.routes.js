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
  updateSidebarConfig,
  assignInstructor,
  copyCourse,
  archiveCourse,
  restoreCourse,
  bulkCourseOperation,
} = require('../controllers/course.controller');
const Course = require('../models/course.model');
const announcementController = require('../controllers/announcement.controller');
const upload = require('../middleware/upload');
const mongoose = require('mongoose');
const { courseSelfEnroll, ensureEnrollmentQrToken, ensureEnrollmentJoinCode } = require('../utils/courseSelfEnroll');

// Validation middleware for creating courses (requires title and description)
const createCourseValidation = [
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
    .withMessage('Description must be between 10 and 1000 characters'),
  check('defaultColor')
    .optional()
    .isString()
    .withMessage('Default color must be a string')
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Default color must be a valid hex color code')
];

// Validation middleware for updating courses (all fields optional for partial updates)
const updateCourseValidation = [
  check('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  check('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  check('defaultColor')
    .optional()
    .isString()
    .withMessage('Default color must be a string')
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Default color must be a valid hex color code')
];

// Add route to get all available courses for browsing (including enrollment status)
router.get('/available/browse', protect, async (req, res) => {
  try {
    // Only get courses that have start and end dates
    const courses = await Course.find({
      'catalog.startDate': { $exists: true, $ne: null },
      'catalog.endDate': { $exists: true, $ne: null }
    }).populate('instructor', 'firstName lastName email')
      .populate('students', '_id firstName lastName')
      .populate('enrollmentRequests.student', '_id firstName lastName')
      .populate('waitlist.student', '_id firstName lastName');
    
    res.json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (err) {
    console.error('Get available courses error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching available courses',
      error: err.message 
    });
  }
});

// Student joins via course QR / deep link (requires instructor approval when there is capacity; waitlist unchanged when full)
router.post('/enroll-by-qr', protect, async (req, res) => {
  try {
    const tokenRaw = req.body?.token != null ? String(req.body.token).trim() : '';
    const joinCodeRaw =
      req.body?.joinCode != null
        ? String(req.body.joinCode).toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/gi, '')
        : '';
    if (!tokenRaw && (!joinCodeRaw || joinCodeRaw.length !== 8)) {
      return res.status(400).json({ success: false, message: 'Join token or 8-character join code is required' });
    }
    let course = null;
    if (joinCodeRaw.length === 8) {
      course = await Course.findOne({ enrollmentJoinCode: joinCodeRaw }).populate('instructor', 'firstName lastName');
    }
    if (!course && tokenRaw) {
      course = await Course.findOne({ enrollmentQrToken: tokenRaw }).populate('instructor', 'firstName lastName');
    }
    if (!course) {
      return res.status(404).json({ success: false, message: 'Invalid join code' });
    }
    const Todo = require('../models/todo.model');
    const result = await courseSelfEnroll(
      { userId: req.user.id, userRole: req.user.role, course, enrollmentSource: 'qr' },
      Todo,
      migrateExistingNotifications,
      removeEnrollmentSummaryTodos,
      syncEnrollmentAttentionTodo
    );
    return res.status(result.statusCode).json({
      ...result.body,
      courseId: course._id.toString(),
      courseTitle: course.title,
    });
  } catch (err) {
    console.error('Enroll by QR error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while joining course',
      error: err.message,
    });
  }
});

// Add new route to get enrollment requests for a course
router.get('/:courseId/enrollment-requests', protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(courseId)
      .populate('enrollmentRequests.student', 'firstName lastName email profilePicture');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    

    // Check if user has access to the course (instructor or admin)
    if (req.user.role === 'student' && 
        !course.students.some(student => student._id.toString() === req.user.id) &&
        course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this course'
      });
    }

    // Filter to only show pending requests
    const pendingRequests = course.enrollmentRequests.filter(request => request.status === 'pending');
    
    
    res.json(pendingRequests);
  } catch (err) {
    console.error('Get course enrollment requests error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching enrollment requests',
      error: err.message 
    });
  }
});

// Add new route to get waitlist for a course
router.get('/:courseId/waitlist', protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(courseId)
      .populate('waitlist.student', 'firstName lastName email profilePicture');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Check if user has access to the course (instructor or admin)
    if (req.user.role === 'student' && 
        !course.students.some(student => student._id.toString() === req.user.id) &&
        course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this course'
      });
    }
    
    res.json({
      success: true,
      data: course.waitlist || []
    });
  } catch (err) {
    console.error('Get course waitlist error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching waitlist',
      error: err.message 
    });
  }
});

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

// Add route to get enrollment status for current user in a specific course
router.get('/:courseId/enrollment-status', protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check enrollment status
    const isEnrolled = course.students.includes(userId);
    const enrollmentRequest = course.enrollmentRequests.find(
      request => request.student.toString() === userId
    );

    res.json({
      success: true,
      data: {
        isEnrolled,
        enrollmentRequest: enrollmentRequest ? {
          status: enrollmentRequest.status,
          requestDate: enrollmentRequest.requestDate,
          responseDate: enrollmentRequest.responseDate
        } : null
      }
    });
  } catch (err) {
    console.error('Get enrollment status error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching enrollment status',
      error: err.message 
    });
  }
});

// Teacher/admin: join URL + token for course QR (token created lazily if missing)
router.get('/:courseId/enrollment-join-info', protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID format' });
    }
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    const isInstructor = course.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const token = await ensureEnrollmentQrToken(Course, course);
    const joinCode = await ensureEnrollmentJoinCode(Course, course);
    const joinPath = `/join-course?t=${encodeURIComponent(token)}`;
    const envBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || '').replace(/\/$/, '');
    const joinUrl = envBase ? `${envBase}${joinPath}` : joinPath;
    res.json({
      success: true,
      joinUrl,
      joinPath,
      joinCode,
      courseTitle: course.title,
    });
  } catch (err) {
    console.error('enrollment-join-info error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while building join link',
      error: err.message,
    });
  }
});

// Routes
router
  .route('/')
  .get(protect, getCourses)
  .post(protect, authorize('teacher', 'admin'), createCourseValidation, createCourse);

router
  .route('/:id')
  .get(protect, getCourse)
  .put(protect, authorize('teacher', 'admin'), updateCourseValidation, updateCourse)
  .delete(protect, authorize('admin'), deleteCourse);

router
  .route('/:id/publish')
  .patch(protect, authorize('teacher', 'admin'), publishCourse);

router.post('/:id/copy', protect, authorize('teacher', 'admin'), copyCourse);
router.patch('/:id/archive', protect, authorize('teacher', 'admin'), archiveCourse);
router.patch('/:id/restore', protect, authorize('teacher', 'admin'), restoreCourse);
router.post('/bulk', protect, authorize('teacher', 'admin'), bulkCourseOperation);

router
  .route('/:id/assign-instructor')
  .patch(protect, authorize('teacher', 'admin'), assignInstructor);



router.post('/:courseId/unenroll', protect, authorize('teacher', 'admin'), unenrollStudent);

// Teacher enrollment route (must come before student self-enrollment)
router.post('/:id/enroll-teacher', protect, authorize('teacher', 'admin'), enrollStudent);

// Allow students to unenroll themselves
router.post('/:courseId/unenroll-self', protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;
    
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if student is enrolled in the course
    if (!course.students.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }

    // Remove student from course
    course.students = course.students.filter(id => id.toString() !== studentId);
    
    // Check if there are students on the waitlist and promote the first one
    if (course.waitlist && course.waitlist.length > 0) {
      try {
        const promotedStudent = course.waitlist.shift(); // Remove first student from waitlist
        
        // Add them to the course
        course.students.push(promotedStudent.student);
        
        // Update positions for remaining waitlist students
        course.waitlist.forEach((waitlistEntry, index) => {
          waitlistEntry.position = index + 1;
        });
        
        // Create todo notification for teacher about the promotion
        const Todo = require('../models/todo.model');
        const User = require('../models/user.model');
        
        const promotedUser = await User.findById(promotedStudent.student).select('firstName lastName');
        
        if (promotedUser) {
          await Todo.create({
            title: `Student ${promotedUser.firstName} ${promotedUser.lastName} has been promoted from waitlist to "${course.title}"`,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            user: course.instructor._id,
            type: 'waitlist_promotion',
            courseId: course._id,
            studentId: promotedStudent.student,
            action: 'completed'
          });
        }
      } catch (waitlistError) {
        console.error('Error during waitlist promotion:', waitlistError);
        // Continue with unenrollment even if waitlist promotion fails
      }
    }
    
    await course.save();

    // Refresh instructor enrollment to-dos (no roster-count card; one row for waitlist + pending joins)
    const Todo = require('../models/todo.model');
    await removeEnrollmentSummaryTodos(course, Todo);
    await syncEnrollmentAttentionTodo(course, Todo);

    res.json({
      success: true,
      message: 'Successfully unenrolled from the course' + (course.waitlist && course.waitlist.length > 0 ? '. A student has been promoted from the waitlist.' : '')
    });
  } catch (err) {
    console.error('Self unenrollment error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while unenrolling',
      error: err.message
    });
  }
});

// Catalog / direct course id enrollment (immediate join when there is capacity; waitlist when full)
router.post('/:id/enroll', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('instructor', 'firstName lastName');
    const Todo = require('../models/todo.model');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const result = await courseSelfEnroll(
      { userId: req.user.id, userRole: req.user.role, course, enrollmentSource: 'catalog' },
      Todo,
      migrateExistingNotifications,
      removeEnrollmentSummaryTodos,
      syncEnrollmentAttentionTodo
    );
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting enrollment request',
      error: err.message,
    });
  }
});

function instructorIdFromCourse(course) {
  if (!course || !course.instructor) return null;
  return course.instructor._id || course.instructor;
}

/** Remove legacy "N students enrolled" to-do rows (no longer shown to instructors). */
async function removeEnrollmentSummaryTodos(course, Todo) {
  try {
    const userId = instructorIdFromCourse(course);
    if (!userId) return;
    await Todo.deleteMany({
      type: 'enrollment_summary',
      courseId: course._id,
      user: userId,
    });
  } catch (err) {
    console.error('Error removing enrollment summary todos:', err);
  }
}

/**
 * One pending to-do per course: pending join approvals (QR) + waitlisted students.
 * Title is short; course name is stored for the To Do panel header.
 */
async function syncEnrollmentAttentionTodo(course, Todo) {
  try {
    const userId = instructorIdFromCourse(course);
    if (!userId) return;

    await Todo.deleteMany({
      type: 'enrollment_request',
      courseId: course._id,
      user: userId,
      action: 'pending',
    });

    const pendingApproval = (course.enrollmentRequests || []).filter((r) => r.status === 'pending').length;
    const waitlisted = (course.waitlist || []).length;
    const n = pendingApproval + waitlisted;
    if (n === 0) return;

    const title =
      n === 1 ? '1 student needs your review' : `${n} students need your review`;

    await Todo.create({
      title,
      dueDate: new Date(),
      user: userId,
      type: 'enrollment_request',
      courseId: course._id,
      courseName: course.title,
      action: 'pending',
    });
  } catch (err) {
    console.error('Error syncing enrollment attention todo:', err);
  }
}

// Normalize instructor to-dos for courses with waitlist and/or pending join requests
async function migrateExistingNotifications() {
  try {
    const Todo = require('../models/todo.model');
    const Course = require('../models/course.model');

    const courses = await Course.find({
      $or: [
        { 'waitlist.0': { $exists: true } },
        { enrollmentRequests: { $elemMatch: { status: 'pending' } } },
      ],
    });

    for (const course of courses) {
      await removeEnrollmentSummaryTodos(course, Todo);
      await syncEnrollmentAttentionTodo(course, Todo);
    }
  } catch (err) {
    console.error('Error migrating existing notifications:', err);
  }
}

// Route to migrate existing notifications (for testing - can be removed later)
router.post('/migrate-notifications', protect, authorize('admin'), async (req, res) => {
  try {
    const Todo = require('../models/todo.model');
    await Todo.deleteMany({ type: 'enrollment_summary' });
    await migrateExistingNotifications();
    res.json({ success: true, message: 'Notifications migrated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Migration failed', error: err.message });
  }
});

// Announcements routes
router.get('/:courseId/announcements', protect, announcementController.getAnnouncementsByCourse);
router.post('/:courseId/announcements', protect, authorize('teacher', 'admin'), upload.array('attachments'), announcementController.createAnnouncement);

// Add route to get all modules for a course
router.get('/:courseId/modules', protect, getCourseModules);

// Add route to update overview configuration
router.put('/:id/overview-config', protect, authorize('teacher', 'admin'), updateOverviewConfig);

// Add route to update sidebar configuration
router.put('/:id/sidebar-config', protect, authorize('teacher', 'admin'), updateSidebarConfig);

// Enrollment approval/denial routes
router.post('/:courseId/enrollment/:studentId/approve', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const Todo = require('../models/todo.model');
    const Course = require('../models/course.model');
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Teachers can approve students even when course is full (capacity override)
    // No need to check course capacity for approval
    
    // Update todo status
    await Todo.findOneAndUpdate(
      { 
        courseId, 
        studentId, 
        type: 'enrollment_request',
        action: 'pending'
      },
      { action: 'approve' }
    );
    
    // Update enrollment request status in course
    await Course.findByIdAndUpdate(courseId, {
      $set: {
        'enrollmentRequests.$[elem].status': 'approved',
        'enrollmentRequests.$[elem].responseDate': new Date()
      },
      $push: { students: studentId }
    }, {
      arrayFilters: [{ 'elem.student': studentId }]
    });

    // If the student was waitlisted, remove them from waitlist and update positions
    const updatedCourse = await Course.findById(courseId);
    if (updatedCourse) {
      const waitlistIndex = updatedCourse.waitlist.findIndex(entry => entry.student.toString() === studentId);
      if (waitlistIndex !== -1) {
        // Remove from waitlist
        updatedCourse.waitlist.splice(waitlistIndex, 1);
        
        // Update positions for remaining waitlist students
        updatedCourse.waitlist.forEach((entry, index) => {
          entry.position = index + 1;
        });
        
        await updatedCourse.save();
      }
    }
    
    // Refresh instructor enrollment to-dos
    const freshCourse = await Course.findById(courseId);
    if (freshCourse) {
      await removeEnrollmentSummaryTodos(freshCourse, Todo);
      await syncEnrollmentAttentionTodo(freshCourse, Todo);
    }
    try {
      const { createNotification } = require('./notification.routes');
      const courseForMsg = freshCourse || updatedCourse;
      await createNotification(studentId, {
        type: 'enrollment',
        title: 'Enrollment Approved',
        message: `Your enrollment request for "${courseForMsg?.title || 'the course'}" has been approved.`,
        link: `/courses/${courseId}`,
        relatedId: courseId,
        relatedType: 'course',
        priority: 'high'
      });
    } catch (notifError) {
      console.error('Error creating enrollment approval notification:', notifError);
      // Don't fail the approval if notification fails
    }
    
    res.json({ success: true, message: 'Enrollment approved and student added to course' });
  } catch (err) {
    console.error('Enrollment approval error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while approving enrollment',
      error: err.message 
    });
  }
});

router.post('/:courseId/enrollment/:studentId/deny', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const Todo = require('../models/todo.model');
    const Course = require('../models/course.model');
    
    // Update todo status
    await Todo.findOneAndUpdate(
      { 
        courseId, 
        studentId, 
        type: 'enrollment_request',
        action: 'pending'
      },
      { action: 'deny' }
    );
    
    // Update enrollment request status in course
    await Course.findByIdAndUpdate(courseId, {
      $set: {
        'enrollmentRequests.$[elem].status': 'denied',
        'enrollmentRequests.$[elem].responseDate': new Date()
      }
    }, {
      arrayFilters: [{ 'elem.student': studentId }]
    });

    // If the student was waitlisted, remove them from waitlist and update positions
    const updatedCourse = await Course.findById(courseId);
    if (updatedCourse) {
      const waitlistIndex = updatedCourse.waitlist.findIndex(entry => entry.student.toString() === studentId);
      if (waitlistIndex !== -1) {
        // Remove from waitlist
        updatedCourse.waitlist.splice(waitlistIndex, 1);
        
        // Update positions for remaining waitlist students
        updatedCourse.waitlist.forEach((entry, index) => {
          entry.position = index + 1;
        });
        
        await updatedCourse.save();
      }
    }
    
    const freshCourse = await Course.findById(courseId);
    if (freshCourse) {
      await removeEnrollmentSummaryTodos(freshCourse, Todo);
      await syncEnrollmentAttentionTodo(freshCourse, Todo);
    }

    // Notify student about enrollment denial
    try {
      const { createNotification } = require('./notification.routes');
      const courseForMsg = freshCourse || updatedCourse;
      await createNotification(studentId, {
        type: 'enrollment',
        title: 'Enrollment Denied',
        message: `Your enrollment request for "${courseForMsg?.title || 'the course'}" has been denied.`,
        link: `/courses`,
        relatedId: courseId,
        relatedType: 'course',
        priority: 'medium'
      });
    } catch (notifError) {
      console.error('Error creating enrollment denial notification:', notifError);
      // Don't fail the denial if notification fails
    }
    
    res.json({ success: true, message: 'Enrollment denied' });
  } catch (err) {
    console.error('Enrollment denial error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while denying enrollment',
      error: err.message 
    });
  }
});

const courseStorageController = require('../controllers/courseStorage.controller');
router.get(
  '/:courseId/storage',
  protect,
  authorize('teacher', 'admin'),
  courseStorageController.getCourseStorage
);
router.post(
  '/:courseId/storage/recalculate',
  protect,
  authorize('teacher', 'admin'),
  courseStorageController.recalculateCourseStorage
);
router.post(
  '/:courseId/storage/zip',
  protect,
  authorize('teacher', 'admin'),
  courseStorageController.createCourseZip
);

module.exports = router; 