const request = require('supertest');
const mongoose = require('mongoose');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');

describe('Phase 1 multi-tenant isolation', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let rootA;
  let rootB;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /tenant-phase1\.example\.com/i }),
      Course.deleteMany({ title: /Tenant Phase1/i }),
    ]);

    rootA = await ensureDefaultRootAccount();
    rootB = await Account.create({
      name: 'School B',
      code: 'SCHOOLB',
      parentAccountId: null,
      institutionMode: 'school',
    });
    await AccountDomain.create({
      rootAccountId: rootB._id,
      host: 'schoolb.test',
      isPrimary: true,
      verifiedAt: new Date(),
    });

    const teacherA = await User.create({
      firstName: 'Teach',
      lastName: 'A',
      email: 'teacher-a@tenant-phase1.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    const teacherB = await User.create({
      firstName: 'Teach',
      lastName: 'B',
      email: 'teacher-b@tenant-phase1.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });

    await Course.create({
      title: 'Tenant Phase1 Course A',
      description: 'Only for root A',
      instructor: teacherA._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      catalog: {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-01'),
        subject: 'Math',
      },
    });
    await Course.create({
      title: 'Tenant Phase1 Course B',
      description: 'Only for root B',
      instructor: teacherB._id,
      published: true,
      rootAccountId: rootB._id,
      accountId: rootB._id,
      catalog: {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-01'),
        subject: 'Science',
      },
    });
  });

  afterAll(async () => {
    clearTenantCache();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('GET /api/tenant/current resolves default institution', async () => {
    const res = await request(app).get('/api/tenant/current').set('Host', 'localhost');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(rootA.code);
    expect(String(res.body.data.rootAccountId)).toBe(String(rootA._id));
  });

  it('catalog on schoolb.test does not include root A courses', async () => {
    const res = await request(app).get('/api/catalog').set('Host', 'schoolb.test');
    expect(res.status).toBe(200);
    const titles = (res.body || []).map((c) => c.title);
    expect(titles).toContain('Tenant Phase1 Course B');
    expect(titles).not.toContain('Tenant Phase1 Course A');
  });

  it('same email can exist on two roots; login is host-scoped', async () => {
    await User.create({
      firstName: 'Shared',
      lastName: 'Student',
      email: 'shared@tenant-phase1.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await User.create({
      firstName: 'Shared',
      lastName: 'Other',
      email: 'shared@tenant-phase1.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });

    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'shared@tenant-phase1.example.com', password: 'Password1!' });
    expect(loginA.status).toBe(200);
    expect(loginA.body.user.lastName).toBe('Student');
    expect(String(loginA.body.user.rootAccountId)).toBe(String(rootA._id));

    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Host', 'schoolb.test')
      .send({ email: 'shared@tenant-phase1.example.com', password: 'Password1!' });
    expect(loginB.status).toBe(200);
    expect(loginB.body.user.lastName).toBe('Other');
    expect(String(loginB.body.user.rootAccountId)).toBe(String(rootB._id));
  });

  it('teacher from A cannot list courses when Host is school B', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'teacher-a@tenant-phase1.example.com', password: 'Password1!' });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const denied = await request(app)
      .get('/api/courses')
      .set('Host', 'schoolb.test')
      .set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get('/api/courses')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    const titles = (ok.body.data || []).map((c) => c.title);
    expect(titles).toContain('Tenant Phase1 Course A');
    expect(titles).not.toContain('Tenant Phase1 Course B');
  });
});
