const express = require('express');
const { check } = require('express-validator');
const { register, login, getMe, getLoginActivity } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Register route with validation and rate limiting
router.post(
  '/register',
  registerLimiter, // Rate limit: 3 registrations per hour per IP
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  register
);

// Login route with rate limiting
router.post('/login', authLimiter, login); // Rate limit: 5 attempts per 15 minutes per IP

// Get current user route
router.get('/me', protect, getMe);

// Get login activity route
router.get('/login-activity', protect, getLoginActivity);

module.exports = router; 