'use strict';

/** Spring 2026 semester window (single coherent timeline for demos). */
const SEMESTER = {
  term: 'Spring',
  year: 2026,
  start: new Date('2026-01-06T09:00:00+05:30'),
  end: new Date('2026-05-15T17:00:00+05:30'),
};

const COURSE_CODE = 'DEMO-MATH8-IN-2026';
const COURSE_TITLE = 'Mathematics — Grade 8 (Indian Curriculum)';
const COURSE_DESCRIPTION =
  'NCERT-aligned Grade 8 mathematics for Indian middle schools: number systems through graphs, with problem-solving, reasoning, and data literacy. This demo course follows one semester (January–May 2026).';

module.exports = {
  SEMESTER,
  COURSE_CODE,
  COURSE_TITLE,
  COURSE_DESCRIPTION,
};
