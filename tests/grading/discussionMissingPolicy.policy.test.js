/**
 * Discussion missing-assignment policy — grade engine must match resolved policy.
 * Reproduces: graded discussion 80/100 + missing past-due discussion(s).
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Thread = require('../../models/thread.model');
const gradingPolicyService = require('../../services/gradingPolicy.service');
const { computeStudentCourseGrade } = require('../../services/gradeCalculation.service');
const { getCourseGradebookPage } = require('../../services/gradebookData.service');
const { computeGroupPointTotals } = require('../../shared/grading/gradeCalculation.cjs');

const PAST_DUE = new Date('2020-06-01T00:00:00.000Z');

describe('discussion missing policy', () => {
  let mongoServer;
  let courseId;
  let studentId;
  let teacherId;
  let gradedDiscussionId;
  let missingDiscussionId;
  let cutoffAssignmentId;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();

    const teacher = await User.create({
      firstName: 'Policy',
      lastName: 'Teacher',
      email: `disc.policy.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: 'Student',
      lastName: 'P',
      email: `disc.policy.student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentId = String(student._id);

    const course = await Course.create({
      title: 'Discussion Policy Course',
      description: 'Test',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Spring', year: 2026 },
      groups: [
        { name: 'Assignments', weight: 40 },
        { name: 'Discussions', weight: 20 },
        { name: 'Quizzes', weight: 30 },
        { name: 'Attendance', weight: 10 },
      ],
      gradeScale: [
        { letter: 'A', min: 90, max: 100 },
        { letter: 'B', min: 80, max: 89 },
        { letter: 'C', min: 70, max: 79 },
        { letter: 'D', min: 60, max: 69 },
        { letter: 'F', min: 0, max: 59 },
      ],
    });
    courseId = String(course._id);

    const gradedThread = await Thread.create({
      course: course._id,
      title: 'Introduce yourself',
      content: 'Say hi',
      author: teacher._id,
      isGraded: true,
      published: true,
      totalPoints: 100,
      group: 'Discussions',
      dueDate: PAST_DUE,
      studentGrades: [{ student: student._id, grade: 80, gradedAt: new Date() }],
      createdBy: teacher._id,
    });
    gradedDiscussionId = String(gradedThread._id);

    const missingThread = await Thread.create({
      course: course._id,
      title: 'Subtraction',
      content: 'Discuss subtraction',
      author: teacher._id,
      isGraded: true,
      published: true,
      totalPoints: 100,
      group: 'Discussions',
      dueDate: PAST_DUE,
      studentGrades: [],
      createdBy: teacher._id,
    });
    missingDiscussionId = String(missingThread._id);

    const thirdMissing = await Thread.create({
      course: course._id,
      title: 'Subtraction part 2',
      content: 'More subtraction',
      author: teacher._id,
      isGraded: true,
      published: true,
      totalPoints: 100,
      group: 'Discussions',
      dueDate: PAST_DUE,
      studentGrades: [],
      createdBy: teacher._id,
    });
    const mod = await Module.create({ title: 'M1', course: course._id, published: true });
    const cutoff = await Assignment.create({
      module: mod._id,
      title: 'Future cutoff',
      description: 'Policy cutoff',
      createdBy: teacher._id,
      questions: [{ id: 'q1', type: 'text', text: 'Q', points: 100 }],
      totalPoints: 100,
      published: true,
      availableFrom: PAST_DUE,
      dueDate: new Date('2099-12-31'),
      group: 'Quizzes',
    });
    cutoffAssignmentId = String(cutoff._id);

    await Thread.create({
      course: course._id,
      title: 'Addition placeholder',
      content: 'Not graded',
      author: teacher._id,
      isGraded: false,
      published: true,
      createdBy: teacher._id,
    });
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  async function gradeWithPolicy(mode, applyMode = 'retroactive_all', effectiveAssignmentId = null) {
    await gradingPolicyService.upsertCoursePolicy(
      courseId,
      {
        policy: { missingAssignment: { mode } },
        applyMode,
        effectiveAssignmentId,
        reason: 'policy test',
      },
      teacherId
    );
    const courseLean = await Course.findById(courseId).lean();
    return computeStudentCourseGrade(courseLean, studentId, { audience: 'instructor' });
  }

  it('exclude_until_graded: missing discussions excluded from denominator (80/100 in group)', async () => {
    const result = await gradeWithPolicy('exclude_until_graded');
    expect(result.resolved.missingAssignment.mode).toBe('exclude_until_graded');

    const discussions = result.allAssignments.filter((a) => a.isDiscussion);
    const stats = computeGroupPointTotals(
      studentId,
      discussions,
      result.grades,
      {},
      result.resolved,
      'Discussions'
    );
    expect(stats.totalEarned).toBe(80);
    expect(stats.totalPossible).toBe(100);
    expect(stats.includedCount).toBe(1);
  });

  it('count_as_zero retroactive: missing discussions count as 0 (80/300 in group)', async () => {
    const result = await gradeWithPolicy('count_as_zero', 'retroactive_all');
    expect(result.resolved.missingAssignment.mode).toBe('count_as_zero');
    expect(result.resolved.policyApplication?.applyMode).toBe('retroactive_all');
    expect(result.resolved.policyApplication?.legacyPolicy).toBeFalsy();

    const discussions = result.allAssignments.filter((a) => a.isDiscussion);
    const stats = computeGroupPointTotals(
      studentId,
      discussions,
      result.grades,
      {},
      result.resolved,
      'Discussions'
    );
    expect(stats.totalEarned).toBe(80);
    expect(stats.totalPossible).toBe(300);
    expect(stats.includedCount).toBe(3);
  });

  it('count_as_zero saved but from_assignment: pre-cutoff missing still uses legacy exclude', async () => {
    const before = await gradeWithPolicy('exclude_until_graded', 'retroactive_all');
    const after = await gradeWithPolicy('count_as_zero', 'from_assignment', cutoffAssignmentId);

    expect(after.resolved.missingAssignment.mode).toBe('count_as_zero');
    expect(after.resolved.policyApplication?.applyMode).toBe('from_assignment');
    expect(after.resolved.policyApplication?.legacyPolicy?.missingAssignment?.mode).toBe(
      'exclude_until_graded'
    );

    const discussions = after.allAssignments.filter((a) => a.isDiscussion);
    const stats = computeGroupPointTotals(
      studentId,
      discussions,
      after.grades,
      {},
      after.resolved,
      'Discussions'
    );
    expect(stats.totalPossible).toBe(100);
    expect(stats.totalEarned).toBe(80);
    expect(after.currentPercent).toBeCloseTo(before.currentPercent, 1);
  });

  it('count_as_zero retroactive: student and instructor totals match when grades are released', async () => {
    const instructorResult = await gradeWithPolicy('count_as_zero', 'retroactive_all');
    const courseLean = await Course.findById(courseId).lean();
    const studentResult = await computeStudentCourseGrade(courseLean, studentId, {
      audience: 'student',
    });
    expect(studentResult.currentPercent).toBeCloseTo(instructorResult.currentPercent, 5);
  });

  it('gradebook API reports policy meta matching calculation policy', async () => {
    await gradeWithPolicy('exclude_until_graded', 'retroactive_all');
    const page = await getCourseGradebookPage(courseId, { page: 1, pageSize: 50 });
    expect(page.policyMeta.missingAssignmentMode).toBe('exclude_until_graded');
    expect(page.instructorTotals[studentId]).toBeDefined();
    expect(page.studentTotals[studentId]).toBeDefined();
  });

  it('gradebook studentTotals matches student course grade API under count_as_zero', async () => {
    await gradeWithPolicy('count_as_zero', 'retroactive_all');
    const page = await getCourseGradebookPage(courseId, { page: 1, pageSize: 50 });
    const courseLean = await Course.findById(courseId).lean();
    const studentResult = await computeStudentCourseGrade(courseLean, studentId, {
      audience: 'student',
    });
    expect(page.studentTotals[studentId]).toBeCloseTo(studentResult.currentPercent, 2);
  });
});
