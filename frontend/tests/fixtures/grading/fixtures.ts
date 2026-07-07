/**
 * Deterministic grading policy fixtures (frontend Vitest).
 * Keep aligned with tests/grading/fixtures.js on the backend.
 */

export const STUDENT_ID = 'student-policy-1';

export const DEFAULT_SCALE = [
  { letter: 'A', min: 90, max: 100 },
  { letter: 'B', min: 80, max: 89 },
  { letter: 'C', min: 70, max: 79 },
  { letter: 'D', min: 60, max: 69 },
  { letter: 'F', min: 0, max: 59 },
];

/** Fixed policy clock for tests that pass `now` explicitly (e.g. gradeStatus). */
export const POLICY_NOW = new Date('2025-06-15T12:00:00.000Z');

/** Relative to real clock so grading tests work without fake timers in Vitest. */
const msDay = 24 * 60 * 60 * 1000;
const now = Date.now();
export const PAST_DUE = new Date(now - 14 * msDay).toISOString();
export const FUTURE_DUE = new Date(now + 90 * msDay).toISOString();
export const LATE_SUBMIT_AT = new Date(now - 7 * msDay).toISOString();

export function aid(name: string): string {
  return `assign-${name}`;
}

export function buildCourse(groups: { name: string; weight: number }[] = []) {
  return { groups, gradeScale: DEFAULT_SCALE };
}

export function buildAssignment(opts: {
  id: string;
  title?: string;
  group: string;
  totalPoints?: number;
  published?: boolean;
  dueDate?: string;
  isDiscussion?: boolean;
  hasSubmitted?: boolean;
  [key: string]: unknown;
}) {
  const totalPoints = opts.totalPoints ?? 100;
  const { id, title, group, published, dueDate, isDiscussion, hasSubmitted, ...rest } = opts;
  return {
    _id: id,
    title: title || id,
    group,
    totalPoints,
    questions: [{ points: totalPoints }],
    published: published ?? true,
    dueDate: dueDate ?? PAST_DUE,
    isDiscussion: isDiscussion ?? false,
    hasSubmitted: hasSubmitted ?? false,
    ...rest,
  };
}

export function buildGrades(
  studentId: string,
  entries: Record<string, number | string | null | undefined>
) {
  const sid = String(studentId);
  const grades: Record<string, Record<string, number | string>> = { [sid]: {} };
  for (const [assignmentId, value] of Object.entries(entries)) {
    if (value === 'excused') {
      grades[sid][String(assignmentId)] = 'excused';
    } else if (typeof value === 'number') {
      grades[sid][String(assignmentId)] = value;
    }
  }
  return grades;
}

export function buildSubmissionMap(
  assignmentIds: string[],
  studentId: string = STUDENT_ID
) {
  const map: Record<string, string> = {};
  for (const id of assignmentIds) {
    map[`${studentId}_${id}`] = `sub-${id}`;
  }
  return map;
}

export function case1StandardWeighted() {
  const groups = [
    { name: 'Assignments', weight: 40 },
    { name: 'Quizzes', weight: 30 },
    { name: 'Discussions', weight: 20 },
    { name: 'Attendance', weight: 10 },
  ];
  const assignments = [
    buildAssignment({ id: aid('a1'), group: 'Assignments' }),
    buildAssignment({ id: aid('q1'), group: 'Quizzes' }),
    buildAssignment({ id: aid('d1'), group: 'Discussions' }),
    buildAssignment({ id: aid('att1'), group: 'Attendance' }),
  ];
  const grades = buildGrades(STUDENT_ID, {
    [aid('a1')]: 80,
    [aid('q1')]: 90,
    [aid('d1')]: 70,
    [aid('att1')]: 100,
  });
  const submissionMap = buildSubmissionMap(assignments.map((a) => a._id));
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap,
    studentSubmissions: [] as any[],
    expectedPercent: 83,
    expectedLetter: 'B',
  };
}

export function case2MissingAssignment() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const missingId = aid('missing');
  const doneId = aid('done');
  const assignments = [
    buildAssignment({ id: missingId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: doneId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [doneId]: 100 });
  const submissionMap = buildSubmissionMap([doneId]);
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap,
    studentSubmissions: [] as any[],
    expectedPercent: 50,
    expectedLetter: 'F',
    missingAssignmentId: missingId,
  };
}

export function case3SubmittedNotGraded() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('graded');
  const pendingId = aid('pending');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments' }),
    buildAssignment({ id: pendingId, group: 'Assignments' }),
  ];
  const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
  const submissionMap = buildSubmissionMap([gradedId, pendingId]);
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap,
    studentSubmissions: [] as any[],
    expectedPercent: 80,
    pendingAssignmentId: pendingId,
  };
}

export function case5Excused() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('graded');
  const excusedId = aid('excused');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments' }),
    buildAssignment({ id: excusedId, group: 'Assignments' }),
  ];
  const grades = buildGrades(STUDENT_ID, {
    [gradedId]: 80,
    [excusedId]: 'excused',
  });
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap: buildSubmissionMap([gradedId, excusedId]),
    studentSubmissions: [{ _id: 'sub-excused', submittedAt: new Date().toISOString(), excused: true }],
    expectedPercent: 80,
    excusedAssignmentId: excusedId,
  };
}

export function case4Unpublished() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const publishedId = aid('pub');
  const hiddenId = aid('hidden');
  const assignments = [
    buildAssignment({ id: publishedId, group: 'Assignments', published: true }),
    buildAssignment({ id: hiddenId, group: 'Assignments', published: false }),
  ];
  const grades = buildGrades(STUDENT_ID, { [publishedId]: 90, [hiddenId]: 0 });
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap: buildSubmissionMap([publishedId]),
    studentSubmissions: [] as any[],
    expectedPercent: 90,
    hiddenAssignmentId: hiddenId,
  };
}

export function case6WeightRedistribution() {
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
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap: buildSubmissionMap([aid('only')]),
    studentSubmissions: [] as any[],
    expectedPercent: 80,
  };
}

export function case7LateSubmission() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const lateId = aid('late');
  const assignments = [
    buildAssignment({ id: lateId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [lateId]: 85 });
  const submissionMap = buildSubmissionMap([lateId]);
  const studentSubmissions = [
    { _id: submissionMap[`${STUDENT_ID}_${lateId}`], submittedAt: LATE_SUBMIT_AT },
  ];
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap,
    studentSubmissions,
    expectedPercent: 85,
    lateAssignmentId: lateId,
  };
}

export function case8ManualGrade() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const manualId = aid('manual');
  const assignments = [buildAssignment({ id: manualId, group: 'Assignments' })];
  const grades = buildGrades(STUDENT_ID, { [manualId]: 92 });
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap: buildSubmissionMap([manualId]),
    studentSubmissions: [] as any[],
    expectedPercent: 92,
  };
}

export function case9GroupAssignment() {
  const groups = [{ name: 'Group Work', weight: 100 }];
  const groupAssignId = aid('group');
  const assignments = [buildAssignment({ id: groupAssignId, group: 'Group Work' })];
  const grades = buildGrades(STUDENT_ID, { [groupAssignId]: 88 });
  return {
    studentId: STUDENT_ID,
    course: buildCourse(groups),
    assignments,
    grades,
    submissionMap: buildSubmissionMap([groupAssignId]),
    studentSubmissions: [] as any[],
    expectedPercent: 88,
  };
}

export function case10TranscriptCourses() {
  return [
    { letterGrade: 'A', creditHours: 3 },
    { letterGrade: 'B', creditHours: 4 },
    { letterGrade: 'C', creditHours: 3 },
  ];
}
