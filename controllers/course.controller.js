const Course = require('../models/course.model');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const {
  notifyCoursePublished,
  notifyCourseUnpublished,
} = require('../services/notification/academicNotificationProducers.service');

// Earthy tone color palette for course cards
const earthyColors = [
  '#556B2F', // Olive Green
  '#9CAF88', // Sage Green
  '#E2725B', // Terra Cotta
  '#8B4513', // Warm Brown
  '#606C38', // Moss Green
  '#D2691E', // Clay Brown
  '#228B22', // Forest Green
  '#CD5C5C', // Earth Red
  '#F4A460', // Sand Beige
  '#654321'  // Deep Brown
];

// Function to get a random color from the palette
const getRandomColor = () => {
  const randomIndex = Math.floor(Math.random() * earthyColors.length);
  return earthyColors[randomIndex];
};

// @desc    Create a course
// @route   POST /api/courses
// @access  Private (Teacher/Admin)
exports.createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }

    const { title, description, gradeScale, catalog, defaultColor, semester, scheduleType, academicYearLabel } =
      req.body;
    if (gradeScale) {
      const validationError = validateGradeScale(gradeScale);
      if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
      }
    }
    
    // Assign a random color if defaultColor is not provided
    const courseDefaultColor = defaultColor || getRandomColor();
    
    // Set default semester if not provided
    // Determine current semester based on month
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11 (Jan = 0, Dec = 11)
    const currentYear = now.getFullYear();
    
    let defaultSemester = semester;
    if (!defaultSemester || !defaultSemester.term || !defaultSemester.year) {
      // Default to current semester based on month
      // Fall: Aug-Nov (months 7-10), Spring: Jan-May (months 0-4), Summer: Jun-Jul (months 5-6), Winter: Dec (month 11)
      let term = 'Fall';
      let year = currentYear;
      
      if (currentMonth >= 0 && currentMonth <= 4) {
        term = 'Spring';
      } else if (currentMonth >= 5 && currentMonth <= 6) {
        term = 'Summer';
      } else if (currentMonth === 11) {
        term = 'Winter';
      } else {
        term = 'Fall';
      }
      
      defaultSemester = { term, year };
    }
    
    const validScheduleTypes = ['single_term', 'full_year', 'custom'];
    const resolvedScheduleType =
      scheduleType && validScheduleTypes.includes(scheduleType) ? scheduleType : 'single_term';

    const academicCalendarService = require('../services/academicCalendar.service');
    const academicSettings = await academicCalendarService.getAcademicSettings();
    const instDefaults = academicCalendarService.resolveDefaultsForNewCourse(
      academicSettings,
      resolvedScheduleType
    );

    const mergedCatalog = { ...(catalog || {}) };
    if (resolvedScheduleType === 'full_year' && instDefaults.startDate && !mergedCatalog.startDate) {
      mergedCatalog.startDate = new Date(instDefaults.startDate);
    }
    if (resolvedScheduleType === 'full_year' && instDefaults.endDate && !mergedCatalog.endDate) {
      mergedCatalog.endDate = new Date(instDefaults.endDate);
    }
    if (mergedCatalog.creditHours == null && instDefaults.creditHours != null) {
      mergedCatalog.creditHours = instDefaults.creditHours;
    }

    const finalSemester = semester?.term && semester?.year ? semester : instDefaults.semester;

    const course = await Course.create({
      title,
      description,
      instructor: req.user.id,
      defaultColor: courseDefaultColor,
      semester: finalSemester,
      scheduleType: resolvedScheduleType,
      academicYearLabel:
        academicYearLabel ||
        (resolvedScheduleType === 'full_year' ? instDefaults.academicYearLabel : null),
      ...(gradeScale ? { gradeScale } : {}),
      ...(Object.keys(mergedCatalog).length ? { catalog: mergedCatalog } : catalog ? { catalog } : {}),
    });

    if (resolvedScheduleType === 'full_year' && academicSettings.useInstitutionCalendar) {
      await academicCalendarService.applyInstitutionCalendarToCourse(
        course._id,
        req.user._id,
        academicSettings
      );
    }

    const refreshed = await Course.findById(course._id).lean();

    res.status(201).json({
      success: true,
      data: refreshed || course,
    });
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during course creation',
      error: err.message 
    });
  }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
