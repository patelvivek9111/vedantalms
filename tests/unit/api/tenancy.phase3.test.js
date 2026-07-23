const request = require('supertest');
const mongoose = require('mongoose');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount } = require('../../../services/tenancy/provisionAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Phase 3 academic structure', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let AcademicTerm;
  let CourseOffering;
  let CourseSection;
  let rootA;
  let rootB;
  let adminToken;
  let teacher;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    CourseOffering = require('../../../models/courseOffering.model');
    CourseSection = require('../../../models/courseSection.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phase3\./i }),
      Course.deleteMany({ title: /Phase3/i }),
      AcademicTerm.deleteMany({}),
      CourseOffering.deleteMany({}),
      CourseSection.deleteMany({}),
    ]);

    rootA = await ensureDefaultRootAccount();
    const b = await provisionRootAccount({
      name: 'Phase3 School B',
      code: 'PHASE3B',
      host: 'phase3b.test',
      adminEmail: 'admin@phase3.b.example.com',
      adminPassword: 'Password1!',
    });
    rootB = b.account;

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phase3.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'A',
      email: 'teacher@phase3.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: teacher, rootAccountId: rootA._id, role: 'teacher' });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phase3.a.example.com', password: 'Password1!' });
    adminToken = login.body.token;
  });

  afterAll(async () => {
    clearTenantCache();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

  it('creates institution terms scoped to root', async () => {
    const res = await request(app)
      .post('/api/academic-structure/terms')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Fall 2026',
        code: 'FALL2026',
        termType: 'semester',
        legacyTermLabel: 'Fall',
        legacyYear: 2026,
        status: 'active',
        enrollmentOpenDate: new Date('2026-01-01'),
        enrollmentCloseDate: new Date('2026-12-31'),
      });

    expect(res.status).toBe(201);
    expect(String(res.body.data.rootAccountId)).toBe(String(rootA._id));

    const listB = await request(app)
      .get('/api/academic-structure/terms')
      .set('Host', 'phase3b.test')
      .set('Authorization', `Bearer ${adminToken}`);
    // admin token is root A — protect should 403 on host B
    expect(listB.status).toBe(403);
  });

  it('course create dual-writes term + offering + section', async () => {
    const teachLogin = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'teacher@phase3.a.example.com', password: 'Password1!' });

    const res = await request(app)
      .post('/api/courses')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${teachLogin.body.token}`)
      .send({
        title: 'Phase3 Algebra',
        description: 'Intro algebra',
        semester: { term: 'Fall', year: 2026 },
        catalog: {
          courseCode: 'ALG101',
          startDate: '2026-08-01',
          endDate: '2026-12-15',
        },
      });

    expect(res.status).toBe(201);
    const courseId = res.body.data?._id || res.body.data?.id;
    expect(courseId).toBeTruthy();

    const course = await Course.findById(courseId);
    expect(course.academicTermId).toBeTruthy();
    expect(course.offeringId).toBeTruthy();
    expect(course.sectionId).toBeTruthy();

    const term = await AcademicTerm.findById(course.academicTermId);
    expect(term.rootAccountId.toString()).toBe(rootA._id.toString());

    const offering = await CourseOffering.findById(course.offeringId);
    expect(offering.courseCode).toBe('ALG101');

    const section = await CourseSection.findById(course.sectionId);
    expect(String(section.lmsCourseId)).toBe(String(course._id));
  });

  it('blocks enrollment when term window is closed', async () => {
    const term = await AcademicTerm.create({
      name: 'Closed Term',
      code: 'CLOSED2026',
      status: 'closed',
      enrollmentOpenDate: new Date('2020-01-01'),
      enrollmentCloseDate: new Date('2020-06-01'),
      legacyTermLabel: 'Spring',
      legacyYear: 2020,
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const course = await Course.create({
      title: 'Phase3 Closed Course',
      description: 'Closed',
      instructor: teacher._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      academicTermId: term._id,
      catalog: {
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-06-01'),
        maxStudents: 30,
      },
      students: [],
      enrollmentRequests: [],
      waitlist: [],
    });

    const student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phase3.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: student, rootAccountId: rootA._id, role: 'student' });

    const stuLogin = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'student@phase3.a.example.com', password: 'Password1!' });

    const enroll = await request(app)
      .post(`/api/courses/${course._id}/enroll`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${stuLogin.body.token}`);

    expect(enroll.status).toBe(403);
    expect(enroll.body.joinState).toBe('term_enrollment_closed');
  });

  it('catalog filters by termId and stays tenant-scoped', async () => {
    const termA = await AcademicTerm.create({
      name: 'Term A',
      code: 'TERMA',
      status: 'active',
      rootAccountId: rootA._id,
      accountId: rootA._id,
      enrollmentOpenDate: new Date('2026-01-01'),
      enrollmentCloseDate: new Date('2026-12-31'),
    });
    const termB = await AcademicTerm.create({
      name: 'Term B',
      code: 'TERMB',
      status: 'active',
      rootAccountId: rootB._id,
      accountId: rootB._id,
    });

    await Course.create({
      title: 'Phase3 Catalog A',
      description: 'A',
      instructor: teacher._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      academicTermId: termA._id,
      catalog: { startDate: new Date('2026-01-01'), endDate: new Date('2026-06-01') },
    });
    await Course.create({
      title: 'Phase3 Catalog B',
      description: 'B',
      instructor: teacher._id,
      published: true,
      rootAccountId: rootB._id,
      accountId: rootB._id,
      academicTermId: termB._id,
      catalog: { startDate: new Date('2026-01-01'), endDate: new Date('2026-06-01') },
    });

    const res = await request(app)
      .get(`/api/catalog?termId=${termA._id}`)
      .set('Host', 'localhost');
    expect(res.status).toBe(200);
    const titles = (res.body || []).map((c) => c.title);
    expect(titles).toContain('Phase3 Catalog A');
    expect(titles).not.toContain('Phase3 Catalog B');
    expect(res.body[0].academicTerm?.enrollmentOpen).toBe(true);
  });
});
