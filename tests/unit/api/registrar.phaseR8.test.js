const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R8 — India compliance + ERP / LTI', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let AcademicTerm;
  let StudentHold;
  let StudentCourseGradeSnapshot;
  let TranscriptTemplate;
  let TranscriptRequest;
  let GradePassbackRecord;
  let Enrollment;
  let rootA;
  let rootB;
  let adminToken;
  let teacher;
  let student;
  let course;
  let term;
  const prevErpSecret = process.env.ERP_HOLDS_WEBHOOK_SECRET;

  beforeAll(async () => {
    process.env.FORCE_INLINE_JOBS = 'true';
    process.env.ERP_HOLDS_WEBHOOK_SECRET = 'r8-erp-test-secret';
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    StudentHold = require('../../../models/studentHold.model');
    StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');
    TranscriptTemplate = require('../../../models/transcriptTemplate.model');
    TranscriptRequest = require('../../../models/transcriptRequest.model');
    GradePassbackRecord = require('../../../models/gradePassbackRecord.model');
    Enrollment = require('../../../models/enrollment.model');
    clearTenantCache();
  });

  afterAll(() => {
    if (prevErpSecret == null) delete process.env.ERP_HOLDS_WEBHOOK_SECRET;
    else process.env.ERP_HOLDS_WEBHOOK_SECRET = prevErpSecret;
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser8\./i }),
      Course.deleteMany({ title: /PhaseR8/i }),
      AcademicTerm.deleteMany({ code: /PHASER8/i }),
      StudentHold.deleteMany({}),
      StudentCourseGradeSnapshot.deleteMany({}),
      TranscriptTemplate.deleteMany({}),
      TranscriptRequest.deleteMany({}),
      GradePassbackRecord.deleteMany({}),
      Enrollment.deleteMany({}),
      require('../../../models/sisIntegrationConfig.model').deleteMany({}),
      require('../../../models/gradePassbackRecord.model').deleteMany({}),
    ]);

    rootA = await ensureDefaultRootAccount();
    await Account.findByIdAndUpdate(rootA._id, {
      $set: { udiseCode: 'UDISE-R8-001', affiliationBody: 'State Board', institutionMode: 'school' },
    });

    const b = await provisionRootAccount({
      name: 'PhaseR8 School B',
      code: 'PHASER8B',
      host: 'phaser8b.test',
      adminEmail: 'admin@phaser8.b.example.com',
      adminPassword: 'Password1!',
    });
    rootB = b.account;

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser8.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser8.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phaser8.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
      studentProfile: {
        admissionNumber: 'R8-001',
        externalIds: { sis: 'S8-001' },
      },
    });

    term = await AcademicTerm.create({
      name: 'Phase R8 Term',
      code: 'PHASER8-S1',
      status: 'grading',
      legacyTermLabel: 'Fall',
      legacyYear: 2026,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      enrollmentOpenDate: new Date('2020-01-01'),
      enrollmentCloseDate: new Date('2099-01-01'),
    });

    course = await Course.create({
      title: 'PhaseR8 Algebra',
      description: 'R8',
      instructor: teacher._id,
      published: true,
      academicTermId: term._id,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      semester: { term: 'Fall', year: 2026 },
      catalog: {
        courseCode: 'R8ALG',
        creditHours: 4,
        maxStudents: 30,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
      },
      students: [],
    });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phaser8.a.example.com', password: 'Password1!' });
    adminToken = login.body.token;
  });

  it('lists India report kinds and returns udise-extract CSV shape', async () => {
    const kinds = await request(app)
      .get('/api/registrar/reports/india')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(kinds.status).toBe(200);
    const keys = (kinds.body.data || []).map((k) => k.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'cbse-mark-sheet',
        'class-summary',
        'udise-extract',
        'university-exam-form',
        'sgpa-cgpa',
        'naac-evidence',
      ])
    );

    const udise = await request(app)
      .get('/api/registrar/reports/india/udise-extract')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(udise.status).toBe(200);
    expect(udise.body.data.kind).toBe('udise_extract');
    expect(udise.body.data.csvText).toContain('udise_code');
    expect(udise.body.data.csvText).toContain('UDISE-R8-001');
  });

  it('fulfills bonafide certificate request with PDF', async () => {
    const created = await request(app)
      .post('/api/registrar/transcripts/requests')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: student._id,
        term: 'Fall',
        year: 2026,
        type: 'bonafide',
        notes: 'R8 bonafide',
      });
    expect(created.status).toBe(201);

    const fulfill = await request(app)
      .post(`/api/registrar/transcripts/requests/${created.body.data._id}/fulfill`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(fulfill.status).toBe(201);
    expect(fulfill.body.data.certificate).toBe(true);
    expect(fulfill.body.data.type).toBe('bonafide');
    expect(fulfill.body.data.pdfBase64).toBeTruthy();
    expect(Buffer.from(fulfill.body.data.pdfBase64, 'base64').slice(0, 4).toString()).toBe('%PDF');
  });

  it('creates bilingual (hi) transcript template', async () => {
    const tpl = await request(app)
      .post('/api/registrar/transcripts/templates')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'R8 Hindi',
        format: 'pdf',
        locale: 'hi',
        gpaScale: 'india_10',
        repeatedCoursePolicy: 'highest',
        isDefault: true,
      });
    expect(tpl.status).toBe(201);
    expect(tpl.body.data.locale).toBe('hi');
  });

  it('upserts ERP hold webhook and isolates tenants', async () => {
    const upsert = await request(app)
      .post('/api/integrations/erp/holds')
      .set('Host', 'localhost')
      .set('x-webhook-secret', 'r8-erp-test-secret')
      .send({
        externalHoldId: 'ERP-HOLD-R8-1',
        studentEmail: 'student@phaser8.a.example.com',
        holdType: 'financial',
        reason: 'Fee pending',
        blocksTranscript: true,
        active: true,
      });
    expect(upsert.status).toBe(201);
    expect(upsert.body.data.action).toBe('upserted');

    const hold = await StudentHold.findOne({
      externalHoldId: 'ERP-HOLD-R8-1',
      rootAccountId: rootA._id,
    });
    expect(hold).toBeTruthy();
    expect(hold.blocksTranscript).toBe(true);
    expect(hold.source).toBe('erp');

    const wrongTenant = await request(app)
      .post('/api/integrations/erp/holds')
      .set('Host', 'phaser8b.test')
      .set('x-webhook-secret', 'r8-erp-test-secret')
      .send({
        externalHoldId: 'ERP-HOLD-R8-1',
        studentEmail: 'student@phaser8.a.example.com',
        active: true,
      });
    expect(wrongTenant.status).toBe(404);

    const badSecret = await request(app)
      .post('/api/integrations/erp/holds')
      .set('Host', 'localhost')
      .set('x-webhook-secret', 'wrong')
      .send({
        externalHoldId: 'ERP-HOLD-R8-2',
        studentEmail: 'student@phaser8.a.example.com',
        active: true,
      });
    expect(badSecret.status).toBe(401);

    expect(rootB).toBeTruthy();
  });

  it('exposes LTI AGS readiness and submit (not a stub)', async () => {
    const ready = await request(app)
      .get('/api/integrations/lti/readiness')
      .set('Host', 'localhost');
    expect(ready.status).toBe(200);
    expect(ready.body.data).toHaveProperty('agsEnabled');
    expect(ready.body.data.note).toMatch(/AGS|LTI/i);
    expect(ready.body.data.stub).toBeUndefined();

    const submit = await request(app)
      .post('/api/integrations/lti/ags/submit')
      .set('Host', 'localhost')
      .send({
        term: 'Fall',
        year: 2026,
        dryRun: true,
        rows: [{ sis_student_id: 'S8-001', letter_grade: 'A' }],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.stub).toBe(false);
    expect(submit.body.data.recordId).toBeTruthy();

    const rec = await GradePassbackRecord.findById(submit.body.data.recordId);
    expect(rec.channel).toBe('lti_ags');
    expect(rec.provider).toBe('lti');
  });

  it('custom_rest SIS config is accepted', async () => {
    const put = await request(app)
      .put('/api/registrar/sis/config')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        provider: 'custom_rest',
        credentialsRef: 'https://example.test/sis',
        enabled: true,
      });
    expect(put.status).toBe(200);
    expect(put.body.data.provider).toBe('custom_rest');
  });

  it('E2E: bulk enroll → grade → finalize → issue transcript → export grades', async () => {
    const bulk = await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: course._id, studentIds: [student._id] });
    expect([200, 201]).toContain(bulk.status);
    expect(bulk.body.data.enrolled).toBeGreaterThanOrEqual(1);

    const enr = await Enrollment.findOne({
      studentId: student._id,
      lmsCourseId: course._id,
      rootAccountId: rootA._id,
    });
    expect(enr).toBeTruthy();

    await StudentCourseGradeSnapshot.create({
      student: student._id,
      course: course._id,
      term: 'Fall',
      year: 2026,
      finalPercent: 88,
      letterGrade: 'A',
      gradingPolicyVersion: 1,
      gradingPolicyHash: 'r8-hash',
      gradingPolicySnapshot: { scale: [] },
      gradingEngineVersion: '1.0.0',
      lifecycleStatus: 'FINALIZED',
      frozen: true,
      isCurrent: true,
      rootAccountId: rootA._id,
    });

    const finalize = await request(app)
      .post(`/api/registrar/terms/${term._id}/finalize`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([200, 201]).toContain(finalize.status);

    const issue = await request(app)
      .post('/api/registrar/transcripts/issue')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId: student._id, term: 'Fall', year: 2026 });
    expect(issue.status).toBe(201);
    expect(issue.body.data.transcriptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issue.body.data.pdfBase64).toBeTruthy();

    const grades = await request(app)
      .post('/api/registrar/sis/grades/export')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ term: 'Fall', year: 2026 });
    expect(grades.status).toBe(200);
    expect(grades.body.data.count).toBeGreaterThanOrEqual(1);
    expect(grades.body.data.csvText).toContain('final_grade');
    expect(grades.body.data.csvText).toContain('S8-001');
    expect(grades.body.data.csvText).toContain('FINALIZED');
  });
});
