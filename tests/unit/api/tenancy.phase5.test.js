const request = require('supertest');
const mongoose = require('mongoose');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');
const {
  ensureQuota,
  updateQuota,
  assertSeatAvailable,
  assertStorageWithinQuota,
} = require('../../../services/tenancy/accountQuota.service');
const { resolveShardForRoot } = require('../../../config/tenantShardMap');
const {
  createFileDownloadToken,
  verifyFileDownloadToken,
} = require('../../../services/fileAccess.service');
const { exportInstitutionBundle } = require('../../../services/export/institutionalExport.service');
const { enqueueJob, executeJob } = require('../../../services/jobQueue.service');

describe('Phase 5 platform ops + isolation hardening', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let AccountQuota;
  let SystemAuditEvent;
  let SupportImpersonationSession;
  let rootA;
  let rootB;
  let platformToken;
  let platformUser;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    AccountQuota = require('../../../models/accountQuota.model');
    SystemAuditEvent = require('../../../models/systemAuditEvent.model');
    SupportImpersonationSession = require('../../../models/supportImpersonationSession.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phase5\./i }),
      Course.deleteMany({ title: /Phase5/i }),
      AccountQuota.deleteMany({}),
      SystemAuditEvent.deleteMany({ entityType: 'support_impersonation' }),
      SupportImpersonationSession.deleteMany({}),
    ]);

    rootA = await ensureDefaultRootAccount();
    const b = await provisionRootAccount({
      name: 'Phase5 School B',
      code: 'PHASE5B',
      host: 'phase5b.test',
      adminEmail: 'admin@phase5.b.example.com',
      adminPassword: 'Password1!',
      planCode: 'starter',
    });
    rootB = b.account;

    platformUser = await User.create({
      firstName: 'Plat',
      lastName: 'Form',
      email: 'platform@phase5.ops.example.com',
      password: 'Password1!',
      role: 'platform_admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'platform@phase5.ops.example.com', password: 'Password1!' });
    platformToken = login.body.token;
  });

  afterAll(async () => {
    clearTenantCache();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

  it('suspended root is not resolved by Host', async () => {
    await request(app)
      .patch(`/api/platform/accounts/${rootB._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ workflowState: 'suspended' });

    clearTenantCache();
    const res = await request(app).get('/api/tenant/current').set('Host', 'phase5b.test');
    expect(res.status).toBe(404);
  });

  it('enforces seat and storage quotas per root', async () => {
    await updateQuota(rootA._id, { maxSeats: 1, maxStorageBytes: 10 });
    await assertSeatAvailable(rootA._id, { additional: 0 }).catch(() => null);

    // rootA already has platform user (+ maybe default users) — forcing maxSeats=1 should block extra seats
    await expect(assertSeatAvailable(rootA._id, { additional: 1 })).rejects.toMatchObject({
      code: 'SEAT_QUOTA_EXCEEDED',
    });

    await expect(assertStorageWithinQuota(rootA._id, 100)).rejects.toMatchObject({
      code: 'TENANT_STORAGE_QUOTA_EXCEEDED',
    });
  });

  it('domain verify stub sets verifiedAt and tlsStatus', async () => {
    const add = await request(app)
      .post(`/api/platform/accounts/${rootA._id}/domains`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ host: 'custom.phase5a.test', isCustomDomain: true });

    expect(add.status).toBe(201);
    const domainId = add.body.data._id;

    const verify = await request(app)
      .post(`/api/platform/accounts/${rootA._id}/domains/${domainId}/verify`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ force: true });

    expect(verify.status).toBe(200);
    expect(verify.body.data.verifiedAt).toBeTruthy();
    expect(['pending', 'active']).toContain(verify.body.data.tlsStatus);
  });

  it('download token is tenant-bound', () => {
    const assetId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    const { token } = createFileDownloadToken(assetId, userId, {
      rootAccountId: rootA._id,
    });
    expect(verifyFileDownloadToken(assetId, userId, token, { rootAccountId: rootA._id })).toBe(true);
    expect(verifyFileDownloadToken(assetId, userId, token, { rootAccountId: rootB._id })).toBe(false);
  });

  it('jobs require rootAccountId and reject missing tenant', async () => {
    await expect(
      enqueueJob('export.gradebook', {}, { _id: platformUser._id })
    ).rejects.toThrow(/rootAccountId/i);

    const AsyncJob = require('../../../models/asyncJob.model');
    const bad = await AsyncJob.create({
      type: 'export.gradebook',
      payload: {},
      requestedBy: platformUser._id,
      status: 'pending',
    });
    await expect(executeJob(bad)).rejects.toThrow(/rootAccountId/i);
  });

  it('tenant export only includes that root users/courses', async () => {
    const teacherA = await User.create({
      firstName: 'Teach',
      lastName: 'A',
      email: 'teacher@phase5.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await User.create({
      firstName: 'Teach',
      lastName: 'B',
      email: 'teacher@phase5.b.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });
    await Course.create({
      title: 'Phase5 Course A',
      description: 'A',
      instructor: teacherA._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      catalog: { startDate: new Date('2026-01-01'), endDate: new Date('2026-06-01') },
    });

    const result = await exportInstitutionBundle({
      rootAccountId: rootA._id,
      sections: ['users', 'courses'],
      includeBlobManifest: false,
      registerBackup: false,
      batchId: `phase5-export-${Date.now()}`,
    });

    expect(String(result.manifest.institutionId)).toBe(String(rootA._id));
    const fs = require('fs');
    const path = require('path');
    const usersFile = path.join(result.directory, result.sections.find((s) => s.name === 'users').file);
    const coursesFile = path.join(result.directory, result.sections.find((s) => s.name === 'courses').file);
    const usersRaw = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const coursesRaw = JSON.parse(fs.readFileSync(coursesFile, 'utf8'));
    const flatten = (raw) => {
      if (!Array.isArray(raw)) return raw.records || [];
      if (raw.length && Array.isArray(raw[0])) return raw.flat();
      return raw;
    };
    const userEmails = flatten(usersRaw).map((u) => u.email);
    expect(userEmails).toContain('teacher@phase5.a.example.com');
    expect(userEmails).not.toContain('teacher@phase5.b.example.com');
    const titles = flatten(coursesRaw).map((c) => c.title);
    expect(titles).toContain('Phase5 Course A');
  });

  it('impersonation creates audit and is tenant-scoped', async () => {
    const target = await User.create({
      firstName: 'Target',
      lastName: 'User',
      email: 'target@phase5.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: target, rootAccountId: rootA._id, role: 'student' });

    const start = await request(app)
      .post('/api/platform/impersonate')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        targetUserId: target._id,
        rootAccountId: rootA._id,
        reason: 'Support ticket 12345',
      });

    expect(start.status).toBe(201);
    expect(start.body.data.token).toBeTruthy();

    const audit = await SystemAuditEvent.find({
      entityType: 'support_impersonation',
      action: 'impersonation_started',
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(String(audit[0].rootAccountId)).toBe(String(rootA._id));

    const cross = await request(app)
      .post('/api/platform/impersonate')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        targetUserId: target._id,
        rootAccountId: rootB._id,
        reason: 'Wrong tenant attempt',
      });
    expect(cross.status).toBe(403);
  });

  it('shard map resolves DEFAULT to primary', () => {
    const shard = resolveShardForRoot({ rootAccountId: rootA._id, accountCode: rootA.code });
    expect(shard.isDedicated).toBe(false);
    expect(shard.label).toBe('primary');
    expect(shard.mongoUriEnvKey).toBe('MONGODB_URI');
  });

  it('quota API returns plan limits for platform admin', async () => {
    await ensureQuota(rootA._id);
    const res = await request(app)
      .get(`/api/platform/accounts/${rootA._id}/quota`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.maxSeats).toBeGreaterThan(0);
    expect(res.body.data.shard).toBeTruthy();
  });
});
