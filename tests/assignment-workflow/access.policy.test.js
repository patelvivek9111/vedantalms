jest.mock('../../models/Assignment', () => ({ findById: jest.fn() }));
jest.mock('../../models/module.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/GroupSet', () => ({ findById: jest.fn() }));
jest.mock('../../models/Submission', () => ({ findOne: jest.fn() }));
jest.mock('../../models/Group', () => ({ findOne: jest.fn() }));
jest.mock('../../services/gradeLifecycle.service', () => ({
  getLifecycle: jest.fn(),
  FINALIZED_STATUSES: new Set(['FINALIZED', 'AMENDED']),
}));

const Assignment = require('../../models/Assignment');
const Module = require('../../models/module.model');
const Submission = require('../../models/Submission');
const Group = require('../../models/Group');
const gradeLifecycleService = require('../../services/gradeLifecycle.service');
const access = require('../../services/assignmentAccess.service');

const student = { _id: 'student1', role: 'student' };
const teacher = { _id: 'teacher1', role: 'teacher' };
const ta = { _id: 'ta1', role: 'teaching_assistant' };
const now = new Date('2026-01-15T12:00:00.000Z');

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

function assignment(overrides = {}) {
  return {
    _id: 'assignment1',
    module: 'module1',
    published: true,
    availableFrom: new Date('2026-01-01T00:00:00.000Z'),
    dueDate: new Date('2026-02-01T00:00:00.000Z'),
    lockAfterDue: true,
    ...overrides,
  };
}

function mockContext({ modulePublished = true, assignmentPublished = true, availableFrom, coursePatch = {} } = {}) {
  Assignment.findById.mockResolvedValue(assignment({
    published: assignmentPublished,
    availableFrom: availableFrom ?? new Date('2026-01-01T00:00:00.000Z'),
  }));
  Module.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue({
      _id: 'module1',
      published: modulePublished,
      course: course(coursePatch),
    }),
  });
  gradeLifecycleService.getLifecycle.mockResolvedValue(null);
}

describe('assignment access policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Submission.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
    Group.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
  });

  it.each([
    [false, true, new Date('2026-01-01T00:00:00.000Z'), 'MODULE_NOT_PUBLISHED'],
    [true, false, new Date('2026-01-01T00:00:00.000Z'), 'ASSIGNMENT_NOT_PUBLISHED'],
    [true, true, new Date('2026-02-01T00:00:00.000Z'), 'ASSIGNMENT_NOT_AVAILABLE'],
    [true, true, new Date('2026-01-01T00:00:00.000Z'), null],
  ])('student matrix module=%s assignment=%s availableFrom=%s', async (modulePublished, assignmentPublished, availableFrom, expectedCode) => {
    mockContext({ modulePublished, assignmentPublished, availableFrom });
    if (expectedCode) {
      await expect(access.assertStudentCanViewAssignment(student, 'assignment1', { now })).rejects.toMatchObject({
        code: expectedCode,
      });
    } else {
      await expect(access.assertStudentCanViewAssignment(student, 'assignment1', { now })).resolves.toMatchObject({
        assignment: expect.objectContaining({ _id: 'assignment1' }),
      });
    }
  });

  it('blocks student submission after finalized course term', async () => {
    mockContext();
    gradeLifecycleService.getLifecycle.mockResolvedValue({ status: 'FINALIZED' });
    await expect(access.assertStudentCanSubmitAssignment(student, 'assignment1', { now })).rejects.toMatchObject({
      code: 'COURSE_GRADES_FINALIZED',
    });
  });

  it('blocks student submission in archived courses', async () => {
    mockContext({ coursePatch: { operationalStatus: 'archived' } });
    await expect(access.assertStudentCanSubmitAssignment(student, 'assignment1', { now })).rejects.toMatchObject({
      code: 'COURSE_ARCHIVED',
    });
  });

  it('allows authorized staff preview and returns preview metadata', async () => {
    mockContext({ modulePublished: false, assignmentPublished: false });
    await expect(access.assertStudentCanViewAssignment(teacher, 'assignment1', { preview: true, now })).resolves.toMatchObject({
      previewMetadata: expect.objectContaining({
        preview: true,
        assignmentPublished: false,
        modulePublished: false,
      }),
    });
    await expect(access.assertStudentCanViewAssignment(ta, 'assignment1', { preview: true, now })).resolves.toMatchObject({
      previewMetadata: expect.objectContaining({ preview: true }),
    });
  });

  it('honors the current module state when an assignment is moved or a module is toggled', async () => {
    Assignment.findById.mockResolvedValue(assignment({ module: 'module2' }));
    Module.findById.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue({
        _id: 'module2',
        published: false,
        course: course(),
      }),
    });

    await expect(access.assertStudentCanViewAssignment(student, 'assignment1', { now })).rejects.toMatchObject({
      code: 'MODULE_NOT_PUBLISHED',
    });

    Module.findById.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue({
        _id: 'module2',
        published: true,
        course: course(),
      }),
    });
    await expect(access.assertStudentCanViewAssignment(student, 'assignment1', { now })).resolves.toMatchObject({
      module: expect.objectContaining({ _id: 'module2', published: true }),
    });
  });

  it('does not carry stale availability from copied assignments', async () => {
    Assignment.findById.mockResolvedValueOnce(assignment({
      _id: 'copied-assignment',
      availableFrom: new Date('2026-02-01T00:00:00.000Z'),
    }));
    Module.findById.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue({
        _id: 'module1',
        published: true,
        course: course({ _id: 'copied-course' }),
      }),
    });

    await expect(access.assertStudentCanViewAssignment(student, 'copied-assignment', { now })).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_AVAILABLE',
      details: expect.objectContaining({ availableFrom: '2026-02-01T00:00:00.000Z' }),
    });
  });

  it('allows students with graded submissions to view unpublished assignments', async () => {
    mockContext({ modulePublished: false, assignmentPublished: false });
    Submission.findOne.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'submission1' }),
      }),
    });

    await expect(access.assertStudentCanViewAssignment(student, 'assignment1', { now })).resolves.toMatchObject({
      assignment: expect.objectContaining({ _id: 'assignment1' }),
      gradedAccess: true,
    });
  });
});
