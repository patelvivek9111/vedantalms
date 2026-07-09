const SystemSettings = require('../models/systemSettings.model');
const CourseGradingPeriod = require('../models/courseGradingPeriod.model');
const Course = require('../models/course.model');
const gradingPeriodService = require('./gradingPeriod.service');
const gradingPeriodAssignmentService = require('./gradingPeriodAssignment.service');
const {
  defaultAcademicSettings,
  buildPeriodRowsFromPreset,
  formatAcademicYearLabel,
  resolveAcademicYearStart,
  getTermOptionsForMode,
  CALENDAR_PRESETS,
} = require('../shared/academic/terms.cjs');

async function getAcademicSettings() {
  const settings = await SystemSettings.getSettings();
  const raw = settings.academic?.toObject?.() || settings.academic || {};
  return { ...defaultAcademicSettings(), ...raw };
}

async function updateAcademicSettings(patch) {
  const settings = await SystemSettings.getSettings();
  settings.academic = { ...(settings.academic?.toObject?.() || settings.academic || {}), ...patch };
  await settings.save();
  return getAcademicSettings();
}

function getFullYearDateRange(academicSettings) {
  const startYear = academicSettings.academicYearStart || resolveAcademicYearStart(academicSettings.calendarStyle);
  const style = academicSettings.calendarStyle || 'us';
  if (style === 'india') {
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${startYear + 1}-03-31`,
      academicYearLabel: formatAcademicYearLabel(startYear, 'india'),
    };
  }
  return {
    startDate: `${startYear}-08-01`,
    endDate: `${startYear + 1}-06-30`,
    academicYearLabel: formatAcademicYearLabel(startYear, 'us'),
  };
}

function resolveDefaultsForNewCourse(academicSettings, scheduleType) {
  const mode = academicSettings.institutionMode || 'mixed';
  const resolvedSchedule =
    scheduleType ||
    (mode === 'school'
      ? 'full_year'
      : mode === 'college'
        ? 'single_term'
        : academicSettings.defaultScheduleType || 'single_term');

  const isSchoolish = resolvedSchedule === 'full_year' || mode === 'school';
  const creditHours = isSchoolish
    ? academicSettings.defaultCreditHoursSchool ?? 0
    : academicSettings.defaultCreditHoursCollege ?? 3;

  const reportingTerm = isSchoolish
    ? academicSettings.reportingTermSchool || 'Academic Year'
    : academicSettings.reportingTermCollege || 'Fall';

  const year = academicSettings.academicYearStart || resolveAcademicYearStart(academicSettings.calendarStyle);
  const dates =
    resolvedSchedule === 'full_year' ? getFullYearDateRange(academicSettings) : { academicYearLabel: null };

  return {
    scheduleType: resolvedSchedule,
    creditHours,
    semester: { term: reportingTerm, year },
    academicYearLabel: dates.academicYearLabel,
    startDate: dates.startDate,
    endDate: dates.endDate,
  };
}

async function applyInstitutionCalendarToCourse(courseId, userId, academicSettings) {
  if (!academicSettings?.useInstitutionCalendar) return { applied: 0 };
  const preset = academicSettings.calendarPreset || 'us_quarters';
  const startYear = academicSettings.academicYearStart || resolveAcademicYearStart(academicSettings.calendarStyle);
  const rows = buildPeriodRowsFromPreset(preset, startYear);
  if (!rows.length) return { applied: 0 };

  const existing = await CourseGradingPeriod.countDocuments({ course: courseId });
  if (existing > 0) return { applied: 0, skipped: true };

  for (const row of rows) {
    await gradingPeriodService.createGradingPeriod(courseId, row, userId);
  }
  await gradingPeriodAssignmentService.reconcileCoursePeriodAssignments(courseId);
  return { applied: rows.length };
}

async function applyInstitutionCalendarToAllFullYearCourses(userId) {
  const academicSettings = await getAcademicSettings();
  const courses = await Course.find({ scheduleType: 'full_year' }).select('_id').lean();
  let updated = 0;
  for (const course of courses) {
    const result = await applyInstitutionCalendarToCourse(course._id, userId, academicSettings);
    if (result.applied > 0) updated += 1;
  }
  return { coursesProcessed: courses.length, coursesUpdated: updated };
}

function listCalendarPresets() {
  return Object.entries(CALENDAR_PRESETS).map(([key, val]) => ({
    key,
    calendarType: val.calendarType,
    periodCount: val.periods.length,
  }));
}

module.exports = {
  getAcademicSettings,
  updateAcademicSettings,
  getFullYearDateRange,
  resolveDefaultsForNewCourse,
  applyInstitutionCalendarToCourse,
  applyInstitutionCalendarToAllFullYearCourses,
  getTermOptionsForMode,
  listCalendarPresets,
  buildPeriodRowsFromPreset,
};