const DEFAULT_COURSE_GROUPS = [
  { name: 'Projects', weight: 15 },
  { name: 'Homework', weight: 15 },
  { name: 'Exams', weight: 20 },
  { name: 'Quizzes', weight: 30 },
  { name: 'Participation', weight: 20 },
];

const COURSE_LIST_SELECT =
  'title description instructor students published operationalStatus defaultColor catalog semester scheduleType academicYearLabel groups createdAt updatedAt enrollmentRequests enrollmentQrToken';

function toCourseListSummary(course, user) {
  const o = { ...course };
  o.studentCount = Array.isArray(o.students) ? o.students.length : 0;
  // IDs only on list — full roster via GET /api/courses/:id
  o.students = Array.isArray(o.students) ? o.students.map((s) => String(s._id || s)) : [];
  if (!o.groups || o.groups.length === 0) {
    o.groups = DEFAULT_COURSE_GROUPS;
  }
  const showEnrollmentQr =
    user.role === 'admin' ||
    (user.role === 'teacher' && String(o.instructor?._id || o.instructor) === String(user.id));
  if (!showEnrollmentQr) {
    delete o.enrollmentQrToken;
  }
  return o;
}

exports.getCourses = async (req, res) => {
  try {
    let query;
    if (req.user.role === 'admin') {
      query = Course.find();
    } else if (req.user.role === 'teacher') {
      query = Course.find({ instructor: req.user.id });
    } else {
      query = Course.find({ students: req.user.id, published: true });
    }

    const populate = [
      { path: 'instructor', select: 'firstName lastName email' },
    ];
    if (req.user.role === 'admin' || req.user.role === 'teacher') {
      populate.push({ path: 'enrollmentRequests.student', select: 'firstName lastName email' });
    }

    const courses = await query.select(COURSE_LIST_SELECT).populate(populate).lean();

    res.json({
      success: true,
      count: courses.length,
      data: courses.map((course) => toCourseListSummary(course, req.user)),
    });
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching courses',
      error: err.message 
    });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Private
exports.getCourse = async (req, res) => {
  try {
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(req.params.id)
      .populate('instructor', 'firstName lastName email profilePicture')
      .populate('students', 'firstName lastName email profilePicture')
      .populate('enrollmentRequests.student', 'firstName lastName email profilePicture')
      .populate('waitlist.student', 'firstName lastName email profilePicture');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    

    const defaultGroups = [
      { name: 'Projects', weight: 15 },
      { name: 'Homework', weight: 15 },
      { name: 'Exams', weight: 20 },
      { name: 'Quizzes', weight: 30 },
      { name: 'Participation', weight: 20 }
    ];

    const data = typeof course.toObject === 'function' ? course.toObject() : { ...course };
    if (!data.groups || data.groups.length === 0) {
      data.groups = defaultGroups;
    }
    const isInstructorOrAdmin =
      req.user.role === 'admin' || course.instructor.toString() === req.user.id;
    if (!isInstructorOrAdmin) {
      delete data.enrollmentQrToken;
    }

    res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching course',
      error: err.message 
    });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Teacher/Admin)
