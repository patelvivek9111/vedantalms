const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createPage,
  getPagesByModule,
  getPageById,
  updatePage,
  getPagesByGroupSet,
  getPagesByCourse,
  deletePage
} = require('../controllers/page.controller');
const upload = require('../middleware/upload');

// Validation middleware
const pageValidation = [
  check('title').trim().notEmpty().withMessage('Title is required'),
  check('module').optional().isMongoId().withMessage('Invalid module ID'),
  check('groupSet').optional().isMongoId().withMessage('Invalid groupSet ID')
];

// Create a page
router.post('/', protect, authorize('teacher', 'admin'), upload.array('attachments', 10), pageValidation, createPage);

// Specific routes must come before generic /:moduleId route
// Get all pages for a group set
router.get('/groupset/:groupSetId', protect, getPagesByGroupSet);

// Get all pages for a course
router.get('/course/:courseId', protect, getPagesByCourse);

// Get a single page by ID
router.get('/view/:id', protect, getPageById);

// Get all pages for a module (also handles /:moduleId for backward compatibility)
router.get('/module/:moduleId', protect, getPagesByModule);
router.get('/:moduleId', protect, getPagesByModule);

// Update a page
router.put('/:id', protect, authorize('teacher', 'admin'), upload.array('attachments', 10), updatePage);

// Delete a page
router.delete('/:id', protect, authorize('teacher', 'admin'), deletePage);

module.exports = router;

