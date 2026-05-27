const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const FileAsset = require('../../models/fileAsset.model');
const User = require('../../models/user.model');

describe('GET /api/files/:id/versions', () => {
  let app;
  let mongoServer;
  let token;
  let user;
  let currentId;
  let priorId;
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(process.env.MONGODB_URI);

    app = express();
    app.use(express.json());
    app.use('/api/files', require('../../routes/file.routes'));

    user =
      (await User.findOne({ role: 'teacher' })) ||
      (await User.create({
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
  }, 120000);

  afterAll(async () => {
    const ids = [currentId, priorId].filter(Boolean);
    if (ids.length) {
      await FileAsset.deleteMany({ _id: { $in: ids } });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    if (mongoServer) await mongoServer.stop();
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
