const gradingPeriodService = require('../services/gradingPeriod.service');
const gradingPeriodAssignmentService = require('../services/gradingPeriodAssignment.service');
const Course = require('../models/course.model');

async function assertCourseAccess(req, courseId) {
  const course = await Course.findById(courseId).select('instructor teachingAssistants').lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }
  const uid = String(req.user._id);
  const isStaff =
    req.user.role === 'admin' ||
    req.user.role === 'registrar' ||
    String(course.instructor) === uid ||
    (course.teachingAssistants || []).some((ta) => String(ta) === uid);
  if (!isStaff) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }
  return course;
}

async function assertCourseMember(req, courseId) {
  const course = await Course.findById(courseId)
    .select('instructor teachingAssistants students gradingPeriodSettings')
    .lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }
  const uid = String(req.user._id);
  const isStaff =
    req.user.role === 'admin' ||
    req.user.role === 'registrar' ||
    String(course.instructor) === uid ||
    (course.teachingAssistants || []).some((ta) => String(ta) === uid);
  const isStudent = (course.students || []).some((s) => String(s) === uid);
  if (!isStaff && !isStudent) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }
  return course;
}

exports.listGradingPeriods = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await assertCourseMember(req, courseId);
    const periods = await gradingPeriodService.listGradingPeriods(courseId);
    res.json({
      success: true,
      data: periods,
      settings: course.gradingPeriodSettings || {
        allowStudentAllPeriods: true,
        displayTotalsForAllPeriods: true,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.createGradingPeriod = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    await assertCourseAccess(req, courseId);
    if (!req.body?.name?.trim()) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const period = await gradingPeriodService.createGradingPeriod(
      courseId,
      req.body,
      req.user._id
    );
    const reconciled = await gradingPeriodAssignmentService.reconcileCoursePeriodAssignments(
      courseId
    );
    res.status(201).json({ success: true, data: period, reconciled });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.updateGradingPeriod = async (req, res) => {
  try {
    const { courseId, periodId } = req.params;
    await assertCourseAccess(req, courseId);
    const period = await gradingPeriodService.updateGradingPeriod(periodId, courseId, req.body);
    if (!period) return res.status(404).json({ success: false, message: 'Period not found' });
    const reconciled = await gradingPeriodAssignmentService.reconcileCoursePeriodAssignments(
      courseId
    );
    res.json({ success: true, data: period, reconciled });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.updateGradingPeriodSettings = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    await assertCourseAccess(req, courseId);
    const patch = {};
    if (req.body.allowStudentAllPeriods != null) {
      patch['gradingPeriodSettings.allowStudentAllPeriods'] = !!req.body.allowStudentAllPeriods;
    }
    if (req.body.displayTotalsForAllPeriods != null) {
      patch['gradingPeriodSettings.displayTotalsForAllPeriods'] =
        !!req.body.displayTotalsForAllPeriods;
    }
    const course = await Course.findByIdAndUpdate(courseId, { $set: patch }, { new: true })
      .select('gradingPeriodSettings')
      .lean();
    res.json({ success: true, data: course?.gradingPeriodSettings || {} });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/** Quick-start templates: quarters (4) or semesters (2) or terms (2) with equal weights. */
exports.applyGradingPeriodTemplate = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    await assertCourseAccess(req, courseId);
    const template = req.body?.template;
    const academicCalendarService = require('../services/academicCalendar.service');
    const academicSettings = await academicCalendarService.getAcademicSettings();

    const presetMap = {
      quarters: 'us_quarters',
      semesters: 'college_semesters',
      terms: academicSettings.calendarStyle === 'india' ? 'india_terms' : 'us_terms',
    };

    if (presetMap[template] && academicSettings.useInstitutionCalendar) {
      const startYear =
        academicSettings.academicYearStart ||
        require('../shared/academic/terms.cjs').resolveAcademicYearStart(
          academicSettings.calendarStyle
        );
      const rows = academicCalendarService.buildPeriodRowsFromPreset(presetMap[template], startYear);
      if (rows.length) {
        for (const row of rows) {
          await gradingPeriodService.createGradingPeriod(courseId, row, req.user._id);
        }
        const reconciled = await gradingPeriodAssignmentService.reconcileCoursePeriodAssignments(
          courseId
        );
        const periods = await gradingPeriodService.listGradingPeriods(courseId);
        return res.status(201).json({ success: true, data: periods, reconciled });
      }
    }

    const year = new Date().getFullYear();
    const templates = {
      quarters: [
        { name: 'Quarter 1', startDate: `${year}-08-01`, endDate: `${year}-10-31`, weight: 25 },
        { name: 'Quarter 2', startDate: `${year}-11-01`, endDate: `${year}-12-31`, weight: 25 },
        { name: 'Quarter 3', startDate: `${year + 1}-01-01`, endDate: `${year + 1}-03-31`, weight: 25 },
        { name: 'Quarter 4', startDate: `${year + 1}-04-01`, endDate: `${year + 1}-06-30`, weight: 25 },
      ],
      semesters: [
        { name: 'Semester 1', startDate: `${year}-08-01`, endDate: `${year}-12-31`, weight: 50 },
        { name: 'Semester 2', startDate: `${year + 1}-01-01`, endDate: `${year + 1}-06-30`, weight: 50 },
      ],
      terms: [
        { name: 'Term 1', startDate: `${year}-08-01`, endDate: `${year}-12-31`, weight: 50 },
        { name: 'Term 2', startDate: `${year + 1}-01-01`, endDate: `${year + 1}-06-30`, weight: 50 },
      ],
    };
    const rows = templates[template];
    if (!rows) {
      return res.status(400).json({ success: false, message: 'template must be quarters, semesters, or terms' });
    }
    for (const row of rows) {
      await gradingPeriodService.createGradingPeriod(courseId, row, req.user._id);
    }
    const reconciled = await gradingPeriodAssignmentService.reconcileCoursePeriodAssignments(
      courseId
    );
    const periods = await gradingPeriodService.listGradingPeriods(courseId);
    res.status(201).json({ success: true, data: periods, reconciled });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getDeletionImpact = async (req, res) => {
  try {
    const { courseId, periodId } = req.params;
    await assertCourseAccess(req, courseId);
    const impact = await gradingPeriodService.getDeletionImpact(periodId, courseId);
    if (!impact) return res.status(404).json({ success: false, message: 'Period not found' });
    res.json({ success: true, data: impact });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.deleteGradingPeriod = async (req, res) => {
  try {
    const { courseId, periodId } = req.params;
    await assertCourseAccess(req, courseId);
    const result = await gradingPeriodService.deleteGradingPeriod(periodId, courseId);
    if (!result) return res.status(404).json({ success: false, message: 'Period not found' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
