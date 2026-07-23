const request = require('supertest');
const mongoose = require('mongoose');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Phase 4 enrollment of record + registrar', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let Enrollment;
  let StudentHold;
  let SisStagingEnrollment;
  let AcademicTerm;
  let rootA;
  let rootB;
  let adminToken;
  let teacher;
  let student;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    Enrollment = require('../../../models/enrollment.model');
    StudentHold = require('../../../models/studentHold.model');
    SisStagingEnrollment = require('../../../models/sisStagingEnrollment.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phase4\./i }),
      Course.deleteMany({ title: /Phase4/i }),
      Enrollment.deleteMany({}),
      StudentHold.deleteMany({}),
      SisStagingEnrollment.deleteMany({}),
      AcademicTerm.deleteMany({ code: /PHASE4/i }),
    ]);

    rootA = await ensureDefaultRootAccount();
    const b = await provisionRootAccount({
      name: 'Phase4 School B',
      code: 'PHASE4B',
      host: 'phase4b.test',
      adminEmail: 'admin@phase4.b.example.com',
      adminPassword: 'Password1!',
    });
    rootB = b.account;

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phase4.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'A',
      email: 'teacher@phase4.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: teacher, rootAccountId: rootA._id, role: 'teacher' });

    student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phase4.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: student, rootAccountId: rootA._id, role: 'student' });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phase4.a.example.com', password: 'Password1!' });
    adminToken = login.body.token;
  });

  afterAll(async () => {
    clearTenantCache();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

  async function createCourse(overrides = {}) {
    const term =
      overrides.academicTermId ||
      (
        await AcademicTerm.create({
          name: 'Phase4 Fall',
          code: `PHASE4F${Date.now()}`,
          status: 'active',
          enrollmentOpenDate: new Date('2026-01-01'),
          enrollmentCloseDate: new Date('2026-12-31'),
          legacyTermLabel: 'Fall',
          legacyYear: 2026,
          rootAccountId: rootA._id,
          accountId: rootA._id,
        })
      )._id;

    return Course.create({
      title: 'Phase4 Algebra',
      description: 'Phase4',
      instructor: teacher._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      academicTermId: term,
      catalog: {
        courseCode: 'P4ALG',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        maxStudents: 30,
      },
      students: [],
      enrollmentRequests: [],
      waitlist: [],
      ...overrides,
      academicTermId: overrides.academicTermId || term,
    });
  }

  it('dual-writes Enrollment when teacher enrolls a student', async () => {
    const course = await createCourse();
    const teachLogin = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'teacher@phase4.a.example.com', password: 'Password1!' });

    const res = await request(app)
      .post(`/api/courses/${course._id}/enroll-teacher`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${teachLogin.body.token}`)
      .send({ studentId: student._id });

    expect(res.status).toBe(200);

    const enrollment = await Enrollment.findOne({
      rootAccountId: rootA._id,
      lmsCourseId: course._id,
      studentId: student._id,
    });
    expect(enrollment).toBeTruthy();
    expect(enrollment.status).toBe('active');
  });

  it('blocks self-enroll when registration hold is active', async () => {
    const course = await createCourse();
    await StudentHold.create({
      studentId: student._id,
      holdType: 'registration',
      reason: 'Unpaid balance',
      placedBy: teacher._id,
      blocksRegistration: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const stuLogin = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'student@phase4.a.example.com', password: 'Password1!' });

    const enroll = await request(app)
      .post(`/api/courses/${course._id}/enroll`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${stuLogin.body.token}`);

    expect(enroll.status).toBe(403);
    expect(String(enroll.body.message || '').toLowerCase()).toMatch(/hold/);
  });

  it('registrar bulk enroll is tenant-scoped and creates Enrollment rows', async () => {
    const course = await createCourse();
    const foreignStudent = await User.create({
      firstName: 'Other',
      lastName: 'School',
      email: 'student@phase4.b.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });

    const res = await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courseId: course._id,
        studentIds: [student._id, foreignStudent._id],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.enrolled).toBe(1);
    expect(res.body.data.failed).toBe(1);

    const local = await Enrollment.findOne({
      rootAccountId: rootA._id,
      studentId: student._id,
      lmsCourseId: course._id,
    });
    expect(local?.status).toBe('active');

    const leaked = await Enrollment.findOne({
      studentId: foreignStudent._id,
      lmsCourseId: course._id,
    });
    expect(leaked).toBeFalsy();

    const listB = await request(app)
      .get(`/api/registrar/terms/${course.academicTermId}/enrollments`)
      .set('Host', 'phase4b.test')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listB.status).toBe(403);

    const listA = await request(app)
      .get(`/api/registrar/terms/${course.academicTermId}/enrollments`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listA.status).toBe(200);
    expect(listA.body.count).toBeGreaterThanOrEqual(1);
  });

  it('SIS stage + apply stays on the requesting tenant', async () => {
    const course = await createCourse({
      catalog: {
        courseCode: 'SIS101',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        maxStudents: 30,
      },
    });

    const stage = await request(app)
      .post('/api/registrar/sis/stage')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        provider: 'csv',
        rows: [
          {
            externalStudentId: 'EMPL1',
            externalCourseId: 'CRSE1',
            studentEmail: 'student@phase4.a.example.com',
            courseCode: 'SIS101',
            lmsCourseId: course._id,
          },
        ],
      });

    expect(stage.status).toBe(201);
    const batchId = stage.body.data.batchId;
    expect(batchId).toBeTruthy();

    const staged = await SisStagingEnrollment.find({ batchId });
    expect(staged).toHaveLength(1);
    expect(String(staged[0].rootAccountId)).toBe(String(rootA._id));

    const apply = await request(app)
      .post('/api/registrar/sis/apply')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ batchId });

    expect(apply.status).toBe(200);
    expect(apply.body.data.applied).toBe(1);

    const enrollment = await Enrollment.findOne({
      rootAccountId: rootA._id,
      lmsCourseId: course._id,
      studentId: student._id,
      status: 'active',
    });
    expect(enrollment).toBeTruthy();
    expect(enrollment.syncStatus).toBe('synced');
  });

  it('place and release holds via registrar API', async () => {
    const place = await request(app)
      .post('/api/registrar/holds')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: student._id,
        holdType: 'transcript',
        reason: 'Missing docs',
        blocksRegistration: false,
        blocksTranscript: true,
      });

    expect(place.status).toBe(201);
    const holdId = place.body.data._id;

    const list = await request(app)
      .get('/api/registrar/holds')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.count).toBeGreaterThanOrEqual(1);

    const release = await request(app)
      .post(`/api/registrar/holds/${holdId}/release`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(release.status).toBe(200);
    expect(release.body.data.isActive).toBe(false);
  });
});
