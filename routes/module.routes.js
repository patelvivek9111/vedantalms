const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { createModule, getModulesByCourse, getModuleById, deleteModule, toggleModulePublish, updateModule } = require('../controllers/module.controller');

// Validation middleware
const moduleValidation = [
  check('title').trim().notEmpty().withMessage('Title is required'),
  check('course').notEmpty().withMessage('Course is required')
];

router.post('/', protect, authorize('teacher', 'admin'), moduleValidation, createModule);
router.get('/view/:id', protect, getModuleById);
router.delete('/:id', protect, authorize('teacher', 'admin'), deleteModule);
router.patch('/:id/publish', protect, authorize('teacher', 'admin'), toggleModulePublish);
router.put('/:id', protect, authorize('teacher', 'admin'), moduleValidation, updateModule);
router.get('/:courseId', protect, getModulesByCourse);

module.exports = router; 