/** Institution academic term labels and calendar helpers (CJS). */

const COLLEGE_TERMS = ['Fall', 'Spring', 'Summer', 'Winter'];
const SCHOOL_TERMS = [
  'Term 1',
  'Term 2',
  'Quarter 1',
  'Quarter 2',
  'Quarter 3',
  'Quarter 4',
  'Academic Year',
];
const VALID_TERMS = [...COLLEGE_TERMS, ...SCHOOL_TERMS];

const TERM_SORT_ORDER = {
  Winter: 0,
  Spring: 1,
  Summer: 2,
  Fall: 3,
  'Term 1': 1,
  'Term 2': 2,
  'Quarter 1': 1,
  'Quarter 2': 2,
  'Quarter 3': 3,
  'Quarter 4': 4,
  'Academic Year': 5,
};

const CALENDAR_PRESETS = {
  us_quarters: {
    calendarType: 'quarters',
    periods: [
      { name: 'Quarter 1', weight: 25, startMonth: 8, startDay: 1, endMonth: 10, endDay: 31 },
      { name: 'Quarter 2', weight: 25, startMonth: 11, startDay: 1, endMonth: 12, endDay: 31 },
      { name: 'Quarter 3', weight: 25, startMonth: 1, startDay: 1, endMonth: 3, endDay: 31 },
      { name: 'Quarter 4', weight: 25, startMonth: 4, startDay: 1, endMonth: 6, endDay: 30 },
    ],
  },
  us_terms: {
    calendarType: 'terms',
    periods: [
      { name: 'Term 1', weight: 50, startMonth: 8, startDay: 1, endMonth: 12, endDay: 31 },
      { name: 'Term 2', weight: 50, startMonth: 1, startDay: 1, endMonth: 6, endDay: 30 },
    ],
  },
  india_terms: {
    calendarType: 'terms',
    periods: [
      { name: 'Term 1', weight: 50, startMonth: 4, startDay: 1, endMonth: 9, endDay: 30 },
      { name: 'Term 2', weight: 50, startMonth: 10, startDay: 1, endMonth: 3, endDay: 31 },
    ],
  },
  college_semesters: {
    calendarType: 'semesters',
    periods: [
      { name: 'Semester 1', weight: 50, startMonth: 8, startDay: 1, endMonth: 12, endDay: 31 },
      { name: 'Semester 2', weight: 50, startMonth: 1, startDay: 1, endMonth: 5, endDay: 31 },
    ],
  },
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** e.g. startYear 2025 → "2025–26" */
function formatAcademicYearLabel(startYear, style = 'us') {
  const y = Number(startYear);
  if (!Number.isFinite(y)) return '';
  if (style === 'india') return `${y}–${String(y + 1).slice(-2)}`;
  return `${y}–${String(y + 1).slice(-2)}`;
}

function resolveAcademicYearStart(calendarStyle, referenceDate = new Date()) {
  const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (calendarStyle === 'india') {
    return month >= 4 ? year : year - 1;
  }
  return month >= 8 ? year : year - 1;
}

function buildPeriodDates(periodDef, academicYearStart) {
  const startYear = academicYearStart;
  let endYear = academicYearStart;
  if (periodDef.endMonth < periodDef.startMonth) {
    endYear = academicYearStart + 1;
  }
  const startDate = `${startYear}-${pad2(periodDef.startMonth)}-${pad2(periodDef.startDay)}`;
  const endDate = `${endYear}-${pad2(periodDef.endMonth)}-${pad2(periodDef.endDay)}`;
  return { startDate, endDate };
}

function buildPeriodRowsFromPreset(presetKey, academicYearStart) {
  const preset = CALENDAR_PRESETS[presetKey];
  if (!preset) return [];
  return preset.periods.map((p, i) => {
    const { startDate, endDate } = buildPeriodDates(p, academicYearStart);
    return {
      name: p.name,
      position: i,
      weight: p.weight,
      startDate,
      endDate,
    };
  });
}

function getTermOptionsForMode(institutionMode) {
  if (institutionMode === 'school') {
    return [
      { value: 'Academic Year', label: 'Academic Year' },
      { value: 'Spring', label: 'Spring (reporting)' },
      { value: 'Term 1', label: 'Term 1' },
      { value: 'Term 2', label: 'Term 2' },
      { value: 'Quarter 1', label: 'Quarter 1' },
      { value: 'Quarter 2', label: 'Quarter 2' },
      { value: 'Quarter 3', label: 'Quarter 3' },
      { value: 'Quarter 4', label: 'Quarter 4' },
      ...COLLEGE_TERMS.map((t) => ({ value: t, label: t })),
    ];
  }
  if (institutionMode === 'college') {
    return COLLEGE_TERMS.map((t) => ({ value: t, label: t }));
  }
  return VALID_TERMS.map((t) => ({ value: t, label: t }));
}

function defaultAcademicSettings() {
  return {
    institutionMode: 'mixed',
    defaultScheduleType: 'single_term',
    calendarStyle: 'us',
    calendarPreset: 'us_quarters',
    academicYearStart: resolveAcademicYearStart('us'),
    useInstitutionCalendar: true,
    defaultCreditHoursSchool: 0,
    defaultCreditHoursCollege: 3,
    reportingTermSchool: 'Academic Year',
    reportingTermCollege: 'Fall',
    defaultEnrollmentMethod: 'open',
    holdDefaults: {
      holdType: 'registration',
      blocksRegistration: true,
      blocksTranscript: false,
      blocksGrades: false,
    },
  };
}

module.exports = {
  COLLEGE_TERMS,
  SCHOOL_TERMS,
  VALID_TERMS,
  TERM_SORT_ORDER,
  CALENDAR_PRESETS,
  formatAcademicYearLabel,
  resolveAcademicYearStart,
  buildPeriodDates,
  buildPeriodRowsFromPreset,
  getTermOptionsForMode,
  defaultAcademicSettings,
};
