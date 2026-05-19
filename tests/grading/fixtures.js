/**
 * Deterministic grading policy fixtures (backend Jest).
 * Mirrors frontend/tests/fixtures/grading/fixtures.ts — keep scenario IDs and expectations aligned.
 */

const { EXCUSED_GRADE } = require('../../shared/grading/constants.cjs');

const STUDENT_ID = 'student-policy-1';

const DEFAULT_SCALE = [
  { letter: 'A', min: 90, max: 100 },
  { letter: 'B', min: 80, max: 89 },
  { letter: 'C', min: 70, max: 79 },
  { letter: 'D', min: 60, max: 69 },
  { letter: 'F', min: 0, max: 59 },
];

/** Fixed "now" for due-date / missing / late scenarios */
const POLICY_NOW = new Date('2025-06-15T12:00:00.000Z');
const PAST_DUE = '2025-06-01T00:00:00.000Z';
const FUTURE_DUE = '2025-12-01T00:00:00.000Z';
const LATE_SUBMIT_AT = '2025-06-10T08:00:00.000Z';

function aid(name) {
  return `assign-${name}`;
}

function buildCourse(groups = []) {
  return { groups, gradeScale: DEFAULT_SCALE };
}

function buildAssignment({
  id,
  title,
  group,
  totalPoints = 100,
  published = true,
  dueDate = PAST_DUE,
  isDiscussion = false,
  hasSubmitted = false,
}) {
  return {
    _id: id,
    title: title || id,
    group,
    totalPoints,
    questions: [{ points: totalPoints }],
    published,
    dueDate,
    isDiscussion,
    hasSubmitted,
  };
}

function buildGrades(studentId, entries) {
  const sid = String(studentId);
  const grades = { [sid]: {} };
  for (const [assignmentId, value] of Object.entries(entries)) {
    if (value === EXCUSED_GRADE || value === 'excused') {
      grades[sid][String(assignmentId)] = EXCUSED_GRADE;
    } else if (typeof value === 'number') {
      grades[sid][String(assignmentId)] = value;
    }
  }
  return grades;
}

function buildSubmissions(entries) {
  const map = {};
  for (const [assignmentId, sub] of Object.entries(entries)) {
    map[String(assignmentId)] = sub === true ? { _id: `sub-${assignmentId}` } : sub;
  }
  return map;
}

/** Case 1: four groups at stated averages → 83% overall */
function case1StandardWeighted() {
  const groups = [
    { name: 'Assignments', weight: 40 },
    { name: 'Quizzes', weight: 30 },
    { name: 'Discussions', weight: 20 },
    { name: 'Attendance', weight: 10 },
  ];
  const assignments = [
    buildAssignment({ id: aid('a1'), group: 'Assignments', totalPoints: 100 }),
    buildAssignment({ id: aid('q1'), group: 'Quizzes', totalPoints: 100 }),
    buildAssignment({ id: aid('d1'), group: 'Discussions', totalPoints: 100 }),
    buildAssignment({ id: aid('att1'), group: 'Attendance', totalPoints: 100 }),
  ];
  const grades = buildGrades(STUDENT_ID, {
    [aid('a1')]: 80,
    [aid('q1')]: 90,
    [aid('d1')]: 70,
    [aid('att1')]: 100,
  });
  return {
    id: 'case1',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({
      [aid('a1')]: true,
      [aid('q1')]: true,
      [aid('d1')]: true,
      [aid('att1')]: true,
    }),
    expectedPercent: 83,
    expectedLetter: 'B',
  };
}

/** Case 2: one missing (past due, no submission) counts as 0 */
function case2MissingAssignment() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const missingId = aid('missing');
  const doneId = aid('done');
  const assignments = [
    buildAssignment({ id: missingId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: doneId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [doneId]: 100 });
  const submissions = buildSubmissions({ [doneId]: true });
  // Missing: 0/100 + Done: 100/100 → 50%
  return {
    id: 'case2',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions,
    expectedPercent: 50,
    expectedLetter: 'F',
    missingCell: { assignmentId: missingId, label: '0 (MA)' },
  };
}

/** Case 3: submitted but not graded — excluded from overall */
function case3SubmittedNotGraded() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('graded');
  const pendingId = aid('pending');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: pendingId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
  const submissions = buildSubmissions({ [gradedId]: true, [pendingId]: true });
  // Only graded item counts: 80%
  return {
    id: 'case3',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions,
    expectedPercent: 80,
    expectedLetter: 'B',
    pendingCell: { assignmentId: pendingId, label: 'Not Graded' },
  };
}

