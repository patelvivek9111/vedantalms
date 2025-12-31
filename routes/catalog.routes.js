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
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const User = require('../models/user.model');
        user = await User.findById(decoded.id);
      } catch (err) {
        // Token is invalid, treat as unauthenticated
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
    
    res.json(courses);
  } catch (err) {
    console.error('Get catalog error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching catalog',
      error: err.message 
    });
  }
});

module.exports = router; 