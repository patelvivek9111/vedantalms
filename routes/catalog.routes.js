const express = require('express');
const router = express.Router();
const Course = require('../models/course.model');
const { shapeCatalogCourse } = require('../services/catalogBrowse.service');

// Public catalog endpoint
router.get('/', async (req, res) => {
  try {
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

    const courses = await Course.find({
      'catalog.startDate': { $exists: true, $ne: null },
      'catalog.endDate': { $exists: true, $ne: null },
    })
      .populate('instructor', 'firstName lastName email')
      .select('title description instructor catalog published students enrollmentRequests waitlist operationalStatus')
      .lean();

    const userId = user?._id || user?.id;
    res.json(courses.map((course) => shapeCatalogCourse(course, userId)));
  } catch (err) {
    console.error('Get catalog error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching catalog',
      error: err.message,
    });
  }
});

module.exports = router;
