const Page = require('../models/page.model');
const Module = require('../models/module.model');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Course = require('../models/course.model');

// @desc    Create a page under a module
// @route   POST /api/pages
// @access  Private (Teacher/Admin)
exports.createPage = async (req, res) => {
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
    const { title, module, groupSet, content } = req.body;
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => `/uploads/${file.filename}`);
    }
    const pageData = { title, content, attachments };
    if (module) pageData.module = module;
    if (groupSet) pageData.groupSet = groupSet;
    const page = await Page.create(pageData);
    // Add page to module if module is present
    if (module) {
      await Module.findByIdAndUpdate(module, { $push: { pages: page._id } });
    }
    res.status(201).json({ success: true, data: page });
  } catch (err) {
    console.error('Create page error:', err);
    res.status(500).json({ success: false, message: 'Server error during page creation', error: err.message });
  }
};

// @desc    Get all pages in a module
// @route   GET /api/pages/:moduleId
// @access  Private
exports.getPagesByModule = async (req, res) => {
  try {
    const moduleId = req.params.moduleId;


    // Validate moduleId
    if (!moduleId || !mongoose.Types.ObjectId.isValid(moduleId)) {
      console.error('Invalid module ID:', moduleId);
      return res.status(400).json({
        success: false,
        message: 'Invalid module ID'
      });
    }

    // Check if module exists
    const module = await Module.findById(moduleId);
    if (!module) {
      console.error('Module not found:', moduleId);
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    const isStudent = req.user.role === 'student';
    let pages;
    if (isStudent) {
      if (!module.published) {
        pages = [];
      } else {
        // Return all pages, ignore page.published for students if module is published
        pages = await Page.find({ module: moduleId });
      }
    } else {
      // Teacher/admin: return all pages
      pages = await Page.find({ module: moduleId });
    }

    
    res.json({
      success: true,
      data: pages
    });
  } catch (err) {
    console.error('Get pages error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pages',
      error: err.message
    });
  }
};

// @desc    View a single page
// @route   GET /api/pages/view/:id
// @access  Private
exports.getPageById = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch (err) {
    console.error('Get page error:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching page', error: err.message });
  }
};

// @desc    Update a page
// @route   PUT /api/pages/:id
// @access  Private (Teacher/Admin)
exports.updatePage = async (req, res) => {
  try {
    const { title, content } = req.body;
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page ID format'
      });
    }

    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    // Get the module to check authorization
    const module = await Module.findById(page.module);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Get the course to check authorization
    const course = await Course.findById(module.course);
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
        message: 'Not authorized to update this page'
      });
    }

    // Handle file attachments if any
    let attachments = page.attachments;
    if (req.files && req.files.length > 0) {
      // Delete old attachments
      for (const attachment of page.attachments) {
        const filePath = path.join(__dirname, '..', attachment);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error('Error deleting old attachment:', err);
        }
      }
      // Add new attachments
      attachments = req.files.map(file => `/uploads/${file.filename}`);
    }

    // Update the page
    page.title = title;
    page.content = content;
    page.attachments = attachments;
    await page.save();

    res.json({
      success: true,
      data: page
    });
  } catch (err) {
    console.error('Update page error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while updating page',
      error: err.message
    });
  }
};

// @desc    Get all pages in a group set
// @route   GET /api/pages/groupset/:groupSetId
// @access  Private
exports.getPagesByGroupSet = async (req, res) => {
  try {
    const groupSetId = req.params.groupSetId;
    if (!groupSetId || !mongoose.Types.ObjectId.isValid(groupSetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groupSet ID'
      });
    }
    const pages = await Page.find({ groupSet: groupSetId });
    res.json({ success: true, data: pages });
  } catch (err) {
    console.error('Get pages by groupSet error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pages by groupSet',
      error: err.message
    });
  }
}; 