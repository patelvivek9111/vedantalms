/**
 * Policy impact preview — dry-run proposed policy against enrolled students.
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const CourseGradingPolicy = require('../../models/courseGradingPolicy.model');
const gradingPolicyImpactService = require('../../services/gradingPolicyImpact.service');
const gradingPolicyService = require('../../services/gradingPolicy.service');

const PAST_DUE = new Date('2020-06-01T00:00:00.000Z');

describe('gradingPolicyImpact', () => {
  let mongoServer;
  let courseId;
  let studentStrongId;
  let studentMissingId;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();

    const teacher = await User.create({
      firstName: 'Impact',
      lastName: 'Teacher',
      email: `impact.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });

    const studentStrong = await User.create({
      firstName: 'Strong',
      lastName: 'Student',
      email: `impact.strong.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    const studentMissing = await User.create({
      firstName: 'Missing',
      lastName: 'Student',
      email: `impact.missing.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    studentStrongId = String(studentStrong._id);
    studentMissingId = String(studentMissing._id);

    const course = await Course.create({
      title: 'Impact Preview Course',
      description: 'Policy impact tests',
      instructor: teacher._id,
      students: [studentStrong._id, studentMissing._id],
      published: true,
      semester: { term: 'Spring', year: 2026 },
      groups: [
        { name: 'Assignments', weight: 100 },
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

    const mod = await Module.create({ title: 'M1', course: course._id, published: true });

    const baseAssignment = {
      module: mod._id,
      description: 'Impact test assignment',
      availableFrom: PAST_DUE,
      createdBy: teacher._id,
      questions: [{ id: 'q1', type: 'text', text: 'Q1', points: 100 }],
      totalPoints: 100,
      published: true,
      dueDate: PAST_DUE,
      group: 'Assignments',
    };

    const hw1 = await Assignment.create({ ...baseAssignment, title: 'HW1' });
    const hw2 = await Assignment.create({ ...baseAssignment, title: 'HW2' });

    await Submission.create({
      assignment: hw1._id,
      student: studentStrong._id,
      submittedBy: studentStrong._id,
      grade: 90,
      gradedAt: new Date(),
    });
    await Submission.create({
      assignment: hw2._id,
      student: studentStrong._id,
      submittedBy: studentStrong._id,
      grade: 90,
      gradedAt: new Date(),
    });

    await Submission.create({
      assignment: hw1._id,
      student: studentMissing._id,
      submittedBy: studentMissing._id,
      grade: 100,
      gradedAt: new Date(),
    });

    await gradingPolicyService.upsertCoursePolicy(
      courseId,
      {
        policy: { missingAssignment: { mode: 'exclude_until_graded' } },
      },
      teacher._id
    );
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('reports no affected students when policy is unchanged', async () => {
    const result = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, {});
    expect(result.policyUnchanged).toBe(true);
    expect(result.summary.affectedCount).toBe(0);
    expect(result.students).toHaveLength(2);
  });

  it('shows grade drop for missing work when switching to count_as_zero', async () => {
    const result = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, {
      policy: { missingAssignment: { mode: 'count_as_zero' } },
    });

    expect(result.policyUnchanged).toBe(false);
    expect(result.summary.affectedCount).toBe(1);

    const strong = result.students.find((s) => s.studentId === studentStrongId);
    const missing = result.students.find((s) => s.studentId === studentMissingId);

    expect(strong.currentPercent).toBe(90);
    expect(strong.proposedPercent).toBe(90);
    expect(strong.changed).toBe(false);

    expect(missing.currentPercent).toBe(100);
    expect(missing.proposedPercent).toBe(50);
    expect(missing.deltaPercent).toBe(-50);
    expect(missing.changed).toBe(true);
    expect(missing.currentLetter).toBe('A');
    expect(missing.proposedLetter).toBe('F');
  });

  it('includes policy diff summary lines', async () => {
    const result = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, {
      policy: { missingAssignment: { mode: 'count_as_zero' } },
    });
    expect(result.policyDiff.summaryLines.length).toBeGreaterThan(0);
    expect(result.policyDiff.summaryLines.some((l) => l.includes('missingAssignment'))).toBe(true);
  });
});
