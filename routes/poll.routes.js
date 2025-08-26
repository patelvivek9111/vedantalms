const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createPoll,
  getPollsByCourse,
  voteOnPoll,
  getPollResults,
  updatePoll,
  deletePoll
} = require('../controllers/poll.controller');

// Validation middleware
const createPollValidation = [
  check('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  check('options')
    .isArray({ min: 2 })
    .withMessage('At least 2 options are required'),
  check('options.*')
    .trim()
    .notEmpty()
    .withMessage('Option text cannot be empty')
    .isLength({ min: 1, max: 200 })
    .withMessage('Option text must be between 1 and 200 characters'),
  check('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date')
];

const voteValidation = [
  check('selectedOptions')
    .isArray({ min: 1 })
    .withMessage('At least one option must be selected'),
  check('selectedOptions.*')
    .isInt({ min: 0 })
    .withMessage('Selected options must be valid indices')
];

// Routes
router
  .route('/courses/:courseId')
  .get(protect, getPollsByCourse)
  .post(protect, authorize('teacher', 'admin'), createPollValidation, createPoll);

router
  .route('/:pollId/vote')
  .post(protect, authorize('student'), voteValidation, voteOnPoll);

router
  .route('/:pollId/results')
  .get(protect, authorize('teacher', 'admin'), getPollResults);

router
  .route('/:pollId')
  .put(protect, authorize('teacher', 'admin'), updatePoll)
  .delete(protect, authorize('teacher', 'admin'), deletePoll);

module.exports = router; 