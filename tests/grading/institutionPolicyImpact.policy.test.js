const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
const gradingPolicyService = require('../../services/gradingPolicy.service');

describe('institution policy impact summary', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('counts published vs finalized courses', async () => {
    const instructor = await User.create({
      firstName: 'Inst',
      lastName: 'Admin',
      email: `inst.impact.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });

    const draftCourse = await Course.create({
      title: 'Draft',
      description: 'd',
      instructor: instructor._id,
      published: true,
      semester: { term: 'Spring', year: 2026 },
    });
    const finalizedCourse = await Course.create({
      title: 'Finalized',
      description: 'f',
      instructor: instructor._id,
      published: true,
      semester: { term: 'Spring', year: 2026 },
    });
    await Course.create({
      title: 'Unpublished',
      description: 'u',
      instructor: instructor._id,
      published: false,
      semester: { term: 'Spring', year: 2026 },
    });

    await CourseGradeLifecycle.create({
      course: finalizedCourse._id,
      term: 'Spring',
      year: 2026,
      status: 'FINALIZED',
    });

    const summary = await gradingPolicyService.getInstitutionPolicyImpactSummary();
    expect(summary.totalPublishedCourses).toBe(2);
    expect(summary.finalizedCourseCount).toBe(1);
    expect(summary.liveRecalcCourseCount).toBe(1);
    expect(String(draftCourse._id)).toBeTruthy();
  });
});
