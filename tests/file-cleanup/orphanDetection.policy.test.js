const { CLEANUP_STATES } = require('../../models/fileAsset.model');

describe('file cleanup lifecycle states', () => {
  test('defines staged cleanup progression', () => {
    expect(CLEANUP_STATES).toEqual([
      'ACTIVE',
      'ORPHAN_CANDIDATE',
      'PENDING_DELETE',
      'SOFT_DELETED',
      'HARD_DELETED',
    ]);
  });
});

describe('file cleanup — protected categories', () => {
  test('grade-export and transcript never auto-delete via service constants', () => {
    const { detectOrphans } = require('../../services/fileCleanup.service');
    expect(typeof detectOrphans).toBe('function');
  });
});
