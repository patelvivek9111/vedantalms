const { IMMUTABLE_CATEGORIES, assertFileMutable } = require('../../services/fileGovernance.service');

jest.mock('../../models/fileAsset.model', () => ({}));
jest.mock('../../models/course.model', () => ({
  findById: jest.fn(),
}));
jest.mock('../../models/courseGradeLifecycle.model', () => ({
  findOne: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../models/Submission', () => ({
  findById: jest.fn().mockResolvedValue(null),
}));

describe('file governance immutability', () => {
  test('immutable categories include registrar exports', () => {
    expect(IMMUTABLE_CATEGORIES.has('grade-export')).toBe(true);
    expect(IMMUTABLE_CATEGORIES.has('transcript')).toBe(true);
  });

  test('blocks mutation on lifecycleLocked assets', async () => {
    await expect(
      assertFileMutable({ lifecycleLocked: true, category: 'assignment' }, { action: 'delete' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('blocks delete on immutable category', async () => {
    await expect(
      assertFileMutable({ lifecycleLocked: false, category: 'transcript' }, { action: 'delete' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
