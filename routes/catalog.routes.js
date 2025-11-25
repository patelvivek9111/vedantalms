const express = require('express');
const router = express.Router();
const Course = require('../models/course.model');
const { protect } = require('../middleware/auth');

// Public catalog endpoint
router.get('/', async (req, res) => {
  try {
    // Check if user is authenticated
    let token;
    let user = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      if (token && token.trim() !== '') {
        try {
          const jwt = require('jsonwebtoken');
          const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-123';
          const decoded = jwt.verify(token, jwtSecret);
          const User = require('../models/user.model');
          if (decoded && decoded.id) {
            // Validate ObjectId format
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(decoded.id)) {
              user = await User.findById(decoded.id);
              // Validate user exists
              if (!user) {
                user = null;
              }
            }
          }
        } catch (err) {
          // Token is invalid, treat as unauthenticated
          // Don't log or expose error details for security
        }
      }
    }

    let courses;
    
    if (user) {
      // User is authenticated, populate students and enrollment requests to check enrollment status
      courses = await Course.find({
        'catalog.startDate': { $exists: true, $ne: null },
        'catalog.endDate': { $exists: true, $ne: null }
      }).populate('instructor', 'firstName lastName email')
        .populate('students', '_id firstName lastName')
        .populate('enrollmentRequests.student', '_id firstName lastName')
        .populate('waitlist.student', '_id firstName lastName')
        .populate('catalog', 'subject maxStudents description startDate endDate tags');
    } else {
      // User is not authenticated, don't populate students
      courses = await Course.find({
        'catalog.startDate': { $exists: true, $ne: null },
        'catalog.endDate': { $exists: true, $ne: null }
      }).populate('instructor', 'firstName lastName email')
        .populate('catalog', 'subject maxStudents description startDate endDate tags');
    }
    
    // Validate courses is an array
    if (!Array.isArray(courses)) {
      return res.status(500).json({
        success: false,
        message: 'Invalid response format'
      });
    }

    res.json(courses);
  } catch (err) {
    console.error('Get catalog error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching catalog',
      error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message 
    });
  }
});

module.exports = router; 