/** Case 4: unpublished assignment ignored */
function case4Unpublished() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const publishedId = aid('pub');
  const hiddenId = aid('hidden');
  const assignments = [
    buildAssignment({ id: publishedId, group: 'Assignments', published: true }),
    buildAssignment({ id: hiddenId, group: 'Assignments', published: false }),
  ];
  const grades = buildGrades(STUDENT_ID, { [publishedId]: 90, [hiddenId]: 0 });
  return {
    id: 'case4',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [publishedId]: true }),
    expectedPercent: 90,
    expectedLetter: 'A',
    unpublishedCell: { assignmentId: hiddenId, label: 'Not Published' },
  };
}

/** Case 5: excused — excluded from denominator (80% from graded item only) */
function case5Excused() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('graded');
  const excusedId = aid('excused');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments' }),
    buildAssignment({ id: excusedId, group: 'Assignments' }),
  ];
  const grades = buildGrades(STUDENT_ID, {
    [gradedId]: 80,
    [excusedId]: EXCUSED_GRADE,
  });
  return {
    id: 'case5',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({
      [gradedId]: true,
      [excusedId]: { _id: 'sub-excused', excused: true },
    }),
    expectedPercent: 80,
    expectedLetter: 'B',
    excusedCell: { assignmentId: excusedId, label: 'Excused' },
  };
}

/** Case 6: empty group weight redistributed — only Assignments graded at 80% */
function case6WeightRedistribution() {
  const groups = [
    { name: 'Assignments', weight: 40 },
    { name: 'Quizzes', weight: 30 },
    { name: 'Discussions', weight: 20 },
    { name: 'Attendance', weight: 10 },
  ];
  const assignments = [
    buildAssignment({ id: aid('only'), group: 'Assignments' }),
    buildAssignment({ id: aid('empty-q'), group: 'Quizzes', dueDate: FUTURE_DUE }),
    buildAssignment({ id: aid('empty-d'), group: 'Discussions', dueDate: FUTURE_DUE }),
    buildAssignment({ id: aid('empty-a'), group: 'Attendance', dueDate: FUTURE_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [aid('only')]: 80 });
  return {
    id: 'case6',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [aid('only')]: true }),
    expectedPercent: 80,
    expectedLetter: 'B',
  };
}

/** Case 7: late submission still counts when graded */
function case7LateSubmission() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const lateId = aid('late');
  const assignments = [
    buildAssignment({ id: lateId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [lateId]: 85 });
  const submissions = buildSubmissions({
    [lateId]: { _id: 'sub-late', submittedAt: LATE_SUBMIT_AT },
  });
  return {
    id: 'case7',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions,
    expectedPercent: 85,
    expectedLetter: 'B',
    gradedLateCell: { assignmentId: lateId, display: '85' },
    ungradedLateCell: {
      assignmentId: lateId,
      label: 'Late',
      grades: buildGrades(STUDENT_ID, {}),
    },
  };
}

/** Case 8: manual (numeric) grade on submission used in overall */
function case8ManualGrade() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const manualId = aid('manual');
  const assignments = [buildAssignment({ id: manualId, group: 'Assignments' })];
  const grades = buildGrades(STUDENT_ID, { [manualId]: 92 });
  return {
    id: 'case8',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [manualId]: true }),
    expectedPercent: 92,
    expectedLetter: 'A',
  };
}

/** Case 9: group assignment — shared group grade for members */
function case9GroupAssignment() {
  const groups = [{ name: 'Group Work', weight: 100 }];
  const groupAssignId = aid('group');
  const assignments = [buildAssignment({ id: groupAssignId, group: 'Group Work' })];
  const grades = buildGrades(STUDENT_ID, { [groupAssignId]: 88 });
  return {
    id: 'case9',
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({
      [groupAssignId]: { _id: 'sub-group', group: 'group-1', grade: 88 },
    }),
    expectedPercent: 88,
    expectedLetter: 'B',
    individualGradeScenario: {
      useIndividualGrades: true,
      memberGrades: [{ student: STUDENT_ID, grade: 95 }],
      expectedPercent: 95,
    },
  };
}

/** Case 10: transcript GPA sample courses */
function case10TranscriptCourses() {
  return [
    { letterGrade: 'A', creditHours: 3 },
    { letterGrade: 'B', creditHours: 4 },
    { letterGrade: 'C', creditHours: 3 },
  ];
}

module.exports = {
  STUDENT_ID,
  DEFAULT_SCALE,
  POLICY_NOW,
  PAST_DUE,
  FUTURE_DUE,
  LATE_SUBMIT_AT,
  aid,
  buildCourse,
  buildAssignment,
  buildGrades,
  buildSubmissions,
  case1StandardWeighted,
  case2MissingAssignment,
  case3SubmittedNotGraded,
  case4Unpublished,
  case5Excused,
  EXCUSED_GRADE,
  case6WeightRedistribution,
  case7LateSubmission,
  case8ManualGrade,
  case9GroupAssignment,
  case10TranscriptCourses,
};
