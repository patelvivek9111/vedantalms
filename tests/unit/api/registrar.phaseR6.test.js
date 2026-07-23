const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R6 — production SIS pipeline', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let CourseSection;
  let Enrollment;
  let StudentCourseGradeSnapshot;
  let SisSyncRow;
  let SisIntegrationConfig;
  let GradePassbackRecord;
  let SystemAuditEvent;
  let rootA;
  let rootB;
  let adminToken;
  let adminBToken;
  let teacher;

  beforeAll(async () => {
    process.env.FORCE_INLINE_JOBS = 'true';
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    CourseSection = require('../../../models/courseSection.model');
    Enrollment = require('../../../models/enrollment.model');
    StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');
    SisSyncRow = require('../../../models/sisSyncRow.model');
    SisIntegrationConfig = require('../../../models/sisIntegrationConfig.model');
    GradePassbackRecord = require('../../../models/gradePassbackRecord.model');
    SystemAuditEvent = require('../../../models/systemAuditEvent.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser6\./i }),
      Course.deleteMany({ title: /PhaseR6/i }),
      CourseSection.deleteMany({}),
      Enrollment.deleteMany({}),
      StudentCourseGradeSnapshot.deleteMany({}),
      SisSyncRow.deleteMany({}),
      SisIntegrationConfig.deleteMany({}),
      GradePassbackRecord.deleteMany({}),
      SystemAuditEvent.deleteMany({ action: /registrar\.sis/ }),
      require('../../../models/sisStagingEnrollment.model').deleteMany({}),
      require('../../../models/sisJob.model').deleteMany({}),
      require('../../../models/sisSyncBatch.model').deleteMany({}),
      require('../../../models/courseOffering.model').deleteMany({}),
      require('../../../models/academicTerm.model').deleteMany({ code: /R6|FALL26|SIS/i }),
    ]);

    rootA = await ensureDefaultRootAccount();
    const b = await provisionRootAccount({
      name: 'PhaseR6 School B',
      code: 'PHASER6B',
      host: 'phaser6b.test',
      adminEmail: 'admin@phaser6.b.example.com',
      adminPassword: 'Password1!',
    });
    rootB = b.account;

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser6.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser6.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phaser6.a.example.com', password: 'Password1!' });
    adminToken = loginA.body.token;

    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Host', 'phaser6b.test')
      .send({ email: 'admin@phaser6.b.example.com', password: 'Password1!' });
    adminBToken = loginB.body.token;
  });

  it('round-trips users → sections → enrollments CSV and exports grades', async () => {
    const usersCsv = [
      'sis_id,email,first_name,last_name,role,student_id,program',
      'S6-001,student@phaser6.a.example.com,Stu,Dent,student,ADM6,CS',
    ].join('\n');

    const users = await request(app)
      .post('/api/registrar/sis/import/users')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csvText: usersCsv });
    expect(users.status).toBe(201);
    expect(users.body.data.staged).toBe(1);

    const applyUsers = await request(app)
      .post('/api/registrar/sis/apply')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ batchId: users.body.data.batchId });
    expect(applyUsers.status).toBe(200);
    expect(applyUsers.body.data.applied).toBeGreaterThanOrEqual(1);

    const student = await User.findOne({ email: 'student@phaser6.a.example.com' });
    expect(student).toBeTruthy();
    expect(student.studentProfile.externalIds.sis).toBe('S6-001');

    const sectionsCsv = [
      'sis_section_id,course_code,term_code,section,instructor_email,max_enrollment,title',
      'SEC-R6-1,R6CS101,FALL26,1,teacher@phaser6.a.example.com,40,PhaseR6 Intro',
    ].join('\n');

    const sections = await request(app)
      .post('/api/registrar/sis/import/sections')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csvText: sectionsCsv });
    expect(sections.status).toBe(201);

    const applySec = await request(app)
      .post('/api/registrar/sis/apply')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ batchId: sections.body.data.batchId });
    expect(applySec.status).toBe(200);
    expect(applySec.body.data.applied).toBeGreaterThanOrEqual(1);

    const section = await CourseSection.findOne({ sisSectionId: 'SEC-R6-1', rootAccountId: rootA._id });
    expect(section).toBeTruthy();
    expect(section.lmsCourseId).toBeTruthy();

    const enrollCsv = [
      'sis_enrollment_id,sis_section_id,sis_student_id,role,status',
      'ENR-R6-1,SEC-R6-1,S6-001,student,active',
    ].join('\n');

    const enroll = await request(app)
      .post('/api/registrar/sis/import/enrollments')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csvText: enrollCsv });
    expect(enroll.status).toBe(201);

    const applyEnroll = await request(app)
      .post('/api/registrar/sis/apply')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ batchId: enroll.body.data.batchId });
    expect(applyEnroll.status).toBe(200);
    expect(applyEnroll.body.data.applied).toBeGreaterThanOrEqual(1);

    const enrollment = await Enrollment.findOne({
      studentId: student._id,
      lmsCourseId: section.lmsCourseId,
      rootAccountId: rootA._id,
    });
    expect(enrollment).toBeTruthy();

    await StudentCourseGradeSnapshot.create({
      student: student._id,
      course: section.lmsCourseId,
      term: 'Fall',
      year: 2026,
      finalPercent: 92,
      letterGrade: 'A',
      gradingPolicyVersion: 1,
      gradingPolicyHash: 'r6-hash',
      gradingPolicySnapshot: { scale: [] },
      lifecycleStatus: 'FINALIZED',
      frozen: true,
      isCurrent: true,
      rootAccountId: rootA._id,
    });

    const course = await Course.findById(section.lmsCourseId);
    course.semester = { term: 'Fall', year: 2026 };
    await course.save();

    const grades = await request(app)
      .post('/api/registrar/sis/grades/export')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ term: 'Fall', year: 2026 });
    expect(grades.status).toBe(200);
    expect(grades.body.data.count).toBeGreaterThanOrEqual(1);
    expect(grades.body.data.csvText).toContain('sis_student_id');
    expect(grades.body.data.csvText).toContain('S6-001');
    expect(grades.body.data.csvText).toContain('SEC-R6-1');
  });

  it('isolates SIS staging across tenants', async () => {
    const usersCsv =
      'sis_id,email,first_name,last_name,role\nBX,other@phaser6.b.example.com,Other,User,student';
    const staged = await request(app)
      .post('/api/registrar/sis/import/users')
      .set('Host', 'phaser6b.test')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ csvText: usersCsv });
    expect(staged.status).toBe(201);

    const inboxA = await request(app)
      .get('/api/registrar/sis/staging')
      .query({ inbox: 1, batchId: staged.body.data.batchId })
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inboxA.status).toBe(200);
    expect(inboxA.body.count).toBe(0);

    const inboxB = await request(app)
      .get('/api/registrar/sis/staging')
      .query({ inbox: 1, batchId: staged.body.data.batchId })
      .set('Host', 'phaser6b.test')
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(inboxB.status).toBe(200);
    expect(inboxB.body.count).toBe(1);
  });

  it('audits conflict override on staging row approve', async () => {
    await User.create({
      firstName: 'Exist',
      lastName: 'Ing',
      email: 'conflict@phaser6.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
      studentProfile: { externalIds: { sis: 'OLD-SIS' } },
    });

    // Same email, different sis_id → conflict
    const csv =
      'sis_id,email,first_name,last_name,role\nNEW-SIS,conflict@phaser6.a.example.com,Exist,Ing,student';
    const staged = await request(app)
      .post('/api/registrar/sis/import/users')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csvText: csv });
    expect(staged.status).toBe(201);

    const rows = await SisSyncRow.find({ batchId: staged.body.data.batchId });
    expect(rows[0].status).toBe('conflict');

    const deny = await request(app)
      .patch(`/api/registrar/sis/staging/${rows[0]._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(deny.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/registrar/sis/staging/${rows[0]._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', overrideReason: 'Verified SIS id change' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('approved');

    const audit = await SystemAuditEvent.findOne({ action: 'registrar.sis.conflict_overridden' });
    expect(audit).toBeTruthy();
  });

  it('gets and updates SIS integration config', async () => {
    const get = await request(app)
      .get('/api/registrar/sis/config')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.data.provider).toBe('csv');

    const put = await request(app)
      .put('/api/registrar/sis/config')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ schedule: 'manual', syncDirection: 'import' });
    expect(put.status).toBe(200);
    expect(put.body.data.syncDirection).toBe('import');
  });
});
