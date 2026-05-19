/**
 * Seeds one deterministic grading-contract course for Mongo E2E tests.
 */
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade,
  resolveAssignmentGrade,
  buildGradesMapForStudent,
  getGradebookCellForExport,
  resolveGradingPolicy,
  courseContextFromResolvedPolicy,
} = require('../../shared/grading/index.cjs');
const { DEFAULT_GRADING_POLICY } = require('../../shared/grading/policyDefaults.cjs');

const PAST_DUE = new Date('2020-06-01T00:00:00.000Z');
const FUTURE_DUE = new Date('2099-12-01T00:00:00.000Z');
const ON_TIME_SUBMIT_AT = new Date('2020-05-15T10:00:00.000Z');
const LATE_SUBMIT_AT = new Date('2020-06-15T12:00:00.000Z');

const CONTRACT_GRADE_SCALE = [
  { letter: 'A', min: 90, max: 100 },
  { letter: 'B', min: 80, max: 89 },
  { letter: 'C', min: 70, max: 79 },
  { letter: 'D', min: 60, max: 69 },
  { letter: 'F', min: 0, max: 59 },
];

const CONTRACT_GROUPS = [
  { name: 'Assignments', weight: 50 },
  { name: 'Quizzes', weight: 30 },
  { name: 'Discussions', weight: 20 },
  { name: 'Attendance', weight: 10 },
];

function questionPoints(points = 100) {
  return [{ id: 'q1', type: 'text', text: 'Q1', points }];
}

async function seedGradingContractE2E() {
  const teacher = await User.create({
    firstName: 'Contract',
    lastName: 'Teacher',
    email: `grading.contract.teacher.${Date.now()}@example.com`,
    password: 'password123',
    role: 'teacher',
  });

  const student = await User.create({
    firstName: 'Contract',
    lastName: 'Student',
    email: `grading.contract.student.${Date.now()}@example.com`,
    password: 'password123',
    role: 'student',
  });

  const course = await Course.create({
    title: 'Grading Contract E2E',
    description: 'Deterministic grading contract validation course',
    instructor: teacher._id,
    students: [student._id],
    published: true,
    semester: { term: 'Spring', year: 2025 },
    groups: CONTRACT_GROUPS,
    gradeScale: CONTRACT_GRADE_SCALE,
  });

  const module = await Module.create({
    title: 'Contract Module',
    course: course._id,
    published: true,
  });

  const baseAssignment = {
    module: module._id,
    description: 'Contract assignment',
    availableFrom: PAST_DUE,
    createdBy: teacher._id,
    questions: questionPoints(100),
    totalPoints: 100,
    published: true,
  };

  const [graded, missing, pending, late, excused, gradedDisc, futureQuiz, unpublished] =
    await Assignment.insertMany([
      {
        ...baseAssignment,
        title: 'Graded',
        group: 'Assignments',
        dueDate: PAST_DUE,
      },
      {
        ...baseAssignment,
        title: 'Missing',
        group: 'Assignments',
        dueDate: PAST_DUE,
      },
      {
        ...baseAssignment,
        title: 'Pending',
        group: 'Assignments',
        dueDate: PAST_DUE,
      },
      {
        ...baseAssignment,
        title: 'Late Graded',
        group: 'Assignments',
        dueDate: PAST_DUE,
      },
      {
        ...baseAssignment,
        title: 'Excused',
        group: 'Discussions',
        dueDate: PAST_DUE,
      },
      {
        ...baseAssignment,
        title: 'Discussion Graded',
        group: 'Discussions',
        dueDate: PAST_DUE,
      },
      {
        ...baseAssignment,
        title: 'Future Quiz',
        group: 'Quizzes',
        dueDate: FUTURE_DUE,
      },
      {
        ...baseAssignment,
        title: 'Unpublished',
        group: 'Attendance',
        dueDate: PAST_DUE,
        published: false,
      },
    ]);

  const submissions = await Submission.insertMany([
    {
      assignment: graded._id,
      student: student._id,
      submittedBy: student._id,
      grade: 80,
      submittedAt: ON_TIME_SUBMIT_AT,
    },
    {
      assignment: pending._id,
      student: student._id,
      submittedBy: student._id,
      submittedAt: ON_TIME_SUBMIT_AT,
    },
    {
      assignment: late._id,
      student: student._id,
      submittedBy: student._id,
      grade: 85,
      submittedAt: LATE_SUBMIT_AT,
    },
    {
      assignment: excused._id,
      student: student._id,
      submittedBy: student._id,
      excused: true,
      grade: 0,
      submittedAt: ON_TIME_SUBMIT_AT,
    },
    {
      assignment: gradedDisc._id,
      student: student._id,
      submittedBy: student._id,
      grade: 70,
      submittedAt: ON_TIME_SUBMIT_AT,
    },
  ]);

  const assignments = [graded, missing, pending, late, excused, gradedDisc, futureQuiz, unpublished];
  const submissionMap = {};
  submissions.forEach((s) => {
    submissionMap[s.assignment.toString()] = s;
  });

  const sid = String(student._id);
  const allAssignments = assignments.map((a) => ({
    _id: a._id,
    title: a.title,
    group: a.group,
    totalPoints: a.totalPoints || 100,
    questions: a.questions,
    isDiscussion: false,
    published: a.published,
    dueDate: a.dueDate,
    grade: resolveAssignmentGrade({ submission: submissionMap[a._id.toString()] || null }),
  }));

  const grades = {};
  buildGradesMapForStudent(grades, sid, allAssignments);

  const resolved = resolveGradingPolicy({
    course: course.toObject(),
    institutionPolicy: { policy: DEFAULT_GRADING_POLICY, version: 1 },
  });
  const courseContext = courseContextFromResolvedPolicy(resolved);
  const expectedPercent = calculateFinalGradeWithWeightedGroups(
    sid,
    courseContext,
    allAssignments,
    grades,
    submissionMap,
    resolved
  );
  const expectedLetter = getLetterGrade(expectedPercent, resolved.gradeScale);

  const studentForCell = { _id: student._id };
  const compositeSubmissionMap = {};
  submissions.forEach((s) => {
    compositeSubmissionMap[`${sid}_${s.assignment}`] = String(s._id);
  });

  const cellExpectations = {
    graded: getGradebookCellForExport(studentForCell, graded.toObject(), grades, compositeSubmissionMap, submissions),
    missing: getGradebookCellForExport(studentForCell, missing.toObject(), grades, compositeSubmissionMap, submissions),
    pending: getGradebookCellForExport(studentForCell, pending.toObject(), grades, compositeSubmissionMap, submissions),
    unpublished: getGradebookCellForExport(
      studentForCell,
      unpublished.toObject(),
      grades,
      compositeSubmissionMap,
      submissions
    ),
    excused: getGradebookCellForExport(studentForCell, excused.toObject(), grades, compositeSubmissionMap, submissions),
    late: getGradebookCellForExport(studentForCell, late.toObject(), grades, compositeSubmissionMap, submissions),
  };

  return {
    courseId: course._id.toString(),
    teacherId: teacher._id.toString(),
    teacherToken: teacher.getSignedJwtToken(),
    studentId: student._id.toString(),
    studentToken: student.getSignedJwtToken(),
    expectedPercent,
    expectedLetter,
    cellExpectations,
    assignmentIds: {
      graded: graded._id.toString(),
      missing: missing._id.toString(),
      pending: pending._id.toString(),
      late: late._id.toString(),
      excused: excused._id.toString(),
      unpublished: unpublished._id.toString(),
    },
  };
}

module.exports = {
  seedGradingContractE2E,
  CONTRACT_GRADE_SCALE,
  PAST_DUE,
  FUTURE_DUE,
};
