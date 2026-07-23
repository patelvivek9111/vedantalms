const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R4 — term-wide grade governance', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let AcademicTerm;
  let CourseGradeLifecycle;
  let InstitutionGradingPeriod;
  let StudentCourseGradeSnapshot;
  let SystemAuditEvent;
  let rootA;
  let adminToken;
  let teacher;
  let student;
  let term;
  let courseA;
  let courseB;

  beforeAll(async () => {
    process.env.FORCE_INLINE_JOBS = 'true';
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    CourseGradeLifecycle = require('../../../models/courseGradeLifecycle.model');
    InstitutionGradingPeriod = require('../../../models/institutionGradingPeriod.model');
    StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');
    SystemAuditEvent = require('../../../models/systemAuditEvent.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser4\./i }),
      Course.deleteMany({ title: /PhaseR4/i }),
      AcademicTerm.deleteMany({ code: /PHASER4/i }),
      CourseGradeLifecycle.deleteMany({}),
      InstitutionGradingPeriod.deleteMany({}),
      StudentCourseGradeSnapshot.deleteMany({}),
      SystemAuditEvent.deleteMany({ action: /registrar\.grades/ }),
    ]);

    rootA = await ensureDefaultRootAccount();

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser4.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser4.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phaser4.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    term = await AcademicTerm.create({
      name: 'Phase R4 Term',
      code: 'PHASER4-S1',
      status: 'grading',
      legacyTermLabel: 'Fall',
      legacyYear: 2026,
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    const mkCourse = (title, code) =>
      Course.create({
        title,
        description: title,
        instructor: teacher._id,
        published: true,
        academicTermId: term._id,
        rootAccountId: rootA._id,
        accountId: rootA._id,
        semester: { term: 'Fall', year: 2026 },
        catalog: {
          courseCode: code,
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-12-15'),
          maxStudents: 30,
        },
        students: [student._id],
      });

    courseA = await mkCourse('PhaseR4 Algebra', 'R4ALG');
    courseB = await mkCourse('PhaseR4 Geometry', 'R4GEO');

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phaser4.a.example.com', password: 'Password1!' });
    adminToken = login.body.token;
  });

  it('creates and closes institution grading periods + inherit', async () => {
    const create = await request(app)
      .post(`/api/registrar/terms/${term._id}/grading-periods`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Midterm', position: 1, weight: 40 });
    expect(create.status).toBe(201);

    const inherit = await request(app)
      .post(`/api/registrar/terms/${term._id}/grading-periods/inherit`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(inherit.status).toBe(200);
    expect(inherit.body.data.applied).toBeGreaterThanOrEqual(2);

    const close = await request(app)
      .post(`/api/registrar/grading-periods/${create.body.data._id}/close`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(close.status).toBe(200);
    expect(close.body.data.status).toBe('closed');
  });

  it('previews and finalizes all courses in a term', async () => {
    const preview = await request(app)
      .post(`/api/registrar/terms/${term._id}/finalize/preview`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(preview.status).toBe(200);
    expect(preview.body.data.toFinalize).toBeGreaterThanOrEqual(2);

    const apply = await request(app)
      .post(`/api/registrar/terms/${term._id}/finalize`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ async: false });
    expect([200, 202]).toContain(apply.status);

    // Inline path or job result — ensure lifecycles finalized
    if (apply.body.data?.jobId && apply.body.data?.result) {
      expect(apply.body.data.result.finalized).toBeGreaterThanOrEqual(1);
    } else if (apply.body.data?.finalized != null) {
      expect(apply.body.data.finalized).toBeGreaterThanOrEqual(2);
    } else if (apply.body.data?.jobId) {
      // poll job
      const job = await request(app)
        .get(`/api/registrar/jobs/${apply.body.data.jobId}`)
        .set('Host', 'localhost')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(job.status).toBe(200);
      expect(['completed', 'active', 'pending']).toContain(job.body.data.status);
    }

    // Force sync finalize remaining if job path was async-only without wait
    await request(app)
      .post(`/api/registrar/terms/${term._id}/finalize`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ async: false });

    const lifeA = await CourseGradeLifecycle.findOne({ course: courseA._id });
    const lifeB = await CourseGradeLifecycle.findOne({ course: courseB._id });
    expect(lifeA?.status).toBe('FINALIZED');
    expect(lifeB?.status).toBe('FINALIZED');

    const audits = await SystemAuditEvent.find({
      action: 'registrar.grades.finalized',
      'metadata.termId': String(term._id),
    }).lean();
    expect(audits.length).toBeGreaterThanOrEqual(1);

    const dash = await request(app)
      .get(`/api/registrar/terms/${term._id}/grades-dashboard`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.widgets.unfinalized).toBe(0);
  });

  it('grades dashboard returns widgets before finalize', async () => {
    const dash = await request(app)
      .get(`/api/registrar/terms/${term._id}/grades-dashboard`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.widgets.unfinalized).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(dash.body.data.rows)).toBe(true);
  });
});
