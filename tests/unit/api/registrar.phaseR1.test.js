const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R1 — office shell APIs', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let AcademicTerm;
  let CourseGradeLifecycle;
  let StudentHold;
  let rootA;
  let rootB;
  let adminToken;
  let registrarToken;
  let deptToken;
  let teacherToken;
  let student;
  let term;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    CourseGradeLifecycle = require('../../../models/courseGradeLifecycle.model');
    StudentHold = require('../../../models/studentHold.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser1\./i }),
      Course.deleteMany({ title: /PhaseR1/i }),
      AcademicTerm.deleteMany({ code: /PHASER1/i }),
      CourseGradeLifecycle.deleteMany({}),
      StudentHold.deleteMany({}),
    ]);

    rootA = await ensureDefaultRootAccount();
    const b = await provisionRootAccount({
      name: 'PhaseR1 School B',
      code: 'PHASER1B',
      host: 'phaser1b.test',
      adminEmail: 'admin@phaser1.b.example.com',
      adminPassword: 'Password1!',
    });
    rootB = b.account;

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser1.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    const registrar = await User.create({
      firstName: 'Reg',
      lastName: 'Istrar',
      email: 'registrar@phaser1.a.example.com',
      password: 'Password1!',
      role: 'registrar',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: registrar, rootAccountId: rootA._id, role: 'registrar' });

    const dept = await User.create({
      firstName: 'Dept',
      lastName: 'Admin',
      email: 'dept@phaser1.a.example.com',
      password: 'Password1!',
      role: 'department_admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: dept, rootAccountId: rootA._id, role: 'department_admin' });

    const teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser1.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: teacher, rootAccountId: rootA._id, role: 'teacher' });

    student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phaser1.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: student, rootAccountId: rootA._id, role: 'student' });

    const foreignStudent = await User.create({
      firstName: 'Other',
      lastName: 'School',
      email: 'student@phaser1.b.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });
    await ensureAccountMembership({
      user: foreignStudent,
      rootAccountId: rootB._id,
      role: 'student',
    });

    term = await AcademicTerm.create({
      name: 'Phase R1 Term',
      code: 'PHASER1-S1',
      status: 'active',
      legacyTermLabel: 'Fall',
      legacyYear: 2026,
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const course = await Course.create({
      title: 'PhaseR1 Algebra',
      description: 'test',
      instructor: teacher._id,
      published: true,
      academicTermId: term._id,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      catalog: {
        courseCode: 'ALG101',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        maxStudents: 30,
      },
      students: [],
    });

    await CourseGradeLifecycle.create({
      course: course._id,
      term: 'Fall',
      year: 2026,
      status: 'POSTED',
      rootAccountId: rootA._id,
    });

    await StudentHold.create({
      studentId: student._id,
      holdType: 'registration',
      reason: 'R1 test hold',
      isActive: true,
      placedBy: admin._id,
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const login = async (email) => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Host', 'localhost')
        .send({ email, password: 'Password1!' });
      return res.body.token;
    };

    adminToken = await login('admin@phaser1.a.example.com');
    registrarToken = await login('registrar@phaser1.a.example.com');
    deptToken = await login('dept@phaser1.a.example.com');
    teacherToken = await login('teacher@phaser1.a.example.com');
  });

  it('requires auth for dashboard', async () => {
    const res = await request(app).get('/api/registrar/dashboard').set('Host', 'localhost');
    expect(res.status).toBe(401);
  });

  it('rejects teachers from registrar dashboard', async () => {
    const res = await request(app)
      .get('/api/registrar/dashboard')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  it('returns dashboard KPIs for registrar', async () => {
    const res = await request(app)
      .get('/api/registrar/dashboard')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${registrarToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeHolds).toBeGreaterThanOrEqual(1);
    expect(res.body.data.activeTerms).toBeGreaterThanOrEqual(1);
    expect(res.body.data.gradeStatus.unfinalized).toBeGreaterThanOrEqual(1);
  });

  it('allows department_admin dashboard access', async () => {
    const res = await request(app)
      .get('/api/registrar/dashboard')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${deptToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('searches students in tenant only', async () => {
    const res = await request(app)
      .get('/api/registrar/students/search')
      .query({ q: 'stu' })
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((s) => s.email === 'student@phaser1.a.example.com')).toBe(true);
    expect(res.body.data.some((s) => s.email === 'student@phaser1.b.example.com')).toBe(false);
  });

  it('returns student stub with enrollments/holds', async () => {
    const res = await request(app)
      .get(`/api/registrar/students/${student._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${registrarToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.student.email).toBe('student@phaser1.a.example.com');
    expect(Array.isArray(res.body.data.holds)).toBe(true);
    expect(res.body.data.holds.length).toBeGreaterThanOrEqual(1);
  });

  it('returns term grade status matrix', async () => {
    const res = await request(app)
      .get(`/api/registrar/terms/${term._id}/grade-status`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.rows[0].lifecycleStatus).toBe('POSTED');
    expect(res.body.data.counts.POSTED).toBeGreaterThanOrEqual(1);
  });

  it('still serves enrollment-summary and term-completion reports', async () => {
    const sum = await request(app)
      .get('/api/registrar/reports/enrollment-summary')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sum.status).toBe(200);
    expect(sum.body.success).toBe(true);

    const termRep = await request(app)
      .get('/api/registrar/reports/term-completion')
      .query({ format: 'csv' })
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(termRep.status).toBe(200);
    expect(String(termRep.headers['content-type'] || '')).toMatch(/csv|text/);
  });

  it('creates and updates academic terms via existing APIs', async () => {
    const create = await request(app)
      .post('/api/academic-structure/terms')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        name: 'Phase R1 Extra',
        code: 'PHASER1-X',
        status: 'upcoming',
      });
    expect(create.status).toBe(201);

    const patch = await request(app)
      .patch(`/api/academic-structure/terms/${create.body.data._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({ status: 'active' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('active');
  });
});
