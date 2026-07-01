const express = require('express');
const { check } = require('express-validator');
const {
  register,
  login,
  logout,
  getMe,
  getLoginActivity,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');

const router = express.Router();

const passwordValidator = check('password').custom((value) => {
  const { validatePassword } = require('../utils/passwordPolicy');
  const result = validatePassword(value);
  if (!result.valid) {
    throw new Error(result.message);
  }
  return true;
});

router.post(
  '/register',
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    passwordValidator,
    check('termsAccepted').optional().custom((value, { req }) => {
      if (process.env.NODE_ENV === 'production' && !value) {
        throw new Error('You must accept the Terms of Service and Privacy Policy');
      }
      return true;
    }),
  ],
  register
);

router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', [passwordValidator], resetPassword);
router.get('/me', protect, getMe);
router.get('/login-activity', protect, getLoginActivity);

module.exports = router;