exports.updateCourse = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    const updateFields = { ...req.body };
    const syllabusFilesService = require('../services/syllabusFiles.service');

    if (updateFields.catalog) {
      const catalogPatch = { ...updateFields.catalog };
      const fileAssetIds = catalogPatch.syllabusFileAssetIds || catalogPatch.fileAssetIds;
      const removeIds = catalogPatch.removeSyllabusFileAssetIds || catalogPatch.removeFileAssetIds;
      if (fileAssetIds?.length || removeIds?.length) {
        let ids = fileAssetIds;
        if (typeof ids === 'string') {
          try {
            ids = JSON.parse(ids);
          } catch {
            ids = [];
          }
        }
        let removeFileAssetIds = removeIds;
        if (typeof removeFileAssetIds === 'string') {
          try {
            removeFileAssetIds = JSON.parse(removeFileAssetIds);
          } catch {
            removeFileAssetIds = [];
          }
        }
        await syllabusFilesService.applySyllabusFileAssets(course, {
          fileAssetIds: Array.isArray(ids) ? ids.map(String) : [],
          removeFileAssetIds: Array.isArray(removeFileAssetIds) ? removeFileAssetIds.map(String) : [],
          user: req.user,
          audit: { ip: req.ip, requestId: req.requestId },
        });
        delete catalogPatch.syllabusFileAssetIds;
        delete catalogPatch.removeSyllabusFileAssetIds;
        delete catalogPatch.fileAssetIds;
        delete catalogPatch.removeFileAssetIds;
        // applySyllabusFileAssets is the source of truth for syllabusFiles here;
        // always take its result so a client-sent (possibly empty) syllabusFiles
        // array can't clobber the freshly-attached entries.
        catalogPatch.syllabusFiles = course.catalog?.syllabusFiles || [];
      }
      updateFields.catalog = catalogPatch;
    }

    // Only allow updating gradeScale if provided
    if (req.body.gradeScale) {
      try {
        const validationError = validateGradeScale(req.body.gradeScale);
        if (validationError) {
          return res.status(400).json({ success: false, message: validationError });
        }
        updateFields.gradeScale = req.body.gradeScale;
      } catch (err) {
        console.error('Grade scale validation error:', err);
        return res.status(400).json({ success: false, message: 'Invalid grade scale format.' });
      }
    }

    if (req.body.groups) {
      const assignmentGroupService = require('../services/assignmentGroup.service');
      updateFields.groups = assignmentGroupService.normalizeGroups(req.body.groups, course.groups || []);
    }

    try {
      course = await Course.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true, runValidators: true }
      ).populate('instructor', 'firstName lastName email')
       .populate('students', 'firstName lastName email');
    } catch (err) {
      console.error('Course update error:', err);
      return res.status(400).json({ success: false, message: 'Failed to update course. Check your data.' });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating course',
      error: err.message 
    });
  }
};

// @desc    Assign instructor to course (for courses without instructor)
// @route   PATCH /api/courses/:id/assign-instructor
// @access  Private (Teacher/Admin)
exports.assignInstructor = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if course already has an instructor
    if (course.instructor) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course already has an instructor assigned' 
      });
    }

    // Assign current user as instructor if they are a teacher
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only teachers can be assigned as instructors' 
      });
    }

    course.instructor = req.user.id;
    await course.save();

    const updatedCourse = await Course.findById(req.params.id)
      .populate('instructor', 'firstName lastName email')
      .populate('students', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Instructor assigned successfully',
      data: updatedCourse
    });
  } catch (err) {
    console.error('Assign instructor error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while assigning instructor',
      error: err.message 
    });
  }
};

// @desc    Publish/Unpublish a course
// @route   PATCH /api/courses/:id/publish
// @access  Private (Teacher/Admin)
exports.publishCourse = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to publish this course' });
    }

    const wasPublished = course.published;
    const willBePublished = !wasPublished;

    // If unpublishing: save current published states and unpublish everything
    if (wasPublished && !willBePublished) {
      // Get all modules for this course
      const modules = await Module.find({ course: course._id });
      const moduleIds = modules.map(m => m._id);
      
      // Get all pages for these modules
      const pages = await Page.find({ module: { $in: moduleIds } });
      
      // Get all assignments for these modules
      const Assignment = require('../models/Assignment');
      const assignments = await Assignment.find({ module: { $in: moduleIds } });
      
      // Get all threads for this course
      const Thread = require('../models/thread.model');
      const threads = await Thread.find({ course: course._id });
      
      // Save the current published states BEFORE unpublishing
      const snapshot = {
        modules: modules.map(m => ({
          moduleId: m._id,
          published: m.published || false
        })),
        pages: pages.map(p => ({
          pageId: p._id,
          published: p.published || false
        })),
        assignments: assignments.map(a => ({
          assignmentId: a._id,
          published: a.published || false
        })),
        threads: threads.map(t => ({
          threadId: t._id,
          published: t.published !== undefined ? t.published : true
        }))
      };
      
      // Save snapshot to course FIRST (before unpublishing)
      course.publishedStateSnapshot = snapshot;
      await course.save();
      
      // Now unpublish everything
      course.published = false;
      
      // Unpublish all modules
      await Module.updateMany(
        { course: course._id },
        { published: false }
      );
      
      // Unpublish all pages
      await Page.updateMany(
        { module: { $in: moduleIds } },
        { published: false }
      );
      
      // Unpublish all assignments
      await Assignment.updateMany(
        { module: { $in: moduleIds } },
        { published: false }
      );
      
      // Unpublish all threads
      await Thread.updateMany(
        { course: course._id },
        { published: false }
      );
      
    } else if (!wasPublished && willBePublished) {
      // If republishing: restore saved published states
      course.published = true;
      
      if (course.publishedStateSnapshot) {
        const snapshot = course.publishedStateSnapshot;
        const Assignment = require('../models/Assignment');
        const Thread = require('../models/thread.model');
        
        // Restore module published states
        if (snapshot.modules && snapshot.modules.length > 0) {
          for (const moduleState of snapshot.modules) {
            try {
              const moduleExists = await Module.findById(moduleState.moduleId);
              if (moduleExists) {
                await Module.findByIdAndUpdate(
                  moduleState.moduleId,
                  { published: moduleState.published !== undefined ? moduleState.published : false },
                  { runValidators: false }
                );
              }
            } catch (err) {
              console.error(`Error restoring module ${moduleState.moduleId}:`, err);
            }
          }
        }
        
        // Restore page published states
        if (snapshot.pages && snapshot.pages.length > 0) {
          for (const pageState of snapshot.pages) {
            try {
              const pageExists = await Page.findById(pageState.pageId);
              if (pageExists) {
                await Page.findByIdAndUpdate(
                  pageState.pageId,
                  { published: pageState.published !== undefined ? pageState.published : false },
                  { runValidators: false }
                );
              }
            } catch (err) {
              console.error(`Error restoring page ${pageState.pageId}:`, err);
            }
          }
        }
        
        // Restore assignment published states
        if (snapshot.assignments && snapshot.assignments.length > 0) {
          for (const assignmentState of snapshot.assignments) {
            try {
              const assignmentExists = await Assignment.findById(assignmentState.assignmentId);
              if (assignmentExists) {
                await Assignment.findByIdAndUpdate(
                  assignmentState.assignmentId,
                  { published: assignmentState.published !== undefined ? assignmentState.published : false },
                  { runValidators: false }
                );
              }
            } catch (err) {
              console.error(`Error restoring assignment ${assignmentState.assignmentId}:`, err);
            }
          }
        }
        
        // Restore thread published states
        if (snapshot.threads && snapshot.threads.length > 0) {
          for (const threadState of snapshot.threads) {
            try {
              const threadExists = await Thread.findById(threadState.threadId);
              if (threadExists) {
                await Thread.findByIdAndUpdate(
                  threadState.threadId,
                  { published: threadState.published !== undefined ? threadState.published : true },
                  { runValidators: false }
                );
              }
            } catch (err) {
              console.error(`Error restoring thread ${threadState.threadId}:`, err);
            }
          }
        }
      }
      // Clear the snapshot after restoring (optional - you can keep it if you want)
      // course.publishedStateSnapshot = null;
    }

    await course.save();
    const updatedCourse = await Course.findById(req.params.id);

    if (!wasPublished && willBePublished) {
      notifyCoursePublished({
        course: updatedCourse,
        actor: req.user,
        requestId: req.id,
      }).catch((err) => console.error('course.published notification error:', err));
    } else if (wasPublished && !willBePublished) {
      notifyCourseUnpublished({
        course: updatedCourse,
        actor: req.user,
        requestId: req.id,
      }).catch((err) => console.error('course.unpublished notification error:', err));
    }

    res.json({
      success: true,
      published: updatedCourse.published
    });
  } catch (err) {
    console.error('Publish course error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Course instructor or Admin)
exports.deleteCourse = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(req.params.id).select('instructor');
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course',
      });
    }

    const { deleteCourseAndRelatedData } = require('../services/courseDeleteCascade.service');
    const result = await deleteCourseAndRelatedData(req.params.id);

    if (!result.ok) {
      if (result.reason === 'invalid_course_id') {
        return res.status(400).json({
          success: false,
          message: 'Invalid course ID format',
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting course',
      error: err.message 
    });
  }
};

