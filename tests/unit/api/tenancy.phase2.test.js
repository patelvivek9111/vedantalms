const request = require('supertest');
const mongoose = require('mongoose');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');

describe('Phase 2 identity + memberships', () => {
  let app;
  let Account;
  let AccountDomain;
  let AccountUser;
  let Pseudonym;
  let User;
  let ContactLead;
  let rootA;
  let rootB;
  let adminAToken;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    AccountUser = require('../../../models/accountUser.model');
    Pseudonym = require('../../../models/pseudonym.model');
    User = require('../../../models/user.model');
    ContactLead = require('../../../models/contactLead.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      AccountUser.deleteMany({}),
      Pseudonym.deleteMany({}),
      ContactLead.deleteMany({}),
      User.deleteMany({ email: /phase2\./i }),
    ]);

    rootA = await ensureDefaultRootAccount();
    const provisioned = await provisionRootAccount({
      name: 'School B Phase2',
      code: 'PHASE2B',
      host: 'phase2b.test',
      adminEmail: 'admin@phase2.schoolb.example.com',
      adminPassword: 'Password1!',
      adminFirstName: 'Admin',
      adminLastName: 'B',
    });
    rootB = provisioned.account;

    const adminA = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phase2.schoola.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');
    await ensureAccountMembership({
      user: adminA,
      rootAccountId: rootA._id,
      role: 'admin',
    });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phase2.schoola.example.com', password: 'Password1!' });
    adminAToken = login.body.token;
  });

  afterAll(async () => {
    clearTenantCache();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('admin user list is tenant-scoped', async () => {
    await User.create({
      firstName: 'Only',
      lastName: 'B',
      email: 'onlyb@phase2.schoolb.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    const emails = (res.body.data || []).map((u) => u.email);
    expect(emails).toContain('admin@phase2.schoola.example.com');
    expect(emails).not.toContain('onlyb@phase2.schoolb.example.com');
    expect(emails).not.toContain('admin@phase2.schoolb.example.com');
  });

  it('admin create user provisions membership without swapping session', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'New',
        lastName: 'Teacher',
        email: 'teacher@phase2.schoola.example.com',
        password: 'Password1!',
        role: 'teacher',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('teacher');
    expect(res.body.token).toBeUndefined();

    const membership = await AccountUser.findOne({
      userId: res.body.data._id,
      rootAccountId: rootA._id,
    });
    expect(membership).toBeTruthy();
    expect(membership.roles).toContain('teacher');

    const pseudo = await Pseudonym.findOne({
      rootAccountId: rootA._id,
      uniqueId: 'teacher@phase2.schoola.example.com',
    });
    expect(pseudo).toBeTruthy();
  });

  it('invite accept creates user in inviting root', async () => {
    const inviteRes = await request(app)
      .post('/api/admin/invites')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ email: 'invited@phase2.schoola.example.com', role: 'student' });

    expect(inviteRes.status).toBe(201);
    const inviteUrl = inviteRes.body.data.inviteUrl;
    expect(inviteUrl).toBeTruthy();
    const token = new URL(inviteUrl).searchParams.get('token');

    const accept = await request(app)
      .post('/api/auth/accept-invite')
      .set('Host', 'localhost')
      .send({
        token,
        firstName: 'Invited',
        lastName: 'Student',
        password: 'Password1!',
      });

    expect(accept.status).toBe(201);
    const user = await User.findOne({ email: 'invited@phase2.schoola.example.com' });
    expect(String(user.rootAccountId)).toBe(String(rootA._id));
  });

  it('contact inquiry creates a lead and platform can provision it', async () => {
    const platform = await User.create({
      firstName: 'Plat',
      lastName: 'Form',
      email: 'platform@phase2.ops.example.com',
      password: 'Password1!',
      role: 'platform_admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const platLogin = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'platform@phase2.ops.example.com', password: 'Password1!' });
    expect(platLogin.status).toBe(200);

    const inquiry = await request(app)
      .post('/api/contact/inquiry')
      .send({
        name: 'Lead Person',
        email: 'lead@phase2.org.example.com',
        organization: 'Phase2 Org',
        jobTitle: 'CIO',
        userCount: '200',
        extra: 'Please provision',
      });
    expect([200, 503]).toContain(inquiry.status);
    expect(inquiry.body.leadId || (await ContactLead.findOne({ email: 'lead@phase2.org.example.com' }))).toBeTruthy();

    const lead = await ContactLead.findOne({ email: 'lead@phase2.org.example.com' });
    expect(lead).toBeTruthy();

    const provision = await request(app)
      .post(`/api/platform/leads/${lead._id}/provision`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${platLogin.body.token}`)
      .send({ host: 'phase2org.test', adminPassword: 'Password1!' });

    expect([200, 201]).toContain(provision.status);
    expect(provision.body.data.account.code).toBeTruthy();

    const refreshed = await ContactLead.findById(lead._id);
    expect(refreshed.status).toBe('provisioned');
  });

  it('tenant/current exposes auth providers', async () => {
    const res = await request(app).get('/api/tenant/current').set('Host', 'localhost');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.authProviders)).toBe(true);
    expect(res.body.data.authProviders.some((p) => p.authType === 'password')).toBe(true);
  });
});
