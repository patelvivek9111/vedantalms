const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const GroupSet = require('../../models/GroupSet');
const Group = require('../../models/Group');
const Thread = require('../../models/thread.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
const discussionAccess = require('../../services/discussionAccess.service');
const {
  notifyAssignmentPublished,
  notifyDiscussionCreated,
  notifyDiscussionReplyPosted,
  notifyDiscussionGraded,
  notifyCoursePublished,
  notifyGradesAmended,
  resolveCourseFromAssignment,
} = require('../../services/notification/academicNotificationProducers.service');
const { fanoutAcademicDomainNotifications } = require('../../services/notification/academicNotificationExpansion.service');
const gradeLifecycleService = require('../../services/gradeLifecycle.service');
const todoQueryService = require('../../services/planner/todoQuery.service');
const plannerFeedService = require('../../services/planner/plannerFeed.service');

jest.mock('../../services/notification/academicNotificationExpansion.service', () => {
  const actual = jest.requireActual('../../services/notification/academicNotificationExpansion.service');
  return {
    ...actual,
    fanoutAcademicDomainNotifications: jest.fn(),
    isAcademicNotificationExpansionEnabled: jest.fn().mockReturnValue(true),
    isPlannerMissingAssignmentsEnabled: jest.fn().mockReturnValue(true),
  };
});

jest.mock('../../services/domain/createNotificationFromDomainEvent', () => ({
  createNotificationFromDomainEvent: jest.fn().mockResolvedValue({ _id: 'n1' }),
}));

const { createNotificationFromDomainEvent } = require('../../services/domain/createNotificationFromDomainEvent');

describe('Phase 11B Sprint 1 integration', () => {
  let mongoServer;
  let teacher;
  let studentEnrolled;
  let studentOther;
  let course;
  let otherCourse;
  let moduleDoc;
  let groupSet;
  let group;
  let taOnCourse;
  const originalExpansion = process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
  const originalPlanner = process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED;
  const originalPlannerUx = process.env.PLANNER_UX_ENABLED;
  const originalForceInline = process.env.FORCE_INLINE_JOBS;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = 'true';
    process.env.PLANNER_UX_ENABLED = 'true';
    process.env.FORCE_INLINE_JOBS = 'true';

    teacher = await User.create({
      firstName: 'Ann',
      lastName: 'Teacher',
      email: `p11b-teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    studentEnrolled = await User.create({
      firstName: 'En',
      lastName: 'Rolled',
      email: `p11b-student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentOther = await User.create({
      firstName: 'Out',
      lastName: 'Side',
      email: `p11b-other.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    course = await Course.create({
      title: 'Phase 11B Course',
      description: 'Integration course',
      instructor: teacher._id,
      students: [studentEnrolled._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    otherCourse = await Course.create({
      title: 'Other Course',
      description: 'Other',
      instructor: teacher._id,
      students: [studentOther._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    moduleDoc = await Module.create({
      title: 'Week 1',
      course: course._id,
      published: true,
    });

    groupSet = await GroupSet.create({
      name: 'Lab Groups',
      course: course._id,
    });

    group = await Group.create({
      name: 'Group A',
      groupSet: groupSet._id,
      course: course._id,
      groupId: `G-${Date.now()}`,
      members: [studentEnrolled._id],
    });

    taOnCourse = await User.create({
      firstName: 'Tee',
      lastName: 'Assistant',
      email: `p11b-s2-ta.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teaching_assistant',
    });
    course.teachingAssistants = [taOnCourse._id];
    await course.save();
  }, 120000);

  afterAll(async () => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = originalExpansion;
    process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = originalPlanner;
    process.env.PLANNER_UX_ENABLED = originalPlannerUx;
    process.env.FORCE_INLINE_JOBS = originalForceInline;
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fanoutAcademicDomainNotifications.mockResolvedValue({ delivered: 1, skipped: 0, suppressed: 0 });
  });

  it('resolves course for group assignment via groupSet', async () => {
    const assignment = await Assignment.create({
      title: 'Group Assignment',
      description: 'Group work',
      isGroupAssignment: true,
      groupSet: groupSet._id,
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
      published: true,
    });

    const resolved = await resolveCourseFromAssignment(assignment.toObject());
    expect(String(resolved._id)).toBe(String(course._id));
  });

  it('assignment publish notification fans out for module assignment', async () => {
    const assignment = await Assignment.create({
      title: 'Module Assignment',
      description: 'Work',
      module: moduleDoc._id,
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
      published: true,
    });

    await notifyAssignmentPublished({
      assignment,
      actor: teacher,
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'assignment.published',
        recipientIds: expect.arrayContaining([String(studentEnrolled._id)]),
      })
    );
  });

  it('group assignment publish notification fans out to course students', async () => {
    const assignment = await Assignment.create({
      title: 'Group Publish Assignment',
      description: 'Group work',
      isGroupAssignment: true,
      groupSet: groupSet._id,
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
      published: true,
    });

    await notifyAssignmentPublished({
      assignment,
      actor: teacher,
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'assignment.published',
      })
    );
  });

  it('group discussion create notifies only group members', async () => {
    const thread = await Thread.create({
      title: 'Group Discussion',
      content: '<p>Hello</p>',
      course: course._id,
      author: teacher._id,
      groupSet: groupSet._id,
      groupId: group._id,
      published: true,
    });

    const recipients = await discussionAccess.resolveDiscussionStudentRecipientIds(
      thread.toObject(),
      course.toObject()
    );

    expect(recipients).toEqual([String(studentEnrolled._id)]);

    await notifyDiscussionCreated({
      thread,
      course,
      actor: teacher,
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'discussion.created',
        recipientIds: [String(studentEnrolled._id)],
      })
    );
  });

  it('group discussion staff reply notifies only group members', async () => {
    const thread = await Thread.create({
      title: 'Group Reply Discussion',
      content: '<p>Hello</p>',
      course: course._id,
      author: teacher._id,
      groupSet: groupSet._id,
      groupId: group._id,
      published: true,
    });

    await notifyDiscussionReplyPosted({
      thread,
      course,
      actor: teacher,
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'discussion.reply',
        recipientIds: [String(studentEnrolled._id)],
      })
    );
  });

  it('course publish notification fans out to enrolled students', async () => {
    await notifyCoursePublished({ course, actor: teacher });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'course.published',
        recipientIds: [String(studentEnrolled._id)],
      })
    );
  });

  it('discussion grade notification respects visibility', async () => {
    createNotificationFromDomainEvent.mockClear();

    const visibleThread = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Visible Grade',
      course: course._id,
      isGraded: true,
      gradeHidden: false,
      discussionReleaseMode: 'immediate',
      gradesReleasedAt: new Date(),
      studentGrades: [{ student: studentEnrolled._id, grade: 9 }],
    };

    await notifyDiscussionGraded({
      thread: visibleThread,
      studentId: studentEnrolled._id,
      grade: 9,
      course,
      actor: teacher,
    });

    expect(createNotificationFromDomainEvent).toHaveBeenCalledTimes(1);

    createNotificationFromDomainEvent.mockClear();

    const hiddenThread = {
      ...visibleThread,
      gradeHidden: true,
      discussionReleaseMode: 'hidden',
      gradesReleasedAt: null,
    };

    await notifyDiscussionGraded({
      thread: hiddenThread,
      studentId: studentEnrolled._id,
      grade: 9,
      course,
      actor: teacher,
    });

    expect(createNotificationFromDomainEvent).not.toHaveBeenCalled();
  });

  it('grades.posted is idempotent on repeated transition', async () => {
    await CourseGradeLifecycle.deleteMany({ course: course._id });
    fanoutAcademicDomainNotifications.mockClear();

    await gradeLifecycleService.transitionToPosted(course._id, teacher, course);
    await gradeLifecycleService.transitionToPosted(course._id, teacher, course);

    const postedCalls = fanoutAcademicDomainNotifications.mock.calls.filter(
      (call) => call[0]?.domainEvent === 'grades.posted'
    );
    expect(postedCalls).toHaveLength(1);
  });

  it('planner due-soon and missing/overdue are enrollment-consistent', async () => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 2);

    await Assignment.create({
      title: 'Enrolled Past Due',
      description: 'Work',
      module: moduleDoc._id,
      availableFrom: new Date(Date.now() - 7 * 86400000),
      dueDate: new Date(Date.now() - 2 * 86400000),
      createdBy: teacher._id,
      published: true,
    });

    await Assignment.create({
      title: 'Other Course Due',
      description: 'Work',
      module: (
        await Module.create({
          title: 'Other Module',
          course: otherCourse._id,
          published: true,
        })
      )._id,
      availableFrom: new Date(Date.now() - 7 * 86400000),
      dueDate: new Date(Date.now() - 2 * 86400000),
      createdBy: teacher._id,
      published: true,
    });

    const dueSoon = await todoQueryService.getStudentDueAllItemsThisWeek(studentEnrolled._id);
    const missing = await todoQueryService.getStudentMissingAndOverdueAssignments(studentEnrolled._id);

    expect(dueSoon.every((item) => item.title !== 'Other Course Due')).toBe(true);
    expect(missing.every((item) => item.title !== 'Other Course Due')).toBe(true);
    expect(missing.some((item) => item.title === 'Enrolled Past Due')).toBe(true);
  });

  it('planner feed includes missing/overdue when flag enabled', async () => {
    const feed = await plannerFeedService.buildPlannerFeedForUser(
      studentEnrolled._id,
      'student'
    );

    expect(feed.items.some((item) => item.subType === 'missing' || item.subType === 'overdue')).toBe(
      true
    );
  });

  it('amendment notifications use distinct event window suffixes', async () => {
    const suffixes = [];
    for (const seq of [1, 2]) {
      fanoutAcademicDomainNotifications.mockClear();
      await notifyGradesAmended({
        course,
        studentIds: [studentEnrolled._id],
        actor: teacher,
        reason: 'Fix',
        amendmentSequence: seq,
      });
      const ctx = fanoutAcademicDomainNotifications.mock.calls[0][0].buildContextForRecipient(
        String(studentEnrolled._id)
      );
      suffixes.push(ctx.eventWindowSuffix);
    }
    expect(suffixes).toEqual(['amended:1', 'amended:2']);
  });

  it('student discussion reply notifies course teaching assistant', async () => {
    fanoutAcademicDomainNotifications.mockClear();

    const thread = await Thread.create({
      title: 'TA Notify Thread',
      content: '<p>Topic</p>',
      course: course._id,
      author: teacher._id,
      published: true,
    });

    await notifyDiscussionReplyPosted({
      thread,
      course,
      actor: studentEnrolled,
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'discussion.reply',
        recipientIds: expect.arrayContaining([String(taOnCourse._id), String(teacher._id)]),
        actorId: studentEnrolled._id,
      })
    );
  });

  it('unpublished discussion reply produces no notification', async () => {
    fanoutAcademicDomainNotifications.mockClear();

    const thread = await Thread.create({
      title: 'Draft Reply Thread',
      content: '<p>Draft</p>',
      course: course._id,
      author: teacher._id,
      published: false,
    });

    await notifyDiscussionReplyPosted({
      thread,
      course,
      actor: studentEnrolled,
    });

    expect(fanoutAcademicDomainNotifications).not.toHaveBeenCalled();
  });

  it('due-soon and missing/overdue share availableFrom filtering', async () => {
    const futureAvailable = new Date(Date.now() + 7 * 86400000);
    const pastDue = new Date(Date.now() - 2 * 86400000);

    await Assignment.create({
      title: 'Future Available Past Due',
      description: 'Hidden until future',
      module: moduleDoc._id,
      availableFrom: futureAvailable,
      dueDate: pastDue,
      createdBy: teacher._id,
      published: true,
    });

    const dueSoon = await todoQueryService.getStudentDueAllItemsThisWeek(studentEnrolled._id);
    const missing = await todoQueryService.getStudentMissingAndOverdueAssignments(
      studentEnrolled._id
    );

    expect(dueSoon.every((item) => item.title !== 'Future Available Past Due')).toBe(true);
    expect(missing.every((item) => item.title !== 'Future Available Past Due')).toBe(true);
  });
});
