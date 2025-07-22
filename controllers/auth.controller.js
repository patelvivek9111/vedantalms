const User = require('../models/user.model');
const LoginActivity = require('../models/loginActivity.model');
const { validationResult } = require('express-validator');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
  
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {

      return res.status(400).json({ 
        success: false,
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }

    const { firstName, lastName, email, password, role } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {

      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
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
    console.error('Registration error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      error: err.message 
    });
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
      return res.status(400).json({ message: 'Please provide an email and password' });
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
      return res.status(401).json({ message: 'Invalid credentials' });
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
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Log successful login
    await LoginActivity.create({
      userId: user._id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      success: true
    });

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
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
      userId: req.user.id,
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
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}; 