const VALID_TERMS = ['Fall', 'Spring', 'Summer', 'Winter'];

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

module.exports = {
  VALID_TERMS,
  getSemesterFromCourse,
};
