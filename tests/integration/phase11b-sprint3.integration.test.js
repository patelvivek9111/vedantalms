const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const todoQueryService = require('../../services/planner/todoQuery.service');
const plannerFeedService = require('../../services/planner/plannerFeed.service');
const {
  fanoutAcademicDomainNotifications,
} = require('../../services/notification/academicNotificationExpansion.service');

jest.mock('../../services/domain/createNotificationFromDomainEvent', () => ({
  createNotificationFromDomainEvent: jest.fn(),
}));

jest.mock('../../services/planner/plannerUxState.service', () => ({
  getActiveStateMapForUser: jest.fn().mockResolvedValue(new Map()),
  filterItemsByUxState: jest.fn((items) => items),
}));

jest.mock('../../services/planner/plannerPriority.service', () => ({
  rankPlannerItems: jest.fn((items) => items),
  applyFeedCap: jest.fn((items) => ({
    items,
    capped: false,
    totalBeforeCap: items.length,
  })),
}));

const { createNotificationFromDomainEvent } = require('../../services/domain/createNotificationFromDomainEvent');
const { DOMAIN_EVENTS } = require('../../services/domain/eventTaxonomy');

describe('Phase 11B Sprint 3 integration', () => {
  let mongoServer;
  let teacher;
  let student;
  let course;
  let moduleDoc;
  const originalExpansion = process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
  const originalPlanner = process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED;
  const originalPlannerUx = process.env.PLANNER_UX_ENABLED;
  const originalConcurrency = process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = 'true';
    process.env.PLANNER_UX_ENABLED = 'true';
    process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY = '10';

    teacher = await User.create({
      firstName: 'S3',
      lastName: 'Teacher',
      email: `p11b-s3-teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    student = await User.create({
      firstName: 'S3',
      lastName: 'Student',
      email: `p11b-s3-student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    course = await Course.create({
      title: 'Sprint 3 Course',
      description: 'Integration course',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    moduleDoc = await Module.create({
      title: 'Week 1',
      course: course._id,
      published: true,
    });
  }, 120000);

  afterAll(async () => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = originalExpansion;
    process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = originalPlanner;
    process.env.PLANNER_UX_ENABLED = originalPlannerUx;
    if (originalConcurrency == null) {
      delete process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY;
    } else {
      process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY = originalConcurrency;
    }
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    createNotificationFromDomainEvent.mockResolvedValue({ _id: 'n1' });
  });

  it('planner partial failure still returns successful feed', async () => {
    await Assignment.create({
      title: 'Past Due Assignment',
      description: 'Late work',
      module: moduleDoc._id,
      availableFrom: new Date(Date.now() - 7 * 86400000),
      dueDate: new Date(Date.now() - 2 * 86400000),
      createdBy: teacher._id,
      published: true,
    });

    const dueSoonSpy = jest
      .spyOn(todoQueryService, 'getStudentDueAllItemsThisWeek')
      .mockRejectedValue(new Error('due-soon unavailable'));

    const feed = await plannerFeedService.buildPlannerFeedForUser(student._id, 'student');

    expect(feed.items.some((item) => item.title === 'Past Due Assignment')).toBe(true);
    dueSoonSpy.mockRestore();
  });

  it('large-recipient notification fanout delivers concurrently', async () => {
    const students = await User.insertMany(
      Array.from({ length: 100 }, (_, index) => ({
        firstName: 'Bulk',
        lastName: `Student${index}`,
        email: `p11b-s3-bulk-${Date.now()}-${index}@example.com`,
        password: 'password123',
        role: 'student',
      }))
    );

    course.students = [student._id, ...students.map((row) => row._id)];
    await course.save();

    let inFlight = 0;
    let maxInFlight = 0;
    createNotificationFromDomainEvent.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return { _id: 'n1' };
    });

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.COURSE_PUBLISHED,
      recipientIds: course.students,
      actorId: teacher._id,
      relatedId: course._id,
      buildContextForRecipient: () => ({
        title: 'Course Published',
        message: 'Course is live',
        recipientRole: 'student',
      }),
    });

    expect(result.delivered).toBe(course.students.length);
    expect(result.failed).toBe(0);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });

  it('mixed success and failure recipient fanout isolates failures', async () => {
    const recipients = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
    createNotificationFromDomainEvent
      .mockResolvedValueOnce({ _id: 'n1' })
      .mockRejectedValueOnce(new Error('recipient failed'))
      .mockResolvedValueOnce({ _id: 'n3' })
      .mockRejectedValueOnce(new Error('recipient failed'))
      .mockResolvedValueOnce({ _id: 'n5' });

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientIds: recipients,
      actorId: new mongoose.Types.ObjectId(),
      relatedId: new mongoose.Types.ObjectId(),
      buildContextForRecipient: () => ({
        title: 'Assignment',
        message: 'Created',
        recipientRole: 'student',
      }),
    });

    expect(result.delivered).toBe(3);
    expect(result.failed).toBe(2);
    expect(createNotificationFromDomainEvent).toHaveBeenCalledTimes(5);
  });
});
