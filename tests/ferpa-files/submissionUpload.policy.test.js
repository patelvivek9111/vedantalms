const { assertCourseFilesMutable } = require('../../services/fileLifecycle.service');
const gradeLifecycleService = require('../../services/gradeLifecycle.service');

jest.mock('../../services/gradeLifecycle.service', () => ({
  getLifecycle: jest.fn(),
  FINALIZED_STATUSES: new Set(['FINALIZED', 'AMENDED']),
}));

describe('FERPA files — finalized course lock', () => {
  const course = { _id: 'course1', semester: { term: 'Fall', year: 2025 } };
  const user = { _id: 'teacher1', role: 'teacher' };

  beforeEach(() => {
    gradeLifecycleService.getLifecycle.mockReset();
  });

  test('blocks file mutation when course grades are finalized', async () => {
    gradeLifecycleService.getLifecycle.mockResolvedValue({ status: 'FINALIZED' });

    await expect(
      assertCourseFilesMutable(course, user, { action: 'submission_file_update' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('allows file mutation in draft lifecycle', async () => {
    gradeLifecycleService.getLifecycle.mockResolvedValue({ status: 'DRAFT' });

    await expect(
      assertCourseFilesMutable(course, user, { action: 'submission_file_update' })
    ).resolves.toBeDefined();
  });
});
