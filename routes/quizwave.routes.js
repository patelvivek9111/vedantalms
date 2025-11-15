const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createQuiz,
  getQuizzesByCourse,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  createSession,
  getSessionByPin,
  getSession,
  getSessionsByQuiz,
  cleanupOldSessions
} = require('../controllers/quizwave.controller');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// Validation middleware
const createQuizValidation = [
  check('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  check('questions')
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),
  check('questions.*.questionText')
    .trim()
    .notEmpty()
    .withMessage('Question text is required'),
  check('questions.*.questionType')
    .isIn(['multiple-choice', 'true-false'])
    .withMessage('Question type must be multiple-choice or true-false'),
  handleValidationErrors
];

// Quiz routes
router
  .route('/courses/:courseId')
  .get(protect, getQuizzesByCourse)
  .post(protect, authorize('teacher', 'admin'), ...createQuizValidation, createQuiz);

router
  .route('/:quizId')
  .get(protect, getQuiz)
  .put(protect, authorize('teacher', 'admin'), updateQuiz)
  .delete(protect, authorize('teacher', 'admin'), deleteQuiz);

// Session routes
router
  .route('/:quizId/sessions')
  .get(protect, authorize('teacher', 'admin'), getSessionsByQuiz)
  .post(protect, authorize('teacher', 'admin'), createSession);

router
  .route('/sessions/pin/:pin')
  .get(protect, getSessionByPin);

router
  .route('/sessions/:sessionId')
  .get(protect, getSession);

// Cleanup route (can be called by cron job or manually)
router
  .route('/cleanup')
  .post(protect, authorize('admin'), cleanupOldSessions);

module.exports = router;

