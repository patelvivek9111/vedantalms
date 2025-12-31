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
    // Only allow teachers/admins to create modules for their courses
    if (req.user.role !== 'admin') {
      const foundCourse = await Course.findById(course);
      if (!foundCourse || foundCourse.instructor.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to add module to this course' });
      }
    }
    const module = await Module.create({ title, course, description });
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
    const module = await Module.findById(req.params.id);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
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
    const module = await Module.findById(req.params.id);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
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
    const course = await Course.findById(module.course);
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this module'
      });
    }

    // Update the module
    module.title = title;
    module.description = description;
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