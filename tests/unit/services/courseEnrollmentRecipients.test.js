const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');
const User = require('../../../models/user.model');
const Course = require('../../../models/course.model');
const {
  resolveActiveCourseStudentIds,
  filterToActiveCourseStudentIds,
  isActiveCourseStudent,
} = require('../../../services/notification/courseEnrollmentRecipients.service');

describe('courseEnrollmentRecipients.service', () => {
  let mongoServer;
  let teacher;
  let activeStudent;
  let otherStudent;
  let course;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: `cer-teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    activeStudent = await User.create({
      firstName: 'Active',
      lastName: 'Student',
      email: `cer-active.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    otherStudent = await User.create({
      firstName: 'Other',
      lastName: 'Student',
      email: `cer-other.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    const staleRosterId = new mongoose.Types.ObjectId();

    course = await Course.create({
      title: 'Enrollment Filter Course',
      description: 'Test',
      instructor: teacher._id,
      students: [activeStudent._id, teacher._id, staleRosterId],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('returns only existing users with student role from roster', async () => {
    const ids = await resolveActiveCourseStudentIds(course);
    expect(ids).toEqual([String(activeStudent._id)]);
  });

  it('filters candidate IDs to active enrollments', async () => {
    const filtered = await filterToActiveCourseStudentIds(
      [activeStudent._id, otherStudent._id, teacher._id],
      course
    );
    expect(filtered).toEqual([String(activeStudent._id)]);
  });

  it('isActiveCourseStudent returns true only for active roster students', async () => {
    expect(await isActiveCourseStudent(activeStudent._id, course)).toBe(true);
    expect(await isActiveCourseStudent(otherStudent._id, course)).toBe(false);
    expect(await isActiveCourseStudent(teacher._id, course)).toBe(false);
  });
});
