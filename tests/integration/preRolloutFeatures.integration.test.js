/**
 * Pre-rollout integration tests for features beyond assignment grading.
 * Uses real MongoDB documents — catches bugs that mocked unit tests miss.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const Group = require('../../models/Group');
const GroupSet = require('../../models/GroupSet');
const { createNotification } = require('../../services/notification');
const { waitForMongoConnection } = require('../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('pre-rollout feature integration', () => {
  let teacher;
  let teacherToken;
  let student;
  let studentToken;
  let course;
  let groupSet;
  let group;
  let moduleDoc;
  const originalPlannerFlag = process.env.PLANNER_UX_ENABLED;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    process.env.PLANNER_UX_ENABLED = 'true';

    const ts = Date.now();
    teacher = await User.create({
      firstName: 'Rollout',
      lastName: 'Teacher',
      email: `rollout-teacher-${ts}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    student = await User.create({
      firstName: 'Rollout',
      lastName: 'Student',
      email: `rollout-student-${ts}@example.com`,
      password: 'password123',
      role: 'student',
    });

    const teacherLogin = await request(app).post('/api/auth/login').send({
      email: teacher.email,
      password: 'password123',
    });
    teacherToken = teacherLogin.body.token;

    const studentLogin = await request(app).post('/api/auth/login').send({
      email: student.email,
      password: 'password123',
    });
    studentToken = studentLogin.body.token;

    course = await Course.create({
      title: `Rollout Course ${ts}`,
      description: 'Pre-rollout integration course',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    moduleDoc = await Module.create({
      title: 'Week 1',
      course: course._id,
      published: true,
    });

    groupSet = await GroupSet.create({
      name: 'Lab Groups',
      course: course._id,
    });

    group = await Group.create({
      name: 'Team Alpha',
      groupSet: groupSet._id,
      course: course._id,
      groupId: `G-${ts}`,
      members: [student._id],
    });
  });

  afterAll(async () => {
    process.env.PLANNER_UX_ENABLED = originalPlannerFlag;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('notifications', () => {
    test('metadata Map survives create → list API round-trip', async () => {
      await createNotification(student._id, {
        type: 'assignment_graded',
        title: 'Rollout metadata test',
        message: 'Check metadata',
        metadata: { courseId: String(course._id), assignmentId: 'a1', score: 95 },
        priority: 'medium',
      });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const row = response.body.data.find((n) => n.title === 'Rollout metadata test');
      expect(row).toBeTruthy();
      expect(row.metadata).toEqual({
        courseId: String(course._id),
        assignmentId: 'a1',
        score: 95,
      });
      expect(row.dedupeKey).toBeUndefined();
    });
  });

  describe('inbox', () => {
    test('teacher message increments student unread count', async () => {
      const createRes = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Rollout inbox',
          body: 'Hello student',
          participantIds: [String(student._id)],
          course: String(course._id),
        });

      expect(createRes.status).toBe(201);
      const conversationId =
        createRes.body.conversation?._id || createRes.body.conversation?.id || createRes.body._id;

      const unreadRes = await request(app)
        .get('/api/inbox/unread-count')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(unreadRes.status).toBe(200);
      expect(unreadRes.body.count).toBeGreaterThanOrEqual(1);

      const markRead = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(markRead.status).toBe(200);

      const afterRead = await request(app)
        .get('/api/inbox/unread-count')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(afterRead.body.count).toBe(0);
    });
  });

  describe('groups', () => {
    let groupAssignment;

    beforeAll(async () => {
      groupAssignment = await Assignment.create({
        title: 'Group rollout assignment',
        description: 'Group work',
        isGroupAssignment: true,
        groupSet: groupSet._id,
        availableFrom: new Date(Date.now() - 86400000),
        dueDate: new Date(Date.now() + 86400000),
        createdBy: teacher._id,
        published: true,
        totalPoints: 5,
        questions: [{ text: 'Q1', type: 'text', points: 5 }],
      });

      await Submission.create({
        assignment: groupAssignment._id,
        student: student._id,
        submittedBy: student._id,
        group: group._id,
        answers: { 0: 'group answer text' },
        submittedAt: new Date(),
      });
    });

    test('group activity returns serialized submission answers for teacher', async () => {
      const response = await request(app)
        .get(`/api/groups/${group._id}/activity`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.submissions)).toBe(true);
      expect(response.body.submissions.length).toBeGreaterThanOrEqual(1);
      const row = response.body.submissions.find(
        (s) => String(s.assignment) === String(groupAssignment._id) ||
          String(s.assignment?._id) === String(groupAssignment._id)
      );
      expect(row).toBeTruthy();
      expect(row.answers).toEqual({ 0: 'group answer text' });
    });

    test('group message endpoint allows course instructor', async () => {
      const response = await request(app)
        .post(`/api/groups/${group._id}/message`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ subject: 'Team update', content: 'Please review the brief.' });

      expect(response.status).toBe(200);
      expect(response.body.title).toContain('Team Alpha');
    });

    test('group activity rejects enrolled students', async () => {
      const response = await request(app)
        .get(`/api/groups/${group._id}/activity`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('polls', () => {
    let pollId;

    beforeAll(async () => {
      const createRes = await request(app)
        .post(`/api/polls/courses/${course._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Rollout poll',
          options: ['Option A', 'Option B'],
          endDate: new Date(Date.now() + 86400000).toISOString(),
          allowMultipleVotes: false,
          resultsVisible: true,
        });
      expect(createRes.status).toBe(201);
      pollId = createRes.body.data._id || createRes.body.data.id;
    });

    test('student vote is reflected in teacher results', async () => {
      const voteRes = await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ selectedOptions: [0] });

      expect(voteRes.status).toBe(200);

      const resultsRes = await request(app)
        .get(`/api/polls/${pollId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(resultsRes.status).toBe(200);
      expect(resultsRes.body.data.totalVotes).toBeGreaterThanOrEqual(1);
      expect(resultsRes.body.data.studentVotes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('attendance', () => {
    const attendanceDate = new Date().toISOString().split('T')[0];

    test('save updates stats consistently', async () => {
      const saveRes = await request(app)
        .post(`/api/courses/${course._id}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: attendanceDate,
          attendanceData: [{ studentId: String(student._id), status: 'present' }],
        });

      expect(saveRes.status).toBe(200);

      const statsRes = await request(app)
        .get(`/api/courses/${course._id}/attendance/stats`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ startDate: attendanceDate, endDate: attendanceDate });

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.present).toBeGreaterThanOrEqual(1);
      expect(statsRes.body.byStudent[String(student._id)].present).toBeGreaterThanOrEqual(1);

      const studentRes = await request(app)
        .get(`/api/courses/${course._id}/attendance/student`)
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ date: attendanceDate });

      expect(studentRes.status).toBe(200);
      expect(Array.isArray(studentRes.body)).toBe(true);
      expect(studentRes.body[0].status).toBe('present');
    });
  });

  describe('todo', () => {
    test('personal todo CRUD round-trip', async () => {
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Rollout todo item',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(createRes.status).toBe(201);
      const todoId = createRes.body._id;

      const listRes = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.some((t) => String(t._id) === String(todoId))).toBe(true);

      const deleteRes = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('planner', () => {
    test('feed includes personal todo and dismiss hides it', async () => {
      const dueThisWeek = new Date();
      dueThisWeek.setHours(23, 59, 0, 0);

      const todoRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Planner dismiss rollout', dueDate: dueThisWeek.toISOString() });

      expect(todoRes.status).toBe(201);
      const todoId = todoRes.body._id;

      const feedBefore = await request(app)
        .get('/api/planner/feed')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(feedBefore.status).toBe(200);
      const item = feedBefore.body.data.find(
        (row) => String(row._id) === String(todoId) || row.title === 'Planner dismiss rollout'
      );
      expect(item).toBeTruthy();

      const itemKey = item.plannerItemKey || item.itemKey || `todo:${todoId}`;
      const dismissRes = await request(app)
        .post(`/api/planner/items/${encodeURIComponent(itemKey)}/dismiss`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(dismissRes.status).toBe(200);

      const feedAfter = await request(app)
        .get('/api/planner/feed')
        .set('Authorization', `Bearer ${studentToken}`);

      const stillVisible = feedAfter.body.data.find(
        (row) => String(row._id) === String(todoId)
      );
      expect(stillVisible).toBeUndefined();
    });
  });
});
