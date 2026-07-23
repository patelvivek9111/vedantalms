const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');
const { checkEnrollmentRules } = require('../../../services/registrar/enrollmentRules.service');

describe('Registrar Phase R2 — enrollment rules + workflows', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let Enrollment;
  let AcademicTerm;
  let rootA;
  let adminToken;
  let teacher;
  let student;
  let student2;
  let courseA;
  let courseB;
  let term;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    Enrollment = require('../../../models/enrollment.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser2\./i }),
      Course.deleteMany({ title: /PhaseR2/i }),
      Enrollment.deleteMany({}),
      AcademicTerm.deleteMany({ code: /PHASER2/i }),
    ]);

    rootA = await ensureDefaultRootAccount();

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser2.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser2.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: teacher, rootAccountId: rootA._id, role: 'teacher' });

    student = await User.create({
      firstName: 'Stu',
      lastName: 'One',
      email: 'student1@phaser2.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: student, rootAccountId: rootA._id, role: 'student' });

    student2 = await User.create({
      firstName: 'Stu',
      lastName: 'Two',
      email: 'student2@phaser2.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: student2, rootAccountId: rootA._id, role: 'student' });

    term = await AcademicTerm.create({
      name: 'Phase R2 Term',
      code: 'PHASER2-S1',
      status: 'active',
      enrollmentOpenDate: new Date('2020-01-01'),
      enrollmentCloseDate: new Date('2099-01-01'),
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    courseA = await Course.create({
      title: 'PhaseR2 Algebra',
      description: 'A',
      instructor: teacher._id,
      published: true,
      academicTermId: term._id,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      catalog: {
        courseCode: 'R2ALG',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        maxStudents: 1,
      },
      students: [],
      waitlist: [],
    });

    courseB = await Course.create({
      title: 'PhaseR2 Geometry',
      description: 'B',
      instructor: teacher._id,
      published: true,
      academicTermId: term._id,
      rootAccountId: rootA._id,
      accountId: rootA._id,
      catalog: {
        courseCode: 'R2GEO',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        maxStudents: 30,
      },
      students: [],
      waitlist: [],
    });

    const login = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phaser2.a.example.com', password: 'Password1!' });
    adminToken = login.body.token;
  });

  it('rules engine flags already enrolled and capacity warnings', async () => {
    await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: courseA._id, studentIds: [student._id] });

    const already = await checkEnrollmentRules({
      studentId: student._id,
      course: await Course.findById(courseA._id),
      source: 'registrar',
    });
    expect(already.allowed).toBe(false);
    expect(already.violations.some((v) => v.code === 'already_enrolled')).toBe(true);

    const capacity = await checkEnrollmentRules({
      studentId: student2._id,
      course: await Course.findById(courseA._id),
      source: 'registrar',
    });
    expect(capacity.warnings.some((w) => w.code === 'capacity_full')).toBe(true);
  });

  it('preview then bulk enroll with CSV', async () => {
    const preview = await request(app)
      .post('/api/registrar/enrollments/preview')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        csv: `${student.email},${courseB.catalog.courseCode}\n${student2.email},${courseB.catalog.courseCode}`,
      });
    expect(preview.status).toBe(200);
    expect(preview.body.data.allowed).toBe(2);

    const apply = await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        csv: `${student.email},R2GEO\n${student2.email},R2GEO`,
      });
    expect(apply.status).toBe(201);
    expect(apply.body.data.enrolled).toBe(2);
    expect(await Enrollment.countDocuments({ lmsCourseId: courseB._id, status: 'active' })).toBe(2);
  });

  it('transfers enrollment and preserves history', async () => {
    const bulk = await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: courseA._id, studentIds: [student._id] });
    const enrollmentId = bulk.body.data.results[0].enrollmentId;

    const transfer = await request(app)
      .post(`/api/registrar/enrollments/${enrollmentId}/transfer`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toCourseId: String(courseB._id), reason: 'Schedule conflict' });
    expect(transfer.status).toBe(200);
    expect(transfer.body.data.to.lmsCourseId.toString()).toBe(String(courseB._id));
    expect(transfer.body.data.from.status).toBe('dropped');

    const fromCourse = await Course.findById(courseA._id);
    const toCourse = await Course.findById(courseB._id);
    expect(fromCourse.students.map(String)).not.toContain(String(student._id));
    expect(toCourse.students.map(String)).toContain(String(student._id));
  });

  it('patches enrollment status with reason', async () => {
    const bulk = await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: courseB._id, studentIds: [student._id] });
    const enrollmentId = bulk.body.data.results[0].enrollmentId;

    const bad = await request(app)
      .patch(`/api/registrar/enrollments/${enrollmentId}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'withdrawn' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/registrar/enrollments/${enrollmentId}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'withdrawn', reason: 'Student request' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('withdrawn');

    const course = await Course.findById(courseB._id);
    expect(course.students.map(String)).not.toContain(String(student._id));
  });

  it('promotes waitlist student onto roster', async () => {
    courseA.waitlist.push({ student: student2._id, position: 1, addedAt: new Date() });
    await courseA.save();

    const res = await request(app)
      .post(`/api/registrar/courses/${courseA._id}/waitlist/promote`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(String(res.body.data.studentId)).toBe(String(student2._id));

    const updated = await Course.findById(courseA._id);
    expect(updated.waitlist.length).toBe(0);
    expect(updated.students.map(String)).toContain(String(student2._id));
    expect(
      await Enrollment.countDocuments({
        lmsCourseId: courseA._id,
        studentId: student2._id,
        status: 'active',
      })
    ).toBe(1);
  });

  it('lists student enrollment history', async () => {
    await request(app)
      .post('/api/registrar/enrollments/bulk')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: courseB._id, studentIds: [student._id] });

    const res = await request(app)
      .get(`/api/registrar/students/${student._id}/enrollments`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });
});
