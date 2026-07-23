const express = require('express');
const router = express.Router();
const Course = require('../models/course.model');
const AcademicTerm = require('../models/academicTerm.model');
const { shapeCatalogCourse } = require('../services/catalogBrowse.service');
const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');
const { accountSubtreeFilter } = require('../services/tenancy/academicStructure.service');

// Public catalog endpoint (tenant-scoped; optional term / sub-account filters)
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

    const tenantId = rootAccountIdFromRequest(req);
    let filter = withTenantFilter(
      {
        'catalog.startDate': { $exists: true, $ne: null },
        'catalog.endDate': { $exists: true, $ne: null },
      },
      tenantId
    );

    if (req.query.accountId) {
      filter = {
        ...(await accountSubtreeFilter(tenantId, req.query.accountId)),
        'catalog.startDate': { $exists: true, $ne: null },
        'catalog.endDate': { $exists: true, $ne: null },
      };
    }
    if (req.query.termId) {
      filter.academicTermId = req.query.termId;
    }

    const courses = await Course.find(filter)
      .populate('instructor', 'firstName lastName email')
      .populate('academicTermId', 'name code status enrollmentOpenDate enrollmentCloseDate')
      .select(
        'title description instructor catalog published students enrollmentRequests waitlist operationalStatus academicTermId sectionNumber accountId'
      )
      .lean();

    const userId = user?._id || user?.id;
    const now = new Date();
    const shaped = courses.map((course) => {
      const row = shapeCatalogCourse(course, userId);
      const term = course.academicTermId;
      row.academicTerm = term
        ? {
            id: term._id,
            name: term.name,
            code: term.code,
            status: term.status,
            enrollmentOpen: AcademicTerm.isEnrollmentOpen(term, now),
          }
        : null;
      row.sectionNumber = course.sectionNumber || null;
      row.accountId = course.accountId || null;
      return row;
    });

    res.json(shaped);
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
