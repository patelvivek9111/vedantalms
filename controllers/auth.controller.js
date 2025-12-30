const User = require('../models/user.model');
const LoginActivity = require('../models/loginActivity.model');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { ValidationError, ConflictError, UnauthorizedError, sendErrorResponse, asyncHandler } = require('../utils/errorHandler');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
  
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }));
      return sendErrorResponse(res, new ValidationError('Validation error', validationErrors), { action: 'register' });
    }

    const { firstName, lastName, email, password, role } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return sendErrorResponse(res, new ConflictError('User with this email already exists'), { action: 'register', email });
    }

    // Create user
    user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'student'
    });

    

    // Create token
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        bio: user.bio,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    // Let the global error handler deal with it
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return sendErrorResponse(res, new ValidationError('Please provide an email and password'), { action: 'login' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      // Log failed login attempt
      await LoginActivity.create({
        userId: null,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown',
        success: false,
        failureReason: 'User not found'
      });
      return sendErrorResponse(res, new UnauthorizedError('Invalid credentials'), { action: 'login', email });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      // Log failed login attempt
      await LoginActivity.create({
        userId: user._id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown',
        success: false,
        failureReason: 'Invalid password'
      });
      return sendErrorResponse(res, new UnauthorizedError('Invalid credentials'), { action: 'login', email });
    }

    // Log successful login
    await LoginActivity.create({
      userId: user._id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      success: true
    });

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        bio: user.bio,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    // Let the global error handler deal with it
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // Use _id for consistency with MongoDB (req.user is a Mongoose document)
    const user = await User.findById(req.user._id || req.user.id);
    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        bio: user.bio,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    // Let the global error handler deal with it
    next(err);
  }
};

// @desc    Get user login activity
// @route   GET /api/auth/login-activity
// @access  Private
exports.getLoginActivity = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Increased default limit
    const skip = (page - 1) * limit;
    
    // Add date filtering
    const days = parseInt(req.query.days) || 150; // Default to 5 months (150 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = { 
      userId: req.user._id || req.user.id,
      timestamp: { $gte: startDate }
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
        pages: Math.ceil(total / limit)
      },
      filter: {
        days,
        startDate: startDate.toISOString()
      }
    });
  } catch (err) {
    // Let the global error handler deal with it
    next(err);
  }
}; 