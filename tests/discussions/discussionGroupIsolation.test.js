jest.mock('../../models/course.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/module.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/GroupSet', () => ({ findById: jest.fn() }));
jest.mock('../../models/Group', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../../models/thread.model', () => ({ findById: jest.fn() }));
jest.mock('../../services/gradeLifecycle.service', () => ({
  getLifecycle: jest.fn().mockResolvedValue(null),
  FINALIZED_STATUSES: new Set(['FINALIZED']),
}));

const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Group = require('../../models/Group');
const access = require('../../services/discussionAccess.service');

describe('discussion group isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Course.findById.mockResolvedValue({
      _id: 'course1',
      students: ['student1'],
      instructor: 'teacher1',
      teachingAssistants: [],
      operationalStatus: 'active',
    });
    Module.findById.mockResolvedValue(null);
    Group.findById.mockResolvedValue({ _id: 'group1', groupSet: 'set1' });
  });

  it('requires membership in the scoped group partition', async () => {
    Group.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    await expect(access.assertStudentCanViewDiscussion(
      { _id: 'student1', role: 'student' },
      { _id: 'thread1', course: 'course1', groupSet: 'set1', groupId: 'group1', published: true, settings: {} }
    )).rejects.toMatchObject({ code: 'GROUP_DISCUSSION_FORBIDDEN' });
  });
});
