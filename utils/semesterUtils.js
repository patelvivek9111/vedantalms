const {
  VALID_TERMS,
  TERM_SORT_ORDER,
  formatAcademicYearLabel,
  resolveAcademicYearStart,
} = require('../shared/academic/terms.cjs');

/**
 * Resolve academic term/year for a course (explicit semester or creation-date default).
 * @param {object} course
 * @returns {{ term: string, year: number }}
 */
function getSemesterFromCourse(course) {
  if (course?.semester?.term && course?.semester?.year) {
    return { term: course.semester.term, year: Number(course.semester.year) };
  }
  const now = new Date(course?.createdAt || Date.now());
  const month = now.getMonth();
  const year = now.getFullYear();
  let term = 'Fall';
  if (month >= 0 && month <= 4) term = 'Spring';
  else if (month >= 5 && month <= 6) term = 'Summer';
  else if (month === 11) term = 'Winter';
  return { term, year };
}

function isValidTerm(term) {
  return VALID_TERMS.includes(term);
}

function compareSemesters(a, b) {
  const orderA = TERM_SORT_ORDER[a.term] ?? 0;
  const orderB = TERM_SORT_ORDER[b.term] ?? 0;
  if (a.year !== b.year) return b.year - a.year;
  return orderB - orderA;
}

function formatCourseTranscriptLabel(course) {
  if (course.academicYearLabel) return course.academicYearLabel;
  const sem = getSemesterFromCourse(course);
  return `${sem.term} ${sem.year}`;
}

module.exports = {
  VALID_TERMS,
  getSemesterFromCourse,
  isValidTerm,
  compareSemesters,
  formatAcademicYearLabel,
  resolveAcademicYearStart,
  formatCourseTranscriptLabel,
};
