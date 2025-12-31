const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const { createPage, getPagesByModule, getPageById, updatePage, getPagesByGroupSet } = require('../controllers/page.controller');
const Page = require('../models/page.model');
const Module = require('../models/module.model');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Validation middleware
const pageValidation = [
  check('title').trim().notEmpty().withMessage('Title is required'),
  check('content').notEmpty().withMessage('Content is required'),
  check(['module', 'groupSet']).custom((value, { req }) => {
    if (!req.body.module && !req.body.groupSet) {
      throw new Error('Either module or groupSet is required');
    }
    return true;
  })
];

router.post('/', protect, authorize('teacher', 'admin'), upload.array('attachments'), pageValidation, createPage);
router.get('/view/:id', protect, getPageById);
router.get('/:moduleId', protect, getPagesByModule);
router.put('/:id', protect, authorize('teacher', 'admin'), upload.array('attachments'), pageValidation, updatePage);

// Get all pages for a course
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    // Find all modules for the course
    const modules = await Module.find({ course: req.params.courseId }).select('_id');
    const moduleIds = modules.map(m => m._id);
    // Find all pages for those modules
    const pages = await Page.find({ module: { $in: moduleIds } });
    res.json({ success: true, data: pages });
  } catch (err) {
    console.error('Error fetching pages for course:', err);
    res.status(500).json({ success: false, message: 'Error fetching pages for course' });
  }
});

// Get all pages for a group set
router.get('/groupset/:groupSetId', protect, getPagesByGroupSet);

module.exports = router; 