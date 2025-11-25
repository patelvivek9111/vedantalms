const Module = require('../models/module.model');
const Course = require('../models/course.model');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// @desc    Create a module
// @route   POST /api/modules
// @access  Private (Teacher/Admin)
exports.createModule = async (req, res) => {
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
    const { title, course, description } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Validate course ID
    if (!course || !mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid course ID format' 
      });
    }
    
    // Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required and cannot be empty' 
      });
    }
    
    // Only allow teachers/admins to create modules for their courses
    if (req.user.role !== 'admin') {
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'User ID is required' 
        });
      }
      const foundCourse = await Course.findById(course);
      if (!foundCourse) {
        return res.status(404).json({ 
          success: false, 
          message: 'Course not found' 
        });
      }
      if (foundCourse.instructor.toString() !== userId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to add module to this course' 
        });
      }
    }
    const module = await Module.create({ 
      title: title.trim(), 
      course, 
      description: description ? description.trim() : description 
    });
    res.status(201).json({ success: true, data: module });
  } catch (err) {
    console.error('Create module error:', err);
    res.status(500).json({ success: false, message: 'Server error during module creation', error: err.message });
  }
};

// @desc    Get all modules for a course
// @route   GET /api/modules/:courseId
// @access  Private
exports.getModulesByCourse = async (req, res) => {
  try {
    // Validate if the courseId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const isStudent = req.user.role === 'student';
    const modules = await Module.find({
      course: req.params.courseId,
      ...(isStudent ? { published: true } : {})
    })
      .populate({
        path: 'pages',
        select: 'title content attachments createdAt updatedAt published'
      });
    res.json({ 
      success: true, 
      data: modules 
    });
  } catch (err) {
    console.error('Get modules error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching modules', 
      error: err.message 
    });
  }
};

// @desc    Get a single module by ID
// @route   GET /api/modules/view/:id
// @access  Private
exports.getModuleById = async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid module ID format'
      });
    }

    const module = await Module.findById(req.params.id)
      .populate('course', 'title')
      .populate({
        path: 'pages',
        select: 'title content attachments createdAt updatedAt'
      });

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    res.json({
      success: true,
      data: module
    });
  } catch (err) {
    console.error('Get module error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching module',
      error: err.message
    });
  }
};

// @desc    Delete a module
// @route   DELETE /api/modules/:id
// @access  Private (Teacher/Admin)
exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate module ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid module ID format' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ 
        success: false, 
        message: 'Module not found' 
      });
    }
    
    // Check authorization
    const course = await Course.findById(module.course);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }
    
    if (req.user.role !== 'admin' && course.instructor.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this module' 
      });
    }
    
    await module.deleteOne();
    res.json({ success: true, message: 'Module deleted' });
  } catch (err) {
    console.error('Delete module error:', err);
    res.status(500).json({ success: false, message: 'Server error during module deletion', error: err.message });
  }
};

// @desc    Toggle publish status of a module
// @route   PATCH /api/modules/:id/publish
// @access  Private (Teacher/Admin)
exports.toggleModulePublish = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate module ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid module ID format' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ 
        success: false, 
        message: 'Module not found' 
      });
    }
    
    // Check authorization
    const course = await Course.findById(module.course);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }
    
    if (req.user.role !== 'admin' && course.instructor.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to toggle publish status of this module' 
      });
    }
    
    module.published = !module.published;
    await module.save();
    res.json({ success: true, published: module.published });
  } catch (err) {
    console.error('Toggle module publish error:', err);
    res.status(500).json({ success: false, message: 'Server error during publish toggle', error: err.message });
  }
};

// @desc    Update a module
// @route   PUT /api/modules/:id
// @access  Private (Teacher/Admin)
exports.updateModule = async (req, res) => {
  try {
    const { title, description } = req.body;
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid module ID format'
      });
    }

    const module = await Module.findById(req.params.id);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Check if user is authorized to update
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const course = await Course.findById(module.course);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    if (req.user.role !== 'admin' && course.instructor.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this module'
      });
    }

    // Validate title if provided
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty'
        });
      }
      module.title = title.trim();
    }
    
    // Update description if provided
    if (description !== undefined) {
      module.description = description ? description.trim() : description;
    }
    
    await module.save();

    res.json({
      success: true,
      data: module
    });
  } catch (err) {
    console.error('Update module error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while updating module',
      error: err.message
    });
  }
}; 