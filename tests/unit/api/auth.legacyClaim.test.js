const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');

describe('Auth — legacy user claim gate', () => {
  let app;
  let User;
  let SystemAuditEvent;
  let rootA;
  let previousClaimFlag;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    User = require('../../../models/user.model');
    SystemAuditEvent = require('../../../models/systemAuditEvent.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    previousClaimFlag = process.env.ALLOW_LEGACY_USER_CLAIM;
    rootA = await ensureDefaultRootAccount();
    await User.deleteMany({ email: /legacy-claim\./i });
    await SystemAuditEvent.deleteMany({ action: 'auth.legacy_user_claimed' });
  });

  afterEach(() => {
    if (previousClaimFlag === undefined) {
      delete process.env.ALLOW_LEGACY_USER_CLAIM;
    } else {
      process.env.ALLOW_LEGACY_USER_CLAIM = previousClaimFlag;
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: /legacy-claim\./i });
    await SystemAuditEvent.deleteMany({ action: 'auth.legacy_user_claimed' });
  });

  test('ALLOW_LEGACY_USER_CLAIM=true claims unscoped user into login tenant and audits', async () => {
    process.env.ALLOW_LEGACY_USER_CLAIM = 'true';

    const legacy = await User.create({
      firstName: 'Legacy',
      lastName: 'Claim',
      email: 'legacy-claim.on@example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: undefined,
      accountId: undefined,
    });
    await User.updateOne(
      { _id: legacy._id },
      { $unset: { rootAccountId: 1, accountId: 1 } }
    );

    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'legacy-claim.on@example.com', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const claimed = await User.findById(legacy._id).lean();
    expect(String(claimed.rootAccountId)).toBe(String(rootA._id));

    const audit = await SystemAuditEvent.findOne({
      action: 'auth.legacy_user_claimed',
      entityId: String(legacy._id),
    }).lean();
    expect(audit).toBeTruthy();
    expect(String(audit.actor)).toBe(String(legacy._id));
    expect(audit.metadata?.email).toBe('legacy-claim.on@example.com');
    expect(audit.before?.rootAccountId == null).toBe(true);
    expect(String(audit.after?.rootAccountId)).toBe(String(rootA._id));
    expect(audit.createdAt).toBeInstanceOf(Date);
  });

  test('ALLOW_LEGACY_USER_CLAIM=false does not claim unscoped user', async () => {
    process.env.ALLOW_LEGACY_USER_CLAIM = 'false';

    const legacy = await User.create({
      firstName: 'Legacy',
      lastName: 'Blocked',
      email: 'legacy-claim.off@example.com',
      password: 'Password1!',
      role: 'student',
    });
    await User.updateOne(
      { _id: legacy._id },
      { $unset: { rootAccountId: 1, accountId: 1 } }
    );

    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'legacy-claim.off@example.com', password: 'Password1!' });

    expect(res.status).toBe(401);

    const untouched = await User.findById(legacy._id).lean();
    expect(untouched.rootAccountId == null).toBe(true);

    const audit = await SystemAuditEvent.findOne({
      action: 'auth.legacy_user_claimed',
      entityId: String(legacy._id),
    }).lean();
    expect(audit).toBeNull();
  });
});
