const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R7 — sections, cross-list, dept scope', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Course;
  let CourseOffering;
  let CourseSection;
  let CrossListGroup;
  let AcademicTerm;
  let rootA;
  let deptAccount;
  let otherDept;
  let adminToken;
  let deptToken;
  let studentToken;
  let teacher;
  let term;
  let offering;
  let sectionA;
  let sectionB;
  let courseA;
  let courseB;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Course = require('../../../models/course.model');
    CourseOffering = require('../../../models/courseOffering.model');
    CourseSection = require('../../../models/courseSection.model');
    CrossListGroup = require('../../../models/crossListGroup.model');
    AcademicTerm = require('../../../models/academicTerm.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser7\./i }),
      Course.deleteMany({ title: /PhaseR7/i }),
      CourseOffering.deleteMany({ courseCode: /R7/i }),
      CourseSection.deleteMany({}),
      CrossListGroup.deleteMany({}),
      AcademicTerm.deleteMany({ code: /PHASER7/i }),
    ]);

    rootA = await ensureDefaultRootAccount();
    deptAccount = await Account.create({
      name: 'Science',
      code: 'R7SCI',
      parentAccountId: rootA._id,
      rootAccountId: rootA._id,
      workflowState: 'active',
    });
    otherDept = await Account.create({
      name: 'Arts',
      code: 'R7ART',
      parentAccountId: rootA._id,
      rootAccountId: rootA._id,
      workflowState: 'active',
    });

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser7.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    const dept = await User.create({
      firstName: 'Dept',
      lastName: 'Sci',
      email: 'dept@phaser7.a.example.com',
      password: 'Password1!',
      role: 'department_admin',
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
    });
    await ensureAccountMembership({
      user: dept,
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
      role: 'department_admin',
    });

    teacher = await User.create({
      firstName: 'Teach',
      lastName: 'Er',
      email: 'teacher@phaser7.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
    });

    const student = await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'student@phaser7.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
    });

    term = await AcademicTerm.create({
      name: 'R7 Term',
      code: 'PHASER7-S1',
      status: 'active',
      enrollmentOpenDate: new Date(Date.now() - 86400000),
      enrollmentCloseDate: new Date(Date.now() + 86400000 * 30),
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    offering = await CourseOffering.create({
      courseCode: 'R7CS101',
      title: 'PhaseR7 Intro',
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
    });

    courseA = await Course.create({
      title: 'PhaseR7 Section A',
      description: 'A',
      instructor: teacher._id,
      published: true,
      academicTermId: term._id,
      offeringId: offering._id,
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
      semester: { term: 'Fall', year: 2026 },
      catalog: { courseCode: 'R7CS101', maxStudents: 40 },
      students: [],
      waitlist: [],
      enrollmentRequests: [],
    });

    courseB = await Course.create({
      title: 'PhaseR7 Section B',
      description: 'B',
      instructor: teacher._id,
      published: true,
      academicTermId: term._id,
      offeringId: offering._id,
      rootAccountId: rootA._id,
      accountId: otherDept._id,
      semester: { term: 'Fall', year: 2026 },
      catalog: { courseCode: 'R7CS101B', maxStudents: 40 },
      students: [],
      waitlist: [],
      enrollmentRequests: [],
    });

    sectionA = await CourseSection.create({
      offeringId: offering._id,
      academicTermId: term._id,
      sectionNumber: '01',
      instructorId: teacher._id,
      enrollmentMethod: 'open',
      status: 'published',
      lmsCourseId: courseA._id,
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
    });

    sectionB = await CourseSection.create({
      offeringId: offering._id,
      academicTermId: term._id,
      sectionNumber: '02',
      instructorId: teacher._id,
      enrollmentMethod: 'open',
      status: 'published',
      lmsCourseId: courseB._id,
      rootAccountId: rootA._id,
      accountId: otherDept._id,
    });

    await Course.updateOne({ _id: courseA._id }, { $set: { sectionId: sectionA._id, sectionNumber: '01' } });
    await Course.updateOne({ _id: courseB._id }, { $set: { sectionId: sectionB._id, sectionNumber: '02' } });

    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin@phaser7.a.example.com', password: 'Password1!' });
    adminToken = loginAdmin.body.token;

    const loginDept = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'dept@phaser7.a.example.com', password: 'Password1!' });
    deptToken = loginDept.body.token;

    const loginStu = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'student@phaser7.a.example.com', password: 'Password1!' });
    studentToken = loginStu.body.token;
  });

  it('blocks self-enroll for registrar_only and sis_only; approval queues request', async () => {
    await CourseSection.updateOne({ _id: sectionA._id }, { $set: { enrollmentMethod: 'registrar_only' } });
    const blocked = await request(app)
      .post(`/api/courses/${courseA._id}/enroll`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.joinState).toBe('enrollment_method_blocked');

    await CourseSection.updateOne({ _id: sectionA._id }, { $set: { enrollmentMethod: 'sis_only' } });
    const sisBlocked = await request(app)
      .post(`/api/courses/${courseA._id}/enroll`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(sisBlocked.status).toBe(403);

    await CourseSection.updateOne({ _id: sectionA._id }, { $set: { enrollmentMethod: 'approval' } });
    const approval = await request(app)
      .post(`/api/courses/${courseA._id}/enroll`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(approval.status).toBe(200);
    expect(approval.body.awaitingTeacherApproval).toBe(true);

    const refreshed = await Course.findById(courseA._id);
    expect(refreshed.students).toHaveLength(0);
    expect(refreshed.enrollmentRequests.some((r) => r.status === 'pending')).toBe(true);
  });

  it('creates shared cross-list remounting lmsCourseId to primary content', async () => {
    const res = await request(app)
      .post('/api/academic-structure/cross-lists')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'R7 Combined',
        sectionIds: [sectionA._id, sectionB._id],
        sharedGradebook: true,
        primarySectionId: sectionA._id,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.sharedGradebook).toBe(true);
    expect(String(res.body.data.sharedContentCourseId)).toBe(String(courseA._id));

    const updatedB = await CourseSection.findById(sectionB._id);
    expect(String(updatedB.lmsCourseId)).toBe(String(courseA._id));
    expect(String(updatedB.crossListGroupId)).toBe(String(res.body.data._id));

    const patch = await request(app)
      .patch(`/api/academic-structure/sections/${sectionA._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ conclude: true });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('concluded');
  });

  it('scopes section list to department_admin subtree', async () => {
    const deptList = await request(app)
      .get('/api/academic-structure/sections')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${deptToken}`);
    expect(deptList.status).toBe(200);
    const ids = (deptList.body.data || []).map((s) => String(s._id));
    expect(ids).toContain(String(sectionA._id));
    expect(ids).not.toContain(String(sectionB._id));

    const adminList = await request(app)
      .get('/api/academic-structure/sections')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.body.count).toBeGreaterThanOrEqual(2);
  });

  it('reports structure gaps and exports roster csv', async () => {
    const gaps = await request(app)
      .get('/api/registrar/structure/gaps')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(gaps.status).toBe(200);
    expect(gaps.body.data.sections).toBeGreaterThanOrEqual(2);

    const csv = await request(app)
      .get(`/api/registrar/sections/${sectionA._id}/roster.csv`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(String(csv.text || csv.body)).toContain('section_number');
  });
});
