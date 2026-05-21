const mongoose = require('mongoose');
const {
  createFileDownloadToken,
  verifyFileDownloadToken,
} = require('../../services/fileAccess.service');
const {
  canAccessStudentRecord,
  isEnrolledStudent,
} = require('../../middleware/academicPermissions');

describe('file access — download tokens', () => {
  const fileAssetId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  test('creates and verifies user-bound download token', () => {
    const { token } = createFileDownloadToken(fileAssetId, userId);
    expect(verifyFileDownloadToken(fileAssetId, userId, token)).toBe(true);
    expect(verifyFileDownloadToken(fileAssetId, 'other-user', token)).toBe(false);
  });

  test('rejects tampered token', () => {
    const { token } = createFileDownloadToken(fileAssetId, userId);
    expect(verifyFileDownloadToken(fileAssetId, userId, `${token}x`)).toBe(false);
  });
});

describe('file access — FERPA enrollment', () => {
  const course = {
    _id: 'c1',
    instructor: 't1',
    students: ['s1'],
    teachingAssistants: [],
  };

  test('enrolled student passes enrollment check', () => {
    expect(isEnrolledStudent({ _id: 's1', role: 'student' }, course)).toBe(true);
    expect(isEnrolledStudent({ _id: 's2', role: 'student' }, course)).toBe(false);
  });

  test('student record isolation', () => {
    expect(canAccessStudentRecord({ _id: 's1', role: 'student' }, 's1')).toBe(true);
    expect(canAccessStudentRecord({ _id: 's1', role: 'student' }, 's2')).toBe(false);
  });
});
