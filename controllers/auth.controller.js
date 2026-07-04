const User = require('../models/user.model');
const LoginActivity = require('../models/loginActivity.model');
const PasswordResetToken = require('../models/passwordResetToken.model');
const { validationResult } = require('express-validator');
const { validatePassword } = require('../utils/passwordPolicy');
const { isPublicRegistrationDisabled, getSecurityPolicy } = require('../services/securityPolicy.service');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');
const { sendEmail } = require('../utils/emailService');

const SELF_REGISTER_ROLES = new Set(['student']);
const DEV_SELF_REGISTER_ROLES = new Set(['student', 'teacher']);

function resolveRegistrationRole(requestedRole) {
  if (isPublicRegistrationDisabled()) {
    return null;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'student';
  }
  if (requestedRole && DEV_SELF_REGISTER_ROLES.has(requestedRole)) {
    return requestedRole;
  }
  return 'student';
}

function sendAuthResponse(res, statusCode, user) {
  const token = user.getSignedJwtToken();
  setAuthCookie(res, token);
  return res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      bio: user.bio || '',
      profilePicture: user.profilePicture || '',
    },
  });
}

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
    }

    const { firstName, lastName, email, password, role, termsAccepted } = req.body;

    const mustAcceptTerms = process.env.NODE_ENV === 'production';
    if (mustAcceptTerms && !termsAccepted) {
      return res.status(400).json({
        success: false,
        message: 'You must accept the Terms of Service and Privacy Policy',
      });
    }

    const assignedRole = resolveRegistrationRole(role);
    if (!assignedRole) {
      return res.status(403).json({
        success: false,
        message: 'Public registration is disabled. Contact your administrator.',
      });
    }

    if (getSecurityPolicy().maintenanceMode) {
      return res.status(503).json({
        success: false,
        message: 'Registration is unavailable during maintenance.',
      });
    }

    if (role && !SELF_REGISTER_ROLES.has(role) && process.env.NODE_ENV === 'production') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role for public registration',
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: assignedRole,
      bio: '',
      privacyConsentAt: new Date(),
    });

    return sendAuthResponse(res, 201, user);
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide an email and password' });
    }

    const policy = getSecurityPolicy();

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      await LoginActivity.create({
        userId: null,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown',
        success: false,
        failureReason: 'User not found',
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (policy.maintenanceMode && user.role !== 'admin') {
      return res.status(503).json({
        message: 'The system is under maintenance. Please try again later.',
      });
    }

    const lockoutWindow = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await LoginActivity.countDocuments({
      userId: user._id,
      success: false,
      timestamp: { $gte: lockoutWindow },
    });
    if (recentFailures >= policy.maxLoginAttempts) {
      return res.status(429).json({
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await LoginActivity.create({
        userId: user._id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown',
        success: false,
        failureReason: 'Invalid password',
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.accountStatus === 'suspended') {
      await LoginActivity.create({
        userId: user._id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown',
        success: false,
        failureReason: 'Account suspended',
      });
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact an administrator.',
      });
    }

    await LoginActivity.create({
      userId: user._id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      success: true,
    });

    user.lastLogin = new Date();
    await user.save();

    return sendAuthResponse(res, 200, user);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Logout user (clear auth cookie)
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        bio: user.bio || '',
        profilePicture: user.profilePicture || '',
      },
    });
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user login activity
// @route   GET /api/auth/login-activity
// @access  Private
exports.getLoginActivity = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const days = parseInt(req.query.days, 10) || 150;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = {
      userId: req.user.id,
      timestamp: { $gte: startDate },
    };

    const activities = await LoginActivity.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LoginActivity.countDocuments(query);

    res.json({
      success: true,
      data: activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filter: {
        days,
        startDate: startDate.toISOString(),
      },
    });
  } catch (err) {
    console.error('Login activity error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Request password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const { rawToken } = await PasswordResetToken.createForUser(user._id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

    await sendEmail(
      user.email,
      'Reset your password',
      `Hello ${user.firstName},

We received a request to reset your password. Open this link (valid for 1 hour):

${resetUrl}

If you did not request this, you can ignore this email.`
    );

    return res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, password, and confirm password are required',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    const tokenHash = PasswordResetToken.hashToken(token);
    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = await User.findById(resetRecord.user).select('+password');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = password;
    await user.invalidateSessions();
    resetRecord.usedAt = new Date();
    await resetRecord.save();

    return res.json({ success: true, message: 'Password reset successfully. Please sign in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
