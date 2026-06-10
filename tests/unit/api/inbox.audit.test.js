/**
 * Inbox audit + anti-spam — requires INBOX_AUDIT_ENABLED and INBOX_ANTISPAM_ENFORCED.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../../models/user.model');
const Course = require('../../../models/course.model');
const SystemAuditEvent = require('../../../models/systemAuditEvent.model');
const { waitForMongoConnection } = require('../../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Inbox API — audit and anti-spam', () => {
  let teacherToken;
  let studentToken;
  let studentId;
  let courseId;
  let conversationId;
  let auditPrev;
  let spamPrev;

  beforeAll(async () => {
    auditPrev = process.env.INBOX_AUDIT_ENABLED;
    spamPrev = process.env.INBOX_ANTISPAM_ENFORCED;
    process.env.INBOX_AUDIT_ENABLED = 'true';
    process.env.INBOX_ANTISPAM_ENFORCED = 'true';
    process.env.INBOX_MAX_MESSAGES_PER_MINUTE = '100';
    process.env.INBOX_DUPLICATE_WINDOW_SEC = '300';

    await waitForMongoConnection(MONGODB_URI);
    await User.deleteMany({ email: { $in: ['teacher-audit@test.com', 'student-audit@test.com'] } });
    await Course.deleteMany({ title: 'Inbox Audit Test Course' });
    await SystemAuditEvent.deleteMany({ action: /^inbox_/ });

    const teacherRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Audit',
        email: 'teacher-audit@test.com',
        password: 'password123',
        role: 'teacher',
      });
    teacherToken = teacherRes.body.token;

    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Audit',
        email: 'student-audit@test.com',
        password: 'password123',
        role: 'student',
      });
    studentToken = studentRes.body.token;
    studentId = studentRes.body.user.id;

    const courseRes = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Inbox Audit Test Course',
        description: 'Course for audit tests',
        code: `AUD${Date.now().toString(36).slice(-6)}`,
      });
    courseId = courseRes.body.data?._id || courseRes.body.data?.id;

    const convRes = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        participantIds: [studentId],
        subject: 'Audit thread',
        body: '<p>Initial</p>',
        ...(courseId ? { course: courseId } : {}),
      });
    expect(convRes.status).toBe(201);
    conversationId = convRes.body.conversation._id || convRes.body.conversation.id;
  });

  afterAll(async () => {
    process.env.INBOX_AUDIT_ENABLED = auditPrev;
    process.env.INBOX_ANTISPAM_ENFORCED = spamPrev;
    await User.deleteMany({ email: { $in: ['teacher-audit@test.com', 'student-audit@test.com'] } });
    await Course.deleteMany({ title: 'Inbox Audit Test Course' });
    await SystemAuditEvent.deleteMany({ action: /^inbox_/ });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('writes inbox_message_sent audit on reply', async () => {
    const res = await request(app)
      .post(`/api/inbox/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ body: '<p>Follow up</p>' });

    expect(res.status).toBe(201);

    const events = await SystemAuditEvent.find({ action: 'inbox_message_sent' }).lean();
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects duplicate message body when anti-spam enabled', async () => {
    const body = '<p>Duplicate probe</p>';
    const first = await request(app)
      .post(`/api/inbox/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ body });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/inbox/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ body });
    expect(second.status).toBe(429);
    expect(second.body.code).toBe('INBOX_DUPLICATE_MESSAGE');

    const spamEvents = await SystemAuditEvent.find({ action: 'inbox_spam_blocked' }).lean();
    expect(spamEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 403 audit trail for non-participant read', async () => {
    const otherTeacher = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Other',
        lastName: 'Teacher',
        email: 'other-audit@test.com',
        password: 'password123',
        role: 'teacher',
      });

    const res = await request(app)
      .get(`/api/inbox/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${otherTeacher.body.token}`);

    expect(res.status).toBe(403);

    const denied = await SystemAuditEvent.find({ action: 'inbox_access_denied' }).lean();
    expect(denied.length).toBeGreaterThanOrEqual(1);

    await User.deleteMany({ email: 'other-audit@test.com' });
  });
});
