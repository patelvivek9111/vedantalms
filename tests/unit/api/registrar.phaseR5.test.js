const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R5 — transcript & credentials office', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let StudentHold;
  let StudentCourseGradeSnapshot;
  let TranscriptIssueLog;
  let TranscriptTemplate;
  let TranscriptRequest;
  let rootA;
  let adminToken;
  let teacher;
  let student;
  let course;

  beforeAll(async () => {
    process.env.FORCE_INLINE_JOBS = 'true';
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    StudentHold = require('../../../models/studentHold.model');
    StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');
    TranscriptIssueLog = require('../../../models/transcriptIssueLog.model');
    TranscriptTemplate = require('../../../models/transcriptTemplate.model');
    TranscriptRequest = require('../../../models/transcriptRequest.model');
    clearTenantCache();
  });

  async function seedFinalizedSnapshot(lifecycleStatus = 'FINALIZED') {
    await StudentCourseGradeSnapshot.create({
      student: student._id,
      course: course._id,
      term: 'Fall',
      year: 2026,
      finalPercent: 91,
      letterGrade: 'A',
      gradingPolicyVersion: 1,
      gradingPolicyHash: 'r5-policy-hash',
      gradingPolicySnapshot: { scale: [] },
      gradingEngineVersion: '1.0.0',
      lifecycleStatus,
      frozen: true,
      isCurrent: true,
      rootAccountId: rootA._id,
    });
  }

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser5\./i }),
      Course.deleteMany({ title: /PhaseR5/i }),
      StudentHold.deleteMany({}),
      StudentCourseGradeSnapshot.deleteMany({}),
      TranscriptIssueLog.collection.deleteMany({}),
      TranscriptTemplate.deleteMany({}),
      TranscriptRequest.deleteMany({}),
    ]);

    rootA = await ensureDefaultRootAccount();

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser5.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser5.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phaser5.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
      studentProfile: { admissionNumber: 'R5-001' },
    });

    course = await Course.create({
      title: 'PhaseR5 Calculus',
      description: 'R5',
      instructor: teacher._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      semester: { term: 'Fall', year: 2026 },
      catalog: { courseCode: 'R5CALC', creditHours: 4, maxStudents: 30 },
      students: [student._id],
    });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phaser5.a.example.com', password: 'Password1!' });
    adminToken = login.body.token;
  });

  it('rejects official issue when grades are not FINALIZED/AMENDED', async () => {
    await seedFinalizedSnapshot('POSTED');

    const res = await request(app)
      .post('/api/registrar/transcripts/issue')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId: student._id, term: 'Fall', year: 2026 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_FINALIZED');
  });

  it('blocks official issue when transcript hold is active', async () => {
    await seedFinalizedSnapshot('FINALIZED');
    await StudentHold.create({
      studentId: student._id,
      holdType: 'transcript',
      reason: 'Fee pending',
      placedBy: teacher._id,
      blocksTranscript: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const res = await request(app)
      .post('/api/registrar/transcripts/issue')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId: student._id, term: 'Fall', year: 2026 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('HOLD_BLOCKS_TRANSCRIPT');
  });

  it('issues official PDF, verifies hash publicly, manages templates/requests', async () => {
    await seedFinalizedSnapshot('FINALIZED');

    const tpl = await request(app)
      .post('/api/registrar/transcripts/templates')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'R5 Official',
        format: 'pdf',
        gpaScale: 'india_10',
        repeatedCoursePolicy: 'highest',
        isDefault: true,
      });
    expect(tpl.status).toBe(201);

    const issue = await request(app)
      .post('/api/registrar/transcripts/issue')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: student._id,
        term: 'Fall',
        year: 2026,
        templateId: tpl.body.data._id,
        notes: 'R5 official copy',
      });

    expect(issue.status).toBe(201);
    expect(issue.body.data.transcriptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issue.body.data.pdfBase64).toBeTruthy();
    expect(issue.body.data.verifyUrl).toContain(issue.body.data.transcriptHash);
    expect(issue.body.data.gpaSummary?.gpa).toBeGreaterThan(0);

    const hash = issue.body.data.transcriptHash;
    const verify = await request(app)
      .get(`/api/public/transcript/verify/${hash}`)
      .set('Host', 'localhost');
    expect(verify.status).toBe(200);
    expect(verify.body.data.valid).toBe(true);
    expect(verify.body.data.courseCount).toBe(1);
    expect(verify.body.data.student?.admissionNumber).toBe('R5-001');

    const missing = await request(app)
      .get(`/api/public/transcript/verify/${'a'.repeat(64)}`)
      .set('Host', 'localhost');
    expect(missing.status).toBe(404);

    const reqCreate = await request(app)
      .post('/api/registrar/transcripts/requests')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: student._id,
        term: 'Fall',
        year: 2026,
        type: 'official',
        templateId: tpl.body.data._id,
      });
    expect(reqCreate.status).toBe(201);
    expect(reqCreate.body.data.status).toBe('pending');

    const list = await request(app)
      .get('/api/registrar/transcripts/requests')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('bulk preview and sync issue for ready students', async () => {
    await seedFinalizedSnapshot('FINALIZED');

    const preview = await request(app)
      .post('/api/registrar/transcripts/bulk/preview')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ term: 'Fall', year: 2026 });
    expect(preview.status).toBe(200);
    expect(preview.body.data.ready).toBeGreaterThanOrEqual(1);

    const apply = await request(app)
      .post('/api/registrar/transcripts/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ term: 'Fall', year: 2026, async: false });
    expect([200, 202]).toContain(apply.status);
    if (apply.body.data?.issued != null) {
      expect(apply.body.data.issued).toBeGreaterThanOrEqual(1);
    } else if (apply.body.data?.result?.issued != null) {
      expect(apply.body.data.result.issued).toBeGreaterThanOrEqual(1);
    } else {
      expect(apply.body.data?.jobId || apply.body.data?.toIssue).toBeTruthy();
    }
  });
});
