const Course = require('../models/course.model');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, sendErrorResponse, asyncHandler } = require('../utils/errorHandler');

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
exports.createCourse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }));
      return sendErrorResponse(res, new ValidationError('Validation error', validationErrors), { action: 'createCourse' });
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
    // Let the global error handler deal with it
    next(err);
  }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
exports.getCourses = asyncHandler(async (req, res, next) => {
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
});

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Private
exports.getCourse = asyncHandler(async (req, res, next) => {
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
});

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
        logger.warn('Grade scale validation error', { error: err.message, courseId: req.params.id });
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
      logger.logError(err, { action: 'updateCourse', courseId: req.params.id });
      return res.status(400).json({ success: false, message: 'Failed to update course. Check your data.' });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (err) {
    logger.logError(err, { action: 'updateCourse', courseId: req.params.id });
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
    logger.logError(err, { action: 'assignInstructor', courseId: req.params.id });
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
    logger.info('publishCourse called', { courseId: req.params.id, userId: req.user?._id || req.user?.id });
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    let course = await Course.findById(req.params.id);

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
    
    logger.info('publishCourse state', { 
      courseId: req.params.id, 
      wasPublished, 
      willBePublished 
    });

    // If unpublishing: save current published states and unpublish everything
    if (wasPublished && !willBePublished) {
      // Get all modules for this course
      const modules = await Module.find({ course: course._id });
      const moduleIds = modules.map(m => m._id);
      
      // Get all pages for these modules (only if there are modules)
      const pages = moduleIds.length > 0 
        ? await Page.find({ module: { $in: moduleIds } })
        : [];
      
      // Get all assignments for these modules AND group assignments for this course
      const Assignment = require('../models/Assignment');
      const GroupSet = require('../models/GroupSet');
      
      // Get assignments that belong to modules in this course (only if there are modules)
      const moduleAssignments = moduleIds.length > 0
        ? await Assignment.find({ module: { $in: moduleIds } })
        : [];
      
      // Get group assignments that belong to this course (via groupSet)
      let groupSets = [];
      let groupSetIds = [];
      let groupAssignments = [];
      
      try {
        groupSets = await GroupSet.find({ course: course._id });
        groupSetIds = groupSets.map(gs => gs._id);
        
        if (groupSetIds.length > 0) {
          groupAssignments = await Assignment.find({ 
            isGroupAssignment: true, 
            groupSet: { $in: groupSetIds } 
          });
        }
      } catch (groupError) {
        logger.warn('Error finding group sets or assignments', { 
          courseId: course._id, 
          error: groupError.message,
          stack: groupError.stack 
        });
        // Continue without group assignments - don't fail the whole operation
        groupSets = [];
        groupSetIds = [];
        groupAssignments = [];
      }
      // Combine all assignments
      const assignments = [...moduleAssignments, ...groupAssignments];
      
      // Get all threads for this course
      const Thread = require('../models/thread.model');
      const threads = await Thread.find({ course: course._id });
      
      // Save the current published states BEFORE unpublishing
      // Helper function to safely convert to ObjectId
      const toObjectId = (id) => {
        if (!id) return null;
        if (id instanceof mongoose.Types.ObjectId) return id;
        if (mongoose.Types.ObjectId.isValid(id)) {
          return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
        }
        return null;
      };
      
      const snapshot = {
        modules: modules.map(m => ({
          moduleId: toObjectId(m._id),
          published: m.published || false
        })).filter(m => m.moduleId !== null),
        pages: pages.map(p => ({
          pageId: toObjectId(p._id),
          published: p.published || false
        })).filter(p => p.pageId !== null),
        assignments: assignments.map(a => ({
          assignmentId: toObjectId(a._id),
          published: a.published || false
        })).filter(a => a.assignmentId !== null),
        threads: threads.map(t => ({
          threadId: toObjectId(t._id),
          published: t.published !== undefined ? t.published : true
        })).filter(t => t.threadId !== null)
      };
      
      // Save snapshot to course FIRST (before unpublishing)
      // Skip validation since we're only updating published state, not catalog data
      try {
        // Ensure course._id is a proper ObjectId
        const courseObjectId = course._id instanceof mongoose.Types.ObjectId 
          ? course._id 
          : new mongoose.Types.ObjectId(course._id);
        
        // Use MongoDB collection directly to bypass Mongoose hooks
        const snapshotResult = await Course.collection.updateOne(
          { _id: courseObjectId },
          { $set: { publishedStateSnapshot: snapshot } }
        );
        
        logger.info('Snapshot saved', { 
          courseId: req.params.id,
          matchedCount: snapshotResult.matchedCount,
          modifiedCount: snapshotResult.modifiedCount
        });
        
        // Reload course to get updated snapshot
        course = await Course.findById(course._id);
        
        if (!course) {
          throw new Error('Course not found after saving snapshot');
        }
      } catch (saveError) {
        logger.logError(saveError, { 
          action: 'publishCourse - save snapshot', 
          courseId: req.params.id,
          errorMessage: saveError.message,
          errorStack: saveError.stack
        });
        throw saveError;
      }
      
      // Now unpublish everything
      // Don't modify course.published directly - we'll update via findByIdAndUpdate
      
      // Unpublish all modules
      await Module.updateMany(
        { course: course._id },
        { published: false }
      );
      
      // Unpublish all pages (only if there are modules)
      if (moduleIds.length > 0) {
        await Page.updateMany(
          { module: { $in: moduleIds } },
          { published: false }
        );
      }
      
      // Unpublish all assignments (both module-based and group assignments)
      // Unpublish module-based assignments (only if there are modules)
      if (moduleIds.length > 0) {
        await Assignment.updateMany(
          { module: { $in: moduleIds } },
          { published: false }
        );
      }
      // Unpublish group assignments for this course
      if (groupSetIds.length > 0) {
        await Assignment.updateMany(
          { isGroupAssignment: true, groupSet: { $in: groupSetIds } },
          { published: false }
        );
      }
      
      // Unpublish all threads
      await Thread.updateMany(
        { course: course._id },
        { published: false }
      );
      
    } else if (!wasPublished && willBePublished) {
      // If republishing: restore saved published states
      logger.info('Publishing course - restoring snapshot', { courseId: req.params.id });
      
      let Assignment, Thread;
      try {
        Assignment = require('../models/Assignment');
        Thread = require('../models/thread.model');
      } catch (modelError) {
        logger.logError(modelError, { action: 'publishCourse - require models', courseId: req.params.id });
        throw new Error(`Failed to load required models: ${modelError.message}`);
      }
      
      // Helper function to safely convert to ObjectId for queries
      const toObjectIdForQuery = (id) => {
        if (!id) return null;
        if (id instanceof mongoose.Types.ObjectId) return id;
        if (mongoose.Types.ObjectId.isValid(id)) {
          return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
        }
        return null;
      };
      
      if (course.publishedStateSnapshot) {
        logger.info('Found snapshot, restoring states', { 
          courseId: req.params.id,
          modulesCount: course.publishedStateSnapshot.modules?.length || 0,
          pagesCount: course.publishedStateSnapshot.pages?.length || 0,
          assignmentsCount: course.publishedStateSnapshot.assignments?.length || 0,
          threadsCount: course.publishedStateSnapshot.threads?.length || 0
        });
        // Restore from saved snapshot
        const snapshot = course.publishedStateSnapshot;
        
        // Restore module published states
        if (snapshot.modules && snapshot.modules.length > 0) {
          for (const moduleState of snapshot.modules) {
            try {
              const moduleId = toObjectIdForQuery(moduleState.moduleId);
              if (!moduleId) {
                logger.warn('Invalid module ID in snapshot', { moduleId: moduleState.moduleId, courseId: req.params.id });
                continue;
              }
              const moduleExists = await Module.findById(moduleId);
              if (moduleExists) {
                await Module.findByIdAndUpdate(
                  moduleId,
                  { published: moduleState.published !== undefined ? moduleState.published : false },
                  { runValidators: false }
                );
              }
            } catch (err) {
              logger.warn('Error restoring module', { moduleId: moduleState.moduleId, courseId: req.params.id, error: err.message });
            }
          }
        }
        
        // Restore page published states
        if (snapshot.pages && snapshot.pages.length > 0) {
          for (const pageState of snapshot.pages) {
            try {
              const pageId = toObjectIdForQuery(pageState.pageId);
              if (!pageId) {
                logger.warn('Invalid page ID in snapshot', { pageId: pageState.pageId, courseId: req.params.id });
                continue;
              }
              const pageExists = await Page.findById(pageId);
              if (pageExists) {
                await Page.findByIdAndUpdate(
                  pageId,
                  { published: pageState.published !== undefined ? pageState.published : false },
                  { runValidators: false }
                );
              }
            } catch (err) {
              logger.warn('Error restoring page', { pageId: pageState.pageId, courseId: req.params.id, error: err.message });
            }
          }
        }
        
        // Restore assignment published states
        if (snapshot.assignments && snapshot.assignments.length > 0) {
          for (const assignmentState of snapshot.assignments) {
            try {
              const assignmentId = toObjectIdForQuery(assignmentState.assignmentId);
              if (!assignmentId) {
                logger.warn('Invalid assignment ID in snapshot', { assignmentId: assignmentState.assignmentId, courseId: req.params.id });
                continue;
              }
              const assignmentExists = await Assignment.findById(assignmentId);
              if (assignmentExists) {
                await Assignment.findByIdAndUpdate(
                  assignmentId,
                  { published: assignmentState.published !== undefined ? assignmentState.published : false },
                  { runValidators: false }
                );
              }
            } catch (err) {
              logger.warn('Error restoring assignment', { assignmentId: assignmentState.assignmentId, courseId: req.params.id, error: err.message });
            }
          }
        }
        
        // Restore thread published states
        if (snapshot.threads && snapshot.threads.length > 0) {
          for (const threadState of snapshot.threads) {
            try {
              const threadId = toObjectIdForQuery(threadState.threadId);
              if (!threadId) {
                logger.warn('Invalid thread ID in snapshot', { threadId: threadState.threadId, courseId: req.params.id });
                continue;
              }
              const threadExists = await Thread.findById(threadId);
              if (threadExists) {
                await Thread.findByIdAndUpdate(
                  threadId,
                  { published: threadState.published !== undefined ? threadState.published : true },
                  { runValidators: false }
                );
              }
            } catch (err) {
              logger.warn('Error restoring thread', { threadId: threadState.threadId, courseId: req.params.id, error: err.message });
            }
          }
        }
      } else {
        // No snapshot exists - this is a first-time publish
        // By default, don't auto-publish modules/pages/assignments/threads
        // They need to be published individually
        logger.info('Publishing course without snapshot (first time)', { courseId: req.params.id });
      }
      // Clear the snapshot after restoring (optional - you can keep it if you want)
      // course.publishedStateSnapshot = null;
    }

    try {
      logger.info('Saving course published state', { courseId: req.params.id, willBePublished });
      
      // Save without validating catalog fields (publishing doesn't change catalog data)
      // Use updateOne with runValidators: false to completely skip all validation hooks
      // Reload course to get latest snapshot if it was updated during unpublish
      const currentCourse = await Course.findById(course._id);
      
      if (!currentCourse) {
        throw new Error('Course not found after processing');
      }
      
      const updateData = {
        published: willBePublished
      };
      // Include snapshot if it exists (set during unpublish, or keep existing during publish)
      if (currentCourse.publishedStateSnapshot !== undefined) {
        updateData.publishedStateSnapshot = currentCourse.publishedStateSnapshot;
      }
      
      logger.info('Updating course in database', { courseId: req.params.id, updateData });
      
      // Ensure course._id is a proper ObjectId
      const courseObjectId = course._id instanceof mongoose.Types.ObjectId 
        ? course._id 
        : new mongoose.Types.ObjectId(course._id);
      
      let updateResult;
      try {
        // Use MongoDB collection directly to completely bypass Mongoose hooks and validation
        updateResult = await Course.collection.updateOne(
          { _id: courseObjectId },
          { $set: updateData }
        );
        
        logger.info('Course update result', { 
          courseId: req.params.id, 
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount 
        });
      } catch (updateError) {
        logger.logError(updateError, { 
          action: 'publishCourse - collection updateOne failed', 
          courseId: req.params.id,
          tryingFallback: true
        });
        
        // Fallback: Use Mongoose findByIdAndUpdate with runValidators: false
        logger.info('Trying fallback update method', { courseId: req.params.id });
        const fallbackUpdate = await Course.findByIdAndUpdate(
          courseObjectId,
          { $set: updateData },
          { new: true, runValidators: false }
        );
        
        if (!fallbackUpdate) {
          throw new Error('Course update failed with both methods');
        }
        
        logger.info('Fallback update successful', { courseId: req.params.id });
        const updatedCourse = await Course.findById(req.params.id);
        
        if (!updatedCourse) {
          throw new Error('Course not found after fallback update');
        }
        
        logger.info('Course published successfully (fallback)', { courseId: req.params.id, published: updatedCourse.published });

        return res.json({
          success: true,
          published: updatedCourse.published
        });
      }
      
      const updatedCourse = await Course.findById(req.params.id);
      
      if (!updatedCourse) {
        throw new Error('Course not found after update');
      }

      logger.info('Course published successfully', { courseId: req.params.id, published: updatedCourse.published });

      res.json({
        success: true,
        published: updatedCourse.published
      });
    } catch (saveError) {
      logger.logError(saveError, { 
        action: 'publishCourse - final save', 
        courseId: req.params.id,
        errorMessage: saveError.message,
        errorStack: saveError.stack,
        errorName: saveError.name
      });
      throw saveError;
    }
  } catch (err) {
    logger.logError(err, { 
      action: 'publishCourse', 
      courseId: req.params.id, 
      stack: err.stack,
      errorMessage: err.message,
      errorName: err.name,
      errorCode: err.code
    });
    
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error';
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error while publishing/unpublishing course', 
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        name: err.name 
      })
    });
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
    logger.logError(err, { action: 'deleteCourse', courseId: req.params.id });
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

    // Add student to course using findByIdAndUpdate to bypass catalog validation
    // We're only updating the students array, so we don't need to validate catalog fields
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $push: { students: studentId } },
      { new: true, runValidators: false }
    )
      .populate('instructor', 'firstName lastName email')
      .populate('students', 'firstName lastName email');

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not found after update'
      });
    }

    res.json({
      success: true,
      data: updatedCourse
    });
  } catch (err) {
    logger.logError(err, { action: 'enrollStudent', courseId: req.params.id });
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
    
    // Remove student from course and handle waitlist promotion
    const updatedStudents = course.students.filter(id => id.toString() !== studentId);
    let updatedWaitlist = course.waitlist || [];
    let waitlistPromoted = false;
    let promotedStudentId = null;
    
    // Check if there are students on the waitlist and promote the first one
    if (updatedWaitlist.length > 0) {
      try {
        const promotedStudent = updatedWaitlist.shift(); // Remove first student from waitlist
        promotedStudentId = promotedStudent.student;
        
        // Add them to the course
        updatedStudents.push(promotedStudentId);
        waitlistPromoted = true;
        
        // Update positions for remaining waitlist students
        updatedWaitlist = updatedWaitlist.map((waitlistEntry, index) => ({
          ...waitlistEntry.toObject ? waitlistEntry.toObject() : waitlistEntry,
          position: index + 1
        }));
        
        // Create todo notification for teacher about the promotion
        const Todo = require('../models/todo.model');
        const User = require('../models/user.model');
        
        const promotedUser = await User.findById(promotedStudentId).select('firstName lastName');
        
        if (promotedUser && course.instructor) {
          await Todo.create({
            title: `Student ${promotedUser.firstName} ${promotedUser.lastName} has been promoted from waitlist to "${course.title}"`,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            user: course.instructor._id || course.instructor,
            type: 'waitlist_promotion',
            courseId: course._id,
            studentId: promotedStudentId,
            action: 'completed'
          });
        }
      } catch (waitlistError) {
        logger.warn('Error during waitlist promotion', { courseId: courseId, error: waitlistError.message });
        // Continue with unenrollment even if waitlist promotion fails
      }
    }
    
    // Update course using findByIdAndUpdate to bypass catalog validation
    // We're only updating students and waitlist arrays, so we don't need to validate catalog fields
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { 
        $set: { 
          students: updatedStudents,
          waitlist: updatedWaitlist
        } 
      },
      { new: true, runValidators: false }
    )
      .populate('instructor', 'firstName lastName email')
      .populate('students', 'firstName lastName email')
      .populate('waitlist.student', 'firstName lastName email');
    
    if (!updatedCourse) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found after update' 
      });
    }
    
    res.json({ 
      success: true, 
      data: updatedCourse,
      message: 'Student unenrolled successfully' + (waitlistPromoted ? '. A student has been promoted from the waitlist.' : '')
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
    logger.logError(err, { action: 'getCourseModules', courseId: req.params.id });
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
    logger.logError(err, { action: 'updateOverviewConfig', courseId: req.params.id });
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
        'overview', 'syllabus', 'modules', 'pages', 'assignments', 'quizzes', 'discussions',
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
    logger.logError(err, { action: 'updateSidebarConfig', courseId: req.params.id });
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating sidebar configuration',
      error: err.message 
    });
  }
}; 