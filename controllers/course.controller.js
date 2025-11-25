const Course = require('../models/course.model');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Module = require('../models/module.model');
const Page = require('../models/page.model');

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

    const { title, description, gradeScale, catalog, defaultColor, semester } = req.body;
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
    
    // Validate semester term if provided
    if (defaultSemester.term) {
      const validTerms = ['Fall', 'Spring', 'Summer', 'Winter'];
      if (!validTerms.includes(defaultSemester.term)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid semester term. Must be one of: Fall, Spring, Summer, Winter'
        });
      }
    }
    
    // Validate semester year if provided
    if (defaultSemester.year && (defaultSemester.year < 2000 || defaultSemester.year > 2100)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester year. Must be between 2000 and 2100'
      });
    }
    
    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const course = await Course.create({
      title,
      description,
      instructor: userId,
      defaultColor: courseDefaultColor,
      semester: defaultSemester,
      ...(gradeScale ? { gradeScale } : {}),
      ...(catalog ? { catalog } : {})
    });

    res.status(201).json({
      success: true,
      data: course
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
exports.getCourses = async (req, res) => {
  try {
    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    let courses;
    if (req.user.role === 'admin') {
      // Admin can see all courses
      courses = await Course.find()
        .populate('instructor', 'firstName lastName email')
        .populate('students', 'firstName lastName email')
        .populate('enrollmentRequests.student', 'firstName lastName email');
    } else if (req.user.role === 'teacher') {
      // Teachers can see their own courses
      courses = await Course.find({ instructor: userId })
        .populate('instructor', 'firstName lastName email')
        .populate('students', 'firstName lastName email')
        .populate('enrollmentRequests.student', 'firstName lastName email');
    } else {
      // Students can see courses they're enrolled in
      courses = await Course.find({ students: userId, published: true })
        .populate('instructor', 'firstName lastName email')
        .populate('students', 'firstName lastName email')
        .populate('enrollmentRequests.student', 'firstName lastName email');
    }

    // Migration: Add default groups to courses that don't have them
    const defaultGroups = [
      { name: 'Projects', weight: 15 },
      { name: 'Homework', weight: 15 },
      { name: 'Exams', weight: 20 },
      { name: 'Quizzes', weight: 30 },
      { name: 'Participation', weight: 20 }
    ];

    const coursesToUpdate = courses.filter(course => !course.groups || course.groups.length === 0);
    if (coursesToUpdate.length > 0) {
      
      for (const course of coursesToUpdate) {
        course.groups = defaultGroups;
        await course.save();
      }
    }

    res.json({
      success: true,
      count: courses.length,
      data: courses
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
    

    // Migration: Add default groups if course has no groups
    if (!course.groups || course.groups.length === 0) {
      const defaultGroups = [
        { name: 'Projects', weight: 15 },
        { name: 'Homework', weight: 15 },
        { name: 'Exams', weight: 20 },
        { name: 'Quizzes', weight: 30 },
        { name: 'Participation', weight: 20 }
      ];
      
      course.groups = defaultGroups;
      await course.save();
    }

    // All authenticated users can view course details
    // This allows students to see course information before enrolling
    // Teachers and admins can always view courses

    res.json({
      success: true,
      data: course
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

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== 'admin' && (!course.instructor || course.instructor.toString() !== userId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    // Only allow updating gradeScale if provided
    const updateFields = { ...req.body };
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

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Assign current user as instructor if they are a teacher
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only teachers can be assigned as instructors' 
      });
    }

    course.instructor = userId;
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

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if ((!course.instructor || course.instructor.toString() !== userId.toString()) && req.user.role !== 'admin') {
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
// @access  Private (Admin only)
exports.deleteCourse = async (req, res) => {
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

    await course.deleteOne();

    res.json({
      success: true,
      data: {}
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

    // Validate user ID for authorization
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check authorization - only admin, teacher (instructor), or the student themselves can enroll
    if (req.user.role !== 'admin' && 
        (!course.instructor || course.instructor.toString() !== userId.toString()) &&
        studentId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to enroll students in this course'
      });
    }

    // Check if student is already enrolled (use proper ObjectId comparison)
    const isEnrolled = course.students.some(student => student.toString() === studentId.toString());
    if (isEnrolled) {
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
  try {
    // Validate courseId
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    // Validate studentId
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    // Validate user ID for authorization
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check authorization - only admin, teacher (instructor), or the student themselves can unenroll
    if (req.user.role !== 'admin' && 
        (!course.instructor || course.instructor.toString() !== userId.toString()) &&
        studentId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unenroll students from this course'
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
        
        if (promotedUser && course.instructor) {
          await Todo.create({
            title: `Student ${promotedUser.firstName} ${promotedUser.lastName} has been promoted from waitlist to "${course.title}"`,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            user: course.instructor._id || course.instructor,
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

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user has access to the course
    if (req.user.role === 'student' && 
        !course.students.some(student => student.toString() === userId.toString()) &&
        (!course.instructor || course.instructor.toString() !== userId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this course'
      });
    }

    const modules = await Module.find({ course: courseId });
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

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== 'admin' && (!course.instructor || course.instructor.toString() !== userId.toString())) {
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

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== 'admin' && (!course.instructor || course.instructor.toString() !== userId.toString())) {
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
        'overview', 'modules', 'pages', 'assignments', 'quizzes', 'discussions',
        'announcements', 'polls', 'groups', 'attendance', 'grades',
        'gradebook', 'students'
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