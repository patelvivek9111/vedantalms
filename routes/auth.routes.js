const express = require('express');
const { check } = require('express-validator');
const { register, login, getMe, getLoginActivity } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Register route with validation
router.post(
  '/register',
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  register
);

// Login route
router.post('/login', login);

// Get current user route
router.get('/me', protect, getMe);

// Get login activity route
router.get('/login-activity', protect, getLoginActivity);

module.exports = router; 