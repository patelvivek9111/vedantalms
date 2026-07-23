const request = require('supertest');
const { waitForMongoConnection } = require('../../helpers');
const { clearTenantCache } = require('../../../middleware/tenant');
const { ensureDefaultRootAccount } = require('../../../services/tenancy/ensureDefaultRootAccount.service');
const { ensureAccountMembership } = require('../../../services/tenancy/accountMembership.service');

describe('Registrar Phase R3 — student 360 + programs', () => {
  let app;
  let Account;
  let AccountDomain;
  let User;
  let Program;
  let Enrollment;
  let StudentHold;
  let StudentCourseGradeSnapshot;
  let TranscriptIssueLog;
  let Course;
  let rootA;
  let deptAccount;
  let adminToken;
  let deptToken;
  let studentToken;
  let studentInDept;
  let studentOutside;
  let teacher;

  beforeAll(async () => {
    await waitForMongoConnection();
    app = require('../../../server');
    Account = require('../../../models/account.model');
    AccountDomain = require('../../../models/accountDomain.model');
    User = require('../../../models/user.model');
    Program = require('../../../models/program.model');
    Enrollment = require('../../../models/enrollment.model');
    StudentHold = require('../../../models/studentHold.model');
    StudentCourseGradeSnapshot = require('../../../models/studentCourseGradeSnapshot.model');
    TranscriptIssueLog = require('../../../models/transcriptIssueLog.model');
    Course = require('../../../models/course.model');
    clearTenantCache();
  });

  beforeEach(async () => {
    clearTenantCache();
    await Promise.all([
      Account.deleteMany({}),
      AccountDomain.deleteMany({}),
      User.deleteMany({ email: /phaser3\./i }),
      Program.deleteMany({ code: /R3/i }),
      Enrollment.deleteMany({}),
      StudentHold.deleteMany({}),
      StudentCourseGradeSnapshot.deleteMany({}),
      TranscriptIssueLog.collection.deleteMany({}),
      Course.deleteMany({ title: /PhaseR3/i }),
    ]);

    rootA = await ensureDefaultRootAccount();
    deptAccount = await Account.create({
      name: 'Science Dept',
      code: 'R3SCI',
      parentAccountId: rootA._id,
      rootAccountId: rootA._id,
      workflowState: 'active',
    });

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'A',
      email: 'admin@phaser3.a.example.com',
      password: 'Password1!',
      role: 'admin',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });
    await ensureAccountMembership({ user: admin, rootAccountId: rootA._id, role: 'admin' });

    const dept = await User.create({
      firstName: 'Dept',
      lastName: 'Admin',
      email: 'dept@phaser3.a.example.com',
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
      email: 'teacher@phaser3.a.example.com',
      password: 'Password1!',
      role: 'teacher',
      rootAccountId: rootA._id,
      accountId: rootA._id,
    });

    studentInDept = await User.create({
      firstName: 'In',
      lastName: 'Dept',
      email: 'indept@phaser3.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
      studentProfile: {
        admissionNumber: 'ADM-R3-001',
        studentId: 'STU-R3-001',
        batch: '2024',
      },
    });
    await ensureAccountMembership({
      user: studentInDept,
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
      role: 'student',
    });

    studentOutside = await User.create({
      firstName: 'Out',
      lastName: 'Side',
      email: 'outside@phaser3.a.example.com',
      password: 'Password1!',
      role: 'student',
      rootAccountId: rootA._id,
      accountId: rootA._id,
      studentProfile: {
        admissionNumber: 'ADM-R3-999',
      },
    });
    await ensureAccountMembership({
      user: studentOutside,
      rootAccountId: rootA._id,
      role: 'student',
    });

    const login = async (email) => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Host', 'localhost')
        .send({ email, password: 'Password1!' });
      return res.body.token;
    };

    adminToken = await login('admin@phaser3.a.example.com');
    deptToken = await login('dept@phaser3.a.example.com');
    studentToken = await login('indept@phaser3.a.example.com');
  });

  it('rejects student role from student search', async () => {
    const res = await request(app)
      .get('/api/registrar/students/search')
      .query({ q: 'indept' })
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('creates program and updates student profile', async () => {
    const create = await request(app)
      .post('/api/registrar/programs')
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'R3BSC', name: 'B.Sc Computer Science', level: 'ug', durationTerms: 6 });
    expect(create.status).toBe(201);

    const patch = await request(app)
      .patch(`/api/registrar/students/${studentInDept._id}/profile`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        programId: create.body.data._id,
        admissionNumber: 'ADM-R3-001',
        guardianName: 'Parent One',
        externalIds: { sis: 'SIS-001' },
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.studentProfile.programId).toBeTruthy();
    expect(patch.body.data.studentProfile.guardianName).toBe('Parent One');
  });

  it('searches by admission number and returns 360 payload', async () => {
    const search = await request(app)
      .get('/api/registrar/students/search')
      .query({ q: 'ADM-R3-001' })
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(search.status).toBe(200);
    expect(search.body.data.some((s) => s.email === 'indept@phaser3.a.example.com')).toBe(true);

    const course = await Course.create({
      title: 'PhaseR3 Physics',
      description: 'P',
      instructor: teacher._id,
      published: true,
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
      catalog: {
        courseCode: 'R3PHY',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        maxStudents: 30,
      },
      students: [studentInDept._id],
    });

    await Enrollment.create({
      studentId: studentInDept._id,
      lmsCourseId: course._id,
      status: 'active',
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
      statusHistory: [{ status: 'active', at: new Date(), reason: 'Enrolled' }],
    });

    await StudentHold.create({
      studentId: studentInDept._id,
      holdType: 'registration',
      reason: 'Docs pending',
      placedBy: teacher._id,
      rootAccountId: rootA._id,
      accountId: deptAccount._id,
    });

    await StudentCourseGradeSnapshot.create({
      student: studentInDept._id,
      course: course._id,
      term: 'Fall',
      year: 2026,
      finalPercent: 88,
      letterGrade: 'A',
      gradingPolicyVersion: 1,
      gradingPolicyHash: 'hash',
      gradingPolicySnapshot: { scale: [] },
      lifecycleStatus: 'FINALIZED',
      rootAccountId: rootA._id,
    });

    await TranscriptIssueLog.create({
      student: studentInDept._id,
      term: 'Fall',
      year: 2026,
      issuedBy: teacher._id,
      transcriptHash: 'abc123',
      courseCount: 1,
      rootAccountId: rootA._id,
    });

    const view = await request(app)
      .get(`/api/registrar/students/${studentInDept._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(view.status).toBe(200);
    expect(view.body.data.enrollments.length).toBeGreaterThanOrEqual(1);
    expect(view.body.data.holds.length).toBeGreaterThanOrEqual(1);
    expect(view.body.data.grades.length).toBeGreaterThanOrEqual(1);
    expect(view.body.data.transcripts.length).toBeGreaterThanOrEqual(1);
    expect(view.body.data.audit).toBeDefined();
    expect(Array.isArray(view.body.data.documents)).toBe(true);
  });

  it('scopes department_admin student search to subtree', async () => {
    const res = await request(app)
      .get('/api/registrar/students/search')
      .query({ q: 'phaser3' })
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${deptToken}`);
    expect(res.status).toBe(200);
    const emails = res.body.data.map((s) => s.email);
    expect(emails).toContain('indept@phaser3.a.example.com');
    expect(emails).not.toContain('outside@phaser3.a.example.com');
  });

  it('department_admin cannot open student outside subtree', async () => {
    const res = await request(app)
      .get(`/api/registrar/students/${studentOutside._id}`)
      .set('Host', 'localhost')
      .set('Authorization', `Bearer ${deptToken}`);
    expect(res.status).toBe(404);
  });
});
