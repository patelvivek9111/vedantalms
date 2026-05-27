jest.mock('../../models/course.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/module.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/GroupSet', () => ({ findById: jest.fn() }));
jest.mock('../../models/Group', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../../models/thread.model', () => ({ findById: jest.fn() }));
jest.mock('../../services/gradeLifecycle.service', () => ({
  getLifecycle: jest.fn(),
  FINALIZED_STATUSES: new Set(['FINALIZED', 'AMENDED']),
}));

const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Group = require('../../models/Group');
const gradeLifecycleService = require('../../services/gradeLifecycle.service');
const access = require('../../services/discussionAccess.service');

const now = new Date('2026-01-15T12:00:00.000Z');
const student = { _id: 'student1', role: 'student' };
const otherStudent = { _id: 'student2', role: 'student' };
const teacher = { _id: 'teacher1', role: 'teacher' };
const otherTeacher = { _id: 'teacher2', role: 'teacher' };
const ta = { _id: 'ta1', role: 'teaching_assistant' };

function course(overrides = {}) {
  return {
    _id: 'course1',
    instructor: 'teacher1',
    teachingAssistants: ['ta1'],
    students: ['student1'],
    operationalStatus: 'active',
    semester: { term: 'Spring', year: 2026 },
    ...overrides,
  };
}

function thread(overrides = {}) {
  return {
    _id: 'thread1',
    course: 'course1',
    module: 'module1',
    published: true,
    availableFrom: new Date('2026-01-01T00:00:00.000Z'),
    dueDate: new Date('2026-02-01T00:00:00.000Z'),
    settings: { allowComments: true, requirePostBeforeSee: false },
    replies: [],
    studentGrades: [],
    ...overrides,
  };
}

function mockContext({ modulePublished = true, coursePatch = {}, groupMember = true } = {}) {
  Course.findById.mockResolvedValue(course(coursePatch));
  Module.findById.mockResolvedValue({ _id: 'module1', published: modulePublished });
  Group.findById.mockResolvedValue({ _id: 'group1', groupSet: 'set1' });
  Group.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(groupMember ? { _id: 'group1' } : null),
  });
  gradeLifecycleService.getLifecycle.mockResolvedValue(null);
}

describe('discussion access policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [thread({ published: false }), 'DISCUSSION_NOT_PUBLISHED'],
    [thread({ availableFrom: new Date('2026-02-01T00:00:00.000Z') }), 'DISCUSSION_NOT_AVAILABLE'],
  ])('blocks hidden discussion state %#', async (discussion, expectedCode) => {
    mockContext();
    await expect(access.assertStudentCanViewDiscussion(student, discussion, { now })).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it('blocks module-hidden discussions for students', async () => {
    mockContext({ modulePublished: false });
    await expect(access.assertStudentCanViewDiscussion(student, thread(), { now })).rejects.toMatchObject({
      code: 'MODULE_NOT_PUBLISHED',
    });
  });

  it('blocks students outside the course or group', async () => {
    mockContext();
    await expect(access.assertStudentCanViewDiscussion(otherStudent, thread(), { now })).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });

    mockContext({ groupMember: false });
    await expect(
      access.assertStudentCanViewDiscussion(student, thread({ groupSet: 'set1', groupId: 'group1' }), { now })
    ).rejects.toMatchObject({
      code: 'GROUP_DISCUSSION_FORBIDDEN',
    });
  });

  it('allows assigned course staff and rejects global teacher access', async () => {
    mockContext({ modulePublished: false });
    await expect(access.assertStudentCanModerateDiscussion(teacher, thread())).resolves.toMatchObject({
      course: expect.objectContaining({ _id: 'course1' }),
    });
    await expect(access.assertStudentCanModerateDiscussion(ta, thread())).resolves.toMatchObject({
      course: expect.objectContaining({ _id: 'course1' }),
    });
    await expect(access.assertStudentCanModerateDiscussion(otherTeacher, thread())).rejects.toMatchObject({
      code: 'DISCUSSION_MODERATE_NOT_AUTHORIZED',
    });
  });

  it('allows admin, instructor, and TA to view without student enrollment path', async () => {
    const admin = { _id: 'admin1', role: 'admin' };
    mockContext();
    await expect(access.assertStudentCanViewDiscussion(admin, thread(), { now })).resolves.toMatchObject({
      thread: expect.objectContaining({ _id: 'thread1' }),
    });
    await expect(access.assertStudentCanViewDiscussion(teacher, thread(), { now })).resolves.toMatchObject({
      thread: expect.objectContaining({ _id: 'thread1' }),
    });
    await expect(access.assertStudentCanViewDiscussion(ta, thread(), { now })).resolves.toMatchObject({
      thread: expect.objectContaining({ _id: 'thread1' }),
    });
  });

  it('rejects unrelated teacher with COURSE_STAFF_REQUIRED on view (not NOT_ENROLLED)', async () => {
    mockContext();
    await expect(access.assertStudentCanViewDiscussion(otherTeacher, thread(), { now })).rejects.toMatchObject({
      code: 'COURSE_STAFF_REQUIRED',
    });
  });

  it('allows student view when published field is omitted (legacy)', async () => {
    mockContext();
    const legacy = thread();
    delete legacy.published;
    await expect(access.assertStudentCanViewDiscussion(student, legacy, { now })).resolves.toMatchObject({
      thread: expect.objectContaining({ _id: 'thread1' }),
    });
  });

  it('still blocks explicit unpublished threads for students', async () => {
    mockContext();
    await expect(access.assertStudentCanViewDiscussion(student, thread({ published: false }), { now })).rejects.toMatchObject({
      code: 'DISCUSSION_NOT_PUBLISHED',
    });
  });

  it('blocks replies when comments are disabled, locked, archived, or finalized', async () => {
    mockContext();
    await expect(
      access.assertStudentCanReply(student, thread({ settings: { allowComments: false } }), { now })
    ).rejects.toMatchObject({ code: 'COMMENTS_DISABLED' });

    mockContext();
    await expect(access.assertStudentCanReply(student, thread({ locked: true }), { now })).rejects.toMatchObject({
      code: 'DISCUSSION_LOCKED',
    });

    mockContext({ coursePatch: { operationalStatus: 'archived' } });
    await expect(access.assertStudentCanReply(student, thread(), { now })).rejects.toMatchObject({
      code: 'COURSE_ARCHIVED',
    });

    mockContext();
    gradeLifecycleService.getLifecycle.mockResolvedValue({ status: 'FINALIZED' });
    await expect(access.assertStudentCanReply(student, thread(), { now })).rejects.toMatchObject({
      code: 'DISCUSSION_LOCKED',
    });
  });

  it('filters require-post-first replies and student grade rows', () => {
    const discussion = thread({
      settings: { requirePostBeforeSee: true, allowComments: true },
      replies: [{ _id: 'reply1', author: 'student2', content: '<p>hidden</p>' }],
      studentGrades: [{ student: 'student2', grade: 9, feedback: 'private' }],
    });
    const payload = access.filterDiscussionForStudent(student, discussion);
    expect(payload.replies).toEqual([]);
    expect(payload.replyCount).toBe(0);
    expect(payload.studentGrades).toEqual([]);
  });
});
