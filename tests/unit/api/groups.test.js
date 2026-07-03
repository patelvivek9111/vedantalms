const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../../models/user.model');
const Course = require('../../../models/course.model');
const Group = require('../../../models/Group');
const GroupSet = require('../../../models/GroupSet');
const { waitForMongoConnection } = require('../../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Groups API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let outsiderToken;
  let outsiderId;
  let courseId;
  let groupSetId;
  let groupId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);

    const emails = [
      'teacher-groups@test.com',
      'student-groups@test.com',
      'outsider-groups@test.com',
    ];
    await User.deleteMany({ email: { $in: emails } });
    await Course.deleteMany({ title: 'Test Course for Groups' });
    await Group.deleteMany({});
    await GroupSet.deleteMany({});

    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Groups',
        email: 'teacher-groups@test.com',
        password: 'password123',
        role: 'teacher',
      });
    teacherToken = teacherResponse.body.token;
    teacherId = teacherResponse.body.user.id;

    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Groups',
        email: 'student-groups@test.com',
        password: 'password123',
        role: 'student',
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    const outsiderResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Outsider',
        lastName: 'Groups',
        email: 'outsider-groups@test.com',
        password: 'password123',
        role: 'student',
      });
    outsiderToken = outsiderResponse.body.token;
    outsiderId = outsiderResponse.body.user.id;

    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Groups',
        description: 'Course for testing group auth',
        code: 'GRP101',
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    await Course.findByIdAndUpdate(courseId, {
      $addToSet: { students: studentId },
    });

    const groupSet = await GroupSet.create({
      name: 'Test Group Set',
      course: courseId,
    });
    groupSetId = groupSet._id;

    const group = await Group.create({
      name: 'Test Group',
      groupSet: groupSetId,
      course: courseId,
      groupId: `GRP-${Date.now()}`,
      members: [studentId],
    });
    groupId = group._id;
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'teacher-groups@test.com',
          'student-groups@test.com',
          'outsider-groups@test.com',
        ],
      },
    });
    await Course.deleteMany({ title: 'Test Course for Groups' });
    await Group.deleteMany({});
    await GroupSet.deleteMany({});

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/groups/:groupId/members', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app).get(`/api/groups/${groupId}/members`);
      expect(response.status).toBe(401);
    });

    it('allows group members to view roster', async () => {
      const response = await request(app)
        .get(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((m) => String(m._id) === String(studentId))).toBe(true);
    });

    it('allows course grading staff to view roster', async () => {
      const response = await request(app)
        .get(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('rejects non-members who are not grading staff', async () => {
      const response = await request(app)
        .get(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/groups/:groupId/members/:userId', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app).delete(
        `/api/groups/${groupId}/members/${studentId}`
      );
      expect(response.status).toBe(401);
    });

    it('rejects students removing other members', async () => {
      const response = await request(app)
        .delete(`/api/groups/${groupId}/members/${teacherId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/groups/sets/:groupSetId/available-students', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app).get(
        `/api/groups/sets/${groupSetId}/available-students`
      );
      expect(response.status).toBe(401);
    });

    it('rejects enrolled students who are not grading staff', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/${groupSetId}/available-students`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('allows course grading staff to list available students', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/${groupSetId}/available-students`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/groups/:groupId/members', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .send({ userId: outsiderId });

      expect(response.status).toBe(401);
    });

    it('rejects students from modifying group membership', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ userId: outsiderId });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/groups/sets/:setId/groups', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app).get(`/api/groups/sets/${groupSetId}/groups`);
      expect(response.status).toBe(401);
    });

    it('allows enrolled students to list groups in their course', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/${groupSetId}/groups`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('rejects users not enrolled in the course', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/${groupSetId}/groups`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/groups/sets/:courseId', () => {
    it('rejects users not enrolled in the course', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/${courseId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status).toBe(403);
    });

    it('allows course grading staff to list group sets', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/groups/sets/id/:setId', () => {
    it('rejects users not enrolled in the course', async () => {
      const response = await request(app)
        .get(`/api/groups/sets/id/${groupSetId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status).toBe(403);
    });
  });
});
