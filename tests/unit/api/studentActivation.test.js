const request = require('supertest');
const mongoose = require('mongoose');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');

jest.mock('../../../utils/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Student self-service account activation', () => {
  let app;
  let Account;
  let User;
  let AccountInvite;
  let PendingStudentRoster;
  let StudentActivationAttempt;
  let sendEmail;
  let root;
  const HOST = 'localhost';

  const GENERIC_ERROR = "We couldn't verify your information. Please contact your registrar.";
  const GENERIC_SUCCESS =
    "If your information matches our records, you'll receive an email shortly.";

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    User = require('../../../models/user.model');
    AccountInvite = require('../../../models/accountInvite.model');
    PendingStudentRoster = require('../../../models/pendingStudentRoster.model');
    StudentActivationAttempt = require('../../../models/studentActivationAttempt.model');
    sendEmail = require('../../../utils/emailService').sendEmail;
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    sendEmail.mockClear();

    root = await ensureDefaultRootAccount();
    await Account.updateOne(
      { _id: root._id },
      {
        $set: {
          domain: 'lincolnhigh.edu',
          studentEmailMode: 'auto-generate',
        },
      }
    );
    root = await Account.findById(root._id);

    const AccountUser = require('../../../models/accountUser.model');
    const Pseudonym = require('../../../models/pseudonym.model');

    const activationUsers = await User.find({
      rootAccountId: root._id,
      $or: [
        { email: /@(activate\.example\.com|lincolnhigh\.edu)$/i },
        { personalEmail: /@personal\.example\.com$/i },
        { 'studentProfile.studentId': { $in: ['12345678', '12349999', '55554444'] } },
      ],
    })
      .select('_id')
      .lean();
    const activationUserIds = activationUsers.map((u) => u._id);

    await Promise.all([
      PendingStudentRoster.deleteMany({ rootAccountId: root._id }),
      StudentActivationAttempt.deleteMany({ rootAccountId: root._id }),
      AccountInvite.deleteMany({ rootAccountId: root._id, email: /@lincolnhigh\.edu$/i }),
      activationUserIds.length
        ? AccountUser.deleteMany({ rootAccountId: root._id, userId: { $in: activationUserIds } })
        : Promise.resolve(),
      Pseudonym.deleteMany({ uniqueId: /@(activate\.example\.com|lincolnhigh\.edu)$/i }),
      User.deleteMany({ _id: { $in: activationUserIds } }),
    ]);

    const { recountSeats, ensureQuota } = require('../../../services/tenancy/accountQuota.service');
    await ensureQuota(root._id);
    await recountSeats(root._id);
  });

  afterAll(async () => {
    clearTenantCache();
  });

  async function seedRoster(overrides = {}) {
    return PendingStudentRoster.create({
      rootAccountId: root._id,
      studentId: '12345678',
      firstName: 'John',
      middleName: 'Michael',
      lastName: 'Smith',
      status: 'pending',
      ...overrides,
    });
  }

  function claimBody(overrides = {}) {
    return {
      firstName: 'John',
      middleName: 'Michael',
      lastName: 'Smith',
      studentId: '12345678',
      personalEmail: 'john.personal@personal.example.com',
      ...overrides,
    };
  }

  test('successful claim creates one user, marks roster claimed, sends invite to personal email', async () => {
    await seedRoster();

    const res = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(claimBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(GENERIC_SUCCESS);
    expect(res.body.data).toBeUndefined();

    const users = await User.find(
      withEmailOrStudent(root._id, '12345678')
    );
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('jms1234@lincolnhigh.edu');
    expect(users[0].personalEmail).toBe('john.personal@personal.example.com');
    expect(users[0].role).toBe('student');
    expect(users[0].pendingPasswordSetup).toBe(true);

    const roster = await PendingStudentRoster.findOne({
      rootAccountId: root._id,
      studentId: '12345678',
    });
    expect(roster.status).toBe('claimed');
    expect(roster.claimedByUserId.toString()).toBe(users[0]._id.toString());
    expect(roster.claimedAt).toBeTruthy();

    const invites = await AccountInvite.find({ rootAccountId: root._id, email: users[0].email });
    expect(invites).toHaveLength(1);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toBe('john.personal@personal.example.com');
    expect(sendEmail.mock.calls[0][2]).toContain('jms1234@lincolnhigh.edu');
    expect(sendEmail.mock.calls[0][2]).toContain('/accept-invite?token=');
  });

  test('second claim with same student ID is rejected; no second user', async () => {
    await seedRoster();

    const first = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(claimBody());
    expect(first.status).toBe(200);

    sendEmail.mockClear();
    const second = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(claimBody({ personalEmail: 'other@personal.example.com' }));

    expect(second.status).toBe(400);
    expect(second.body.message).toBe(GENERIC_ERROR);

    const users = await User.find(withEmailOrStudent(root._id, '12345678'));
    expect(users).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('name mismatch against a real student ID returns the same generic error', async () => {
    await seedRoster();

    const res = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(claimBody({ firstName: 'Jon', lastName: 'Smyth' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC_ERROR);

    const users = await User.countDocuments({
      rootAccountId: root._id,
      'studentProfile.studentId': '12345678',
    });
    expect(users).toBe(0);

    const roster = await PendingStudentRoster.findOne({
      rootAccountId: root._id,
      studentId: '12345678',
    });
    expect(roster.status).toBe('pending');
  });

  test('not-found student ID returns the same generic error (no enumeration)', async () => {
    await seedRoster();

    const res = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(claimBody({ studentId: '99999999' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC_ERROR);
  });

  test('email generation collision appends numeric suffix', async () => {
    await seedRoster({ studentId: '12345678', firstName: 'Jane', middleName: '', lastName: 'Doe' });
    await seedRoster({
      studentId: '12349999',
      firstName: 'Jill',
      middleName: '',
      lastName: 'Dane',
    });

    // Pre-create user that owns the base generated address for Jane Doe: jd1234@...
    await User.create({
      firstName: 'Existing',
      lastName: 'Collision',
      email: 'jd1234@lincolnhigh.edu',
      password: 'Password1!',
      role: 'student',
      rootAccountId: root._id,
      accountId: root._id,
    });

    const res = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(
        claimBody({
          firstName: 'Jane',
          middleName: '',
          lastName: 'Doe',
          studentId: '12345678',
          personalEmail: 'jane@personal.example.com',
        })
      );

    expect(res.status).toBe(200);
    const user = await User.findOne({
      rootAccountId: root._id,
      personalEmail: 'jane@personal.example.com',
    });
    expect(user.email).toBe('jd12341@lincolnhigh.edu');
  });

  test('studentId lock blocks further attempts after repeated failures', async () => {
    const {
      STUDENT_ID_LOCK_MAX,
      claimStudentActivation,
    } = require('../../../services/studentActivation.service');

    await seedRoster();

    for (let i = 0; i < STUDENT_ID_LOCK_MAX; i += 1) {
      const result = await claimStudentActivation({
        rootAccountId: root._id,
        firstName: 'Wrong',
        lastName: 'Name',
        studentId: '12345678',
        personalEmail: 'x@personal.example.com',
        ip: '127.0.0.1',
      });
      expect(result.ok).toBe(false);
      expect(result.message).toBe(GENERIC_ERROR);
    }

    const locked = await claimStudentActivation({
      rootAccountId: root._id,
      firstName: 'John',
      lastName: 'Smith',
      middleName: 'Michael',
      studentId: '12345678',
      personalEmail: 'ok@personal.example.com',
      ip: '127.0.0.1',
    });
    expect(locked.ok).toBe(false);
    expect(locked.locked).toBe(true);
    expect(locked.message).toBe(GENERIC_ERROR);

    const users = await User.countDocuments({
      rootAccountId: root._id,
      'studentProfile.studentId': '12345678',
    });
    expect(users).toBe(0);
  });

  test('SIS roster stage + apply creates pending roster rows', async () => {
    const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'Activate',
      email: 'admin@activate.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: root._id,
      accountId: root._id,
    });
    await ensureAccountMembership({
      user: admin,
      rootAccountId: root._id,
      role: 'admin',
    });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', HOST)
      .send({ email: 'admin@activate.example.com', password: 'Password1!' });
    const token = login.body.token;
    expect(token).toBeTruthy();

    const stage = await request(app)
      .post('/api/registrar/sis/import/roster')
      .set('Host', HOST)
      .set('Authorization', `Bearer ${token}`)
      .send({
        csvText:
          'student_id,first_name,middle_name,last_name\n55554444,Ada,Lovelace,Byron\n',
      });

    expect(stage.status).toBe(201);
    expect(stage.body.data.staged).toBe(1);
    const batchId = stage.body.data.batchId;

    const apply = await request(app)
      .post('/api/registrar/sis/apply')
      .set('Host', HOST)
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId, approvePending: true });

    expect(apply.status).toBe(200);

    const roster = await PendingStudentRoster.findOne({
      rootAccountId: root._id,
      studentId: '55554444',
    });
    expect(roster).toBeTruthy();
    expect(roster.status).toBe('pending');
    expect(roster.firstName).toBe('Ada');
    expect(roster.middleName).toBe('Lovelace');
    expect(roster.lastName).toBe('Byron');
  });

  test('accept-invite sets password on pre-provisioned activation user', async () => {
    await seedRoster();
    const claim = await request(app)
      .post('/api/student-activation/claim')
      .set('Host', HOST)
      .send(claimBody());
    expect(claim.status).toBe(200);

    const invite = await AccountInvite.findOne({
      rootAccountId: root._id,
      email: 'jms1234@lincolnhigh.edu',
      acceptedAt: null,
    });
    expect(invite).toBeTruthy();

    // Recover raw token by creating a known token path: call createInvite is opaque.
    // Use password-reset style: re-read from sendEmail mock URL.
    const mailBody = sendEmail.mock.calls[0][2];
    const match = mailBody.match(/token=([a-f0-9]+)/i);
    expect(match).toBeTruthy();
    const rawToken = match[1];

    const accept = await request(app)
      .post('/api/auth/accept-invite')
      .set('Host', HOST)
      .send({
        token: rawToken,
        firstName: 'John',
        lastName: 'Smith',
        password: 'Password1!',
      });

    expect(accept.status).toBe(200);
    expect(accept.body.success).toBe(true);

    const user = await User.findOne({ email: 'jms1234@lincolnhigh.edu' }).select('+password');
    expect(user.pendingPasswordSetup).toBe(false);
    const ok = await user.matchPassword('Password1!');
    expect(ok).toBe(true);
  });
});

function withEmailOrStudent(rootAccountId, studentId) {
  return {
    rootAccountId,
    $or: [
      { 'studentProfile.studentId': studentId },
      { email: /@lincolnhigh\.edu$/i },
    ],
  };
}