// @desc    Enroll student in course
// @route   POST /api/courses/:id/enroll
// @access  Private (Admin/Teacher)
exports.enrollStudent = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const { studentId } = req.body;
    
    // Validate studentId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if student is already enrolled
    if (course.students.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Student is already enrolled in this course'
      });
    }

    // Add student to course
    course.students.push(studentId);
    await course.save();

    // Populate the updated course data
    const updatedCourse = await Course.findById(course._id)
      .populate('instructor', 'firstName lastName email')
      .populate('students', 'firstName lastName email');

    res.json({
      success: true,
      data: updatedCourse
    });
  } catch (err) {
    console.error('Enroll student error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while enrolling student',
      error: err.message 
    });
  }
};

// @desc    Unenroll student from course
// @route   DELETE /api/courses/:courseId/unenroll
// @access  Private (Admin/Teacher)
exports.unenrollStudent = async (req, res) => {
  
  const { courseId } = req.params;
  const { studentId } = req.body;
  try {
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
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
    
    // Populate the updated course data
    const updatedCourse = await Course.findById(course._id)
      .populate('instructor', 'firstName lastName email')
      .populate('students', 'firstName lastName email')
      .populate('waitlist.student', 'firstName lastName email');
    
    res.json({ 
      success: true, 
      data: updatedCourse,
      message: 'Student unenrolled successfully' + (course.waitlist && course.waitlist.length > 0 ? '. A student has been promoted from the waitlist.' : '')
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Helper to validate gradeScale
function validateGradeScale(gradeScale) {
  if (!Array.isArray(gradeScale) || gradeScale.length === 0) {
    return 'Grade scale must be a non-empty array.';
  }
  for (let i = 0; i < gradeScale.length; i++) {
    const row = gradeScale[i];
    if (!row.letter || typeof row.letter !== 'string') return `Row ${i + 1}: Letter is required.`;
    if (typeof row.min !== 'number' || typeof row.max !== 'number') return `Row ${i + 1}: Min and Max must be numbers.`;
    if (row.min > row.max) return `Row ${i + 1}: Min must be less than or equal to Max.`;
    if (!Number.isInteger(row.min) || !Number.isInteger(row.max)) return `Row ${i + 1}: Min and Max must be whole numbers.`;
  }
  // Check for contiguous, non-overlapping, whole-number ranges
  const sorted = [...gradeScale].sort((a, b) => b.max - a.max);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].max !== sorted[i - 1].min - 1) {
      return `Rows ${i} and ${i + 1}: Ranges must be contiguous whole numbers (e.g., max of one is min-1 of next).`;
    }
  }
  const letters = gradeScale.map(r => r.letter);
  if (new Set(letters).size !== letters.length) return 'Duplicate letter grades are not allowed.';
  return null;
}

exports.getCourseModules = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    // Check if course exists and user has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to the course
    if (req.user.role === 'student' && 
        !course.students.some(student => student.toString() === req.user.id) &&
        course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this course'
      });
    }

    const modules = await Module.find({ course: courseId }).sort({ createdAt: 1 });
    res.json({
      success: true,
      data: modules
    });
  } catch (err) {
    console.error('Get course modules error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching course modules',
      error: err.message 
    });
  }
};

// @desc    Update course overview configuration
// @route   PUT /api/courses/:id/overview-config
// @access  Private (Teacher/Admin)
exports.updateOverviewConfig = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    const { showLatestAnnouncements, numberOfAnnouncements } = req.body;

    // Validate numberOfAnnouncements if provided
    if (numberOfAnnouncements !== undefined) {
      if (!Number.isInteger(numberOfAnnouncements) || numberOfAnnouncements < 1 || numberOfAnnouncements > 10) {
        return res.status(400).json({
          success: false,
          message: 'Number of announcements must be between 1 and 10'
        });
      }
    }

    // Update the overview configuration
    const updateData = {};
    if (showLatestAnnouncements !== undefined) {
      updateData['overviewConfig.showLatestAnnouncements'] = showLatestAnnouncements;
    }
    if (numberOfAnnouncements !== undefined) {
      updateData['overviewConfig.numberOfAnnouncements'] = numberOfAnnouncements;
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('instructor', 'firstName lastName email')
     .populate('students', 'firstName lastName email');

    res.json({
      success: true,
      data: updatedCourse
    });
  } catch (err) {
    console.error('Update overview config error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating overview configuration',
      error: err.message 
    });
  }
}; 

