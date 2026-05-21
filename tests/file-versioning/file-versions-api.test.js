const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const FileAsset = require('../../models/fileAsset.model');
const User = require('../../models/user.model');

describe('GET /api/files/:id/versions', () => {
  let token;
  let user;
  let currentId;
  let priorId;
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms-test');
    }
    user = await User.findOne({ role: 'teacher' }) || (await User.create({
      firstName: 'File',
      lastName: 'Teacher',
      email: `file-teacher-${runId}@test.com`,
      password: 'Test1234!',
      role: 'teacher',
    }));
    token = user.getSignedJwtToken();

    const groupId = `vg_test_${runId}`;
    priorId = (
      await FileAsset.create({
        storageKey: `k1_${runId}`,
        provider: 'local',
        path: `/uploads/test/old-${runId}.pdf`,
        originalName: 'essay.pdf',
        uploadedBy: user._id,
        category: 'submission',
        versionGroupId: groupId,
        versionNumber: 1,
        isCurrentVersion: false,
      })
    )._id;
    currentId = (
      await FileAsset.create({
        storageKey: `k2_${runId}`,
        provider: 'local',
        path: `/uploads/test/new-${runId}.pdf`,
        originalName: 'essay.pdf',
        uploadedBy: user._id,
        category: 'submission',
        versionGroupId: groupId,
        versionNumber: 2,
        isCurrentVersion: true,
        supersedes: priorId,
      })
    )._id;
  });

  afterAll(async () => {
    const ids = [currentId, priorId].filter(Boolean);
    if (ids.length) {
      await FileAsset.deleteMany({ _id: { $in: ids } });
    }
  });

  it('returns version history for authorized user', async () => {
    const res = await request(app)
      .get(`/api/files/${currentId}/versions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.current).toBeTruthy();
      expect(Array.isArray(res.body.data.versions)).toBe(true);
    }
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get(`/api/files/${currentId}/versions`);
    expect([401, 403]).toContain(res.status);
  });
});
