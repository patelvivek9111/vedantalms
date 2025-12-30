const Module = require('../models/module.model');
const Course = require('../models/course.model');
const Page = require('../models/page.model');
const Assignment = require('../models/Assignment');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, ForbiddenError, sendErrorResponse, asyncHandler } = require('../utils/errorHandler');

// @desc    Create a module
// @route   POST /api/modules
// @access  Private (Teacher/Admin)
exports.createModule = asyncHandler(async (req, res) => {
  const { title, description, course } = req.body;

  // Validate required fields
  if (!title || !title.trim()) {
    return sendErrorResponse(res, new ValidationError('Title is required'), { action: 'createModule' });
  }
  if (!course) {
    return sendErrorResponse(res, new ValidationError('Course is required'), { action: 'createModule' });
  }

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(course)) {
    return sendErrorResponse(res, new ValidationError('Invalid course ID format'), { action: 'createModule' });
  }

  // Check if course exists
  const courseDoc = await Course.findById(course);
  if (!courseDoc) {
    return sendErrorResponse(res, new NotFoundError('Course not found'), { action: 'createModule' });
  }

  // Check authorization - only instructor or admin can create modules
  const userId = req.user._id || req.user.id;
  if (req.user.role !== 'admin' && (!courseDoc.instructor || courseDoc.instructor.toString() !== userId.toString())) {
    return sendErrorResponse(res, new ForbiddenError('Not authorized to create modules for this course'), { action: 'createModule' });
  }

  // Create module
  const module = await Module.create({
    title: title.trim(),
    description: description ? description.trim() : '',
    course
  });

  res.status(201).json({
    success: true,
    data: module
  });
});

// @desc    Get all modules for a course
// @route   GET /api/modules/:courseId
// @access  Private
exports.getModulesByCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return sendErrorResponse(res, new ValidationError('Invalid course ID format'), { action: 'getModulesByCourse' });
  }

  // Check if course exists
  const course = await Course.findById(courseId);
  if (!course) {
    return sendErrorResponse(res, new NotFoundError('Course not found'), { action: 'getModulesByCourse' });
  }

  // Check authorization
  const userId = req.user._id || req.user.id;
  const isStudent = req.user.role === 'student';
  
  if (isStudent) {
    // Students can only see modules if they're enrolled and course is published
    if (!course.published) {
      return res.json({
        success: true,
        data: []
      });
    }
    const isEnrolled = course.students.some(student => student.toString() === userId.toString());
    if (!isEnrolled && (!course.instructor || course.instructor.toString() !== userId.toString())) {
      return sendErrorResponse(res, new ForbiddenError('Not authorized to access this course'), { action: 'getModulesByCourse' });
    }
  } else if (req.user.role !== 'admin') {
    // Teachers can only see modules for their own courses
    if (!course.instructor || course.instructor.toString() !== userId.toString()) {
      return sendErrorResponse(res, new ForbiddenError('Not authorized to access this course'), { action: 'getModulesByCourse' });
    }
  }

  // Get modules
  let modules = await Module.find({ course: courseId })
    .populate('pages')
    .sort({ createdAt: 1 });

  // Filter published modules for students
  if (isStudent) {
    modules = modules.filter(module => module.published);
  }

  res.json({
    success: true,
    data: modules
  });
});

// @desc    Get a single module by ID
// @route   GET /api/modules/view/:id
// @access  Private
exports.getModuleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate module ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendErrorResponse(res, new ValidationError('Invalid module ID format'), { action: 'getModuleById' });
  }

  // Get module with pages
  const module = await Module.findById(id)
    .populate('pages')
    .populate('course', 'title instructor students published');

  if (!module) {
    return sendErrorResponse(res, new NotFoundError('Module not found'), { action: 'getModuleById' });
  }

  // Check authorization
  const course = module.course;
  const userId = req.user._id || req.user.id;
  const isStudent = req.user.role === 'student';

  if (isStudent) {
    // Students can only see published modules if they're enrolled
    if (!module.published || !course.published) {
      return sendErrorResponse(res, new NotFoundError('Module not found'), { action: 'getModuleById' });
    }
    const isEnrolled = course.students.some(student => student.toString() === userId.toString());
    if (!isEnrolled && (!course.instructor || course.instructor.toString() !== userId.toString())) {
      return sendErrorResponse(res, new ForbiddenError('Not authorized to access this module'), { action: 'getModuleById' });
    }
  } else if (req.user.role !== 'admin') {
    // Teachers can only see modules for their own courses
    if (!course.instructor || course.instructor.toString() !== userId.toString()) {
      return sendErrorResponse(res, new ForbiddenError('Not authorized to access this module'), { action: 'getModuleById' });
    }
  }

  res.json({
    success: true,
    data: module
  });
});

// @desc    Update a module
// @route   PUT /api/modules/:id
// @access  Private (Teacher/Admin)
exports.updateModule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  // Validate module ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendErrorResponse(res, new ValidationError('Invalid module ID format'), { action: 'updateModule' });
  }

  // Validate required fields
  if (title !== undefined && (!title || !title.trim())) {
    return sendErrorResponse(res, new ValidationError('Title cannot be empty'), { action: 'updateModule' });
  }

  // Get module
  const module = await Module.findById(id).populate('course', 'instructor');

  if (!module) {
    return sendErrorResponse(res, new NotFoundError('Module not found'), { action: 'updateModule' });
  }

  // Check authorization
  const course = module.course;
  const userId = req.user._id || req.user.id;
  if (req.user.role !== 'admin' && (!course.instructor || course.instructor.toString() !== userId.toString())) {
    return sendErrorResponse(res, new ForbiddenError('Not authorized to update this module'), { action: 'updateModule' });
  }

  // Update module
  if (title !== undefined) module.title = title.trim();
  if (description !== undefined) module.description = description ? description.trim() : '';

  await module.save();

  res.json({
    success: true,
    data: module
  });
});

// @desc    Delete a module
// @route   DELETE /api/modules/:id
// @access  Private (Teacher/Admin)
exports.deleteModule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate module ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendErrorResponse(res, new ValidationError('Invalid module ID format'), { action: 'deleteModule' });
  }

  // Get module
  const module = await Module.findById(id).populate('course', 'instructor');

  if (!module) {
    return sendErrorResponse(res, new NotFoundError('Module not found'), { action: 'deleteModule' });
  }

  // Check authorization
  const course = module.course;
  const userId = req.user._id || req.user.id;
  if (req.user.role !== 'admin' && (!course.instructor || course.instructor.toString() !== userId.toString())) {
    return sendErrorResponse(res, new ForbiddenError('Not authorized to delete this module'), { action: 'deleteModule' });
  }

  // Delete associated pages
  await Page.deleteMany({ module: id });

  // Delete associated assignments
  await Assignment.deleteMany({ module: id });

  // Delete module
  await module.deleteOne();

  res.json({
    success: true,
    message: 'Module deleted successfully'
  });
});

// @desc    Toggle module publish status
// @route   PATCH /api/modules/:id/publish
// @access  Private (Teacher/Admin)
exports.toggleModulePublish = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate module ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendErrorResponse(res, new ValidationError('Invalid module ID format'), { action: 'toggleModulePublish' });
  }

  // Get module
  const module = await Module.findById(id).populate('course', 'instructor published');

  if (!module) {
    return sendErrorResponse(res, new NotFoundError('Module not found'), { action: 'toggleModulePublish' });
  }

  // Check authorization
  const course = module.course;
  const userId = req.user._id || req.user.id;
  if (req.user.role !== 'admin' && (!course.instructor || course.instructor.toString() !== userId.toString())) {
    return sendErrorResponse(res, new ForbiddenError('Not authorized to publish/unpublish this module'), { action: 'toggleModulePublish' });
  }

  // Can't publish module if course is not published
  if (!module.published && !course.published) {
    return sendErrorResponse(res, new ValidationError('Cannot publish module when course is not published'), { action: 'toggleModulePublish' });
  }

  // Toggle publish status
  module.published = !module.published;
  await module.save();

  res.json({
    success: true,
    data: module,
    published: module.published
  });
});