// @desc    Update course sidebar configuration
// @route   PUT /api/courses/:id/sidebar-config
// @access  Private (Teacher/Admin)
exports.updateSidebarConfig = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    const { items, studentVisibility } = req.body;

    // Validate items if provided
    if (items) {
      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          message: 'Items must be an array'
        });
      }

      // Validate each item
      for (const item of items) {
        if (!item.id || !item.label || typeof item.visible !== 'boolean' || typeof item.order !== 'number') {
          return res.status(400).json({
            success: false,
            message: 'Each item must have id, label, visible (boolean), and order (number)'
          });
        }
      }

      // Check for duplicate orders
      const orders = items.map(item => item.order);
      if (new Set(orders).size !== orders.length) {
        return res.status(400).json({
          success: false,
          message: 'Item orders must be unique'
        });
      }
    }

    // Validate studentVisibility if provided
    if (studentVisibility) {
      const validKeys = [
        'overview',
        'syllabus',
        'modules',
        'pages',
        'assignments',
        'quizzes',
        'quizwave',
        'discussions',
        'announcements',
        'polls',
        'groups',
        'meetings',
        'attendance',
        'grades',
        'gradebook',
        'students',
      ];

      for (const key of Object.keys(studentVisibility)) {
        if (!validKeys.includes(key)) {
          return res.status(400).json({
            success: false,
            message: `Invalid key in studentVisibility: ${key}`
          });
        }
        if (typeof studentVisibility[key] !== 'boolean') {
          return res.status(400).json({
            success: false,
            message: `studentVisibility.${key} must be a boolean`
          });
        }
      }
    }

    // Update the sidebar configuration
    const updateData = {};
    if (items) {
      updateData['sidebarConfig.items'] = items;
    }
    if (studentVisibility) {
      updateData['sidebarConfig.studentVisibility'] = studentVisibility;
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('instructor', 'firstName lastName email')
     .populate('students', 'firstName lastName email');

    res.json({
      success: true,
      data: updatedCourse
    });
  } catch (err) {
    console.error('Update sidebar config error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating sidebar configuration',
      error: err.message 
    });
  }
};

const courseCopyService = require('../services/courseCopy.service');
const { enqueueJob } = require('../services/jobQueue.service');

exports.copyCourse = async (req, res) => {
  try {
    const { targetTitle, includeAnnouncements, includeDiscussions, async: runAsync } = req.body;
    const sourceId = req.params.id;

    if (runAsync) {
      const { job } = await enqueueJob(
        'course.copy',
        { sourceCourseId: sourceId, targetTitle, includeAnnouncements, includeDiscussions },
        req.user
      );
      return res.status(202).json({ success: true, data: { jobId: job._id, async: true } });
    }

    const result = await courseCopyService.copyCourseContent(sourceId, {
      targetTitle,
      requestedBy: req.user,
      includeAnnouncements: includeAnnouncements !== false,
      includeDiscussions: includeDiscussions !== false,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.archiveCourse = async (req, res) => {
  try {
    const course = await courseCopyService.archiveCourse(req.params.id, req.user);
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.restoreCourse = async (req, res) => {
  try {
    const course = await courseCopyService.restoreCourse(req.params.id, req.user);
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.bulkCourseOperation = async (req, res) => {
  try {
    const { courseIds, operation, payload } = req.body;
    if (!Array.isArray(courseIds) || !courseIds.length) {
      return res.status(400).json({ success: false, message: 'courseIds required' });
    }
    const { job } = await enqueueJob(
      'course.bulk',
      { courseIds, operation, payload },
      req.user
    );
    res.status(202).json({ success: true, data: { jobId: job._id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};