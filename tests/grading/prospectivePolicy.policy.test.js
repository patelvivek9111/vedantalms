/**
 * prospective_only apply mode — pre-cutoff work uses submission policy snapshot.
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const gradingPolicyService = require('../../services/gradingPolicy.service');
const gradingPolicyImpactService = require('../../services/gradingPolicyImpact.service');
const { generateResolvedPolicySnapshot } = require('../../shared/grading/policySnapshot.cjs');
const { resolveEffectivePolicyForAssignment } = require('../../shared/grading/policyApplication.cjs');
const { DEFAULT_GRADING_POLICY } = require('../../shared/grading/policyDefaults.cjs');

const PAST_DUE = new Date('2020-06-01T00:00:00.000Z');
const LATE_SUBMIT = new Date('2020-06-15T10:00:00.000Z');
const LEGACY_GRADED_AT = new Date('2026-01-01T12:00:00.000Z');
const CUTOFF = new Date('2026-07-01T12:00:00.000Z');

const LATE_POLICY = {
  ...DEFAULT_GRADING_POLICY.latePenalty,
  enabled: true,
  mode: 'fixed',
  fixedPercent: 10,
};

describe('prospective_only policy application', () => {
  let mongoServer;
  let courseId;
  let studentId;
  let teacherId;
  let hw1Id;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();

    const teacher = await User.create({
      firstName: 'Prospective',
      lastName: 'Teacher',
      email: `prospective.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: 'Snap',
      lastName: 'Student',
      email: `prospective.student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentId = String(student._id);

    const course = await Course.create({
      title: 'Prospective Policy Course',
      description: 'Test',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Spring', year: 2026 },
      groups: [{ name: 'Assignments', weight: 100 }],
      gradeScale: [
        { letter: 'A', min: 90, max: 100 },
        { letter: 'B', min: 80, max: 89 },
        { letter: 'F', min: 0, max: 59 },
      ],
    });
    courseId = String(course._id);

    const mod = await Module.create({ title: 'M1', course: course._id, published: true });
    const hw1 = await Assignment.create({
      module: mod._id,
      title: 'HW1',
      description: 'Test',
      availableFrom: PAST_DUE,
      createdBy: teacher._id,
      questions: [{ id: 'q1', type: 'text', text: 'Q1', points: 100 }],
      totalPoints: 100,
      published: true,
      dueDate: PAST_DUE,
      group: 'Assignments',
    });
    hw1Id = String(hw1._id);

    await gradingPolicyService.upsertCoursePolicy(
      courseId,
      { policy: { latePenalty: LATE_POLICY } },
      teacherId
    );

    const courseLean = await Course.findById(courseId).lean();
    const legacyResolved = await gradingPolicyService.getResolvedPolicyForCourse(courseLean);
    const legacySnapshot = generateResolvedPolicySnapshot(legacyResolved);

    await Submission.create({
      assignment: hw1._id,
      student: student._id,
      submittedBy: student._id,
      submittedAt: LATE_SUBMIT,
      grade: 100,
      gradedAt: LEGACY_GRADED_AT,
      gradingPolicySnapshot: legacySnapshot.resolvedPolicySnapshot,
    });
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('resolveEffectivePolicyForAssignment uses snapshot before cutoff', () => {
    const live = {
      latePenalty: { ...LATE_POLICY, enabled: false },
      groups: [{ name: 'Assignments', weight: 100 }],
      policyApplication: {
        applyMode: 'prospective_only',
        effectiveAt: CUTOFF.toISOString(),
        legacyPolicy: { latePenalty: LATE_POLICY },
      },
    };
    const submission = {
      gradedAt: LEGACY_GRADED_AT,
      submittedAt: LATE_SUBMIT,
      gradingPolicySnapshot: { latePenalty: LATE_POLICY },
    };
    const assignment = { _id: hw1Id, dueDate: PAST_DUE };

    const effective = resolveEffectivePolicyForAssignment(live, submission, assignment, 'current');
    expect(effective.latePenalty.enabled).toBe(true);
  });

  it('impact preview: prospective preserves late penalty on pre-cutoff graded work', async () => {
    const retro = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, {
      policy: { latePenalty: { ...LATE_POLICY, enabled: false } },
      applyMode: 'retroactive_all',
      effectiveAt: CUTOFF.toISOString(),
    });

    const prospective = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, {
      policy: { latePenalty: { ...LATE_POLICY, enabled: false } },
      applyMode: 'prospective_only',
      effectiveAt: CUTOFF.toISOString(),
    });

    const retroRow = retro.students.find((s) => s.studentId === studentId);
    const prospRow = prospective.students.find((s) => s.studentId === studentId);

    expect(retroRow.currentPercent).toBe(90);
    expect(retroRow.proposedPercent).toBe(100);
    expect(prospRow.proposedPercent).toBe(90);
    expect(prospRow.proposedPercent).toBeLessThan(retroRow.proposedPercent);
    expect(prospective.applyMode).toBe('prospective_only');
  });
});
