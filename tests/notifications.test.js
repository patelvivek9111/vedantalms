const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const NotificationPreferences = require('../models/notificationPreferences.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Notifications API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let notificationId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-notif@test.com', 'student-notif@test.com'] } });
    await Notification.deleteMany({});
    await NotificationPreferences.deleteMany({});

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Notif',
        email: 'teacher-notif@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;
    teacherId = teacherResponse.body.user.id;

    // Create student
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Notif',
        email: 'student-notif@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    // Create a test notification
    const notification = new Notification({
      user: studentId,
      type: 'assignment_due',
      title: 'Test Notification',
      message: 'Test notification message',
      read: false
    });
    await notification.save();
    notificationId = notification._id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-notif@test.com', 'student-notif@test.com'] } });
    await Notification.deleteMany({});
    await NotificationPreferences.deleteMany({});
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/notifications', () => {
    it('should get notifications for user', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('unreadCount');
    });

    it('should filter by read status', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ read: 'false' });

      expect(response.status).toBe(200);
      expect(response.body.data.every(n => n.read === false)).toBe(true);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ type: 'assignment_due' });

      expect(response.status).toBe(200);
      expect(response.body.data.every(n => n.type === 'assignment_due')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should reject invalid type', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ type: '' });

      expect(response.status).toBe(400);
    });

    it('should limit max page size', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ limit: 200 }); // More than max of 100

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should get unread count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.count).toBe('number');
    });

    it('should return 0 for user with no unread notifications', async () => {
      // Create user with no notifications
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          email: 'new-user-notif@test.com',
          password: 'password123',
          role: 'student'
        });
      const newToken = newUserResponse.body.token;

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);

      // Cleanup
      await User.deleteMany({ email: 'new-user-notif@test.com' });
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      if (!notificationId) return;

      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.read).toBe(true);
    });

    it('should reject invalid notification ID', async () => {
      const response = await request(app)
        .patch('/api/notifications/invalid-id/read')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should prevent marking other user notification as read', async () => {
      // Create notification for teacher
      const teacherNotification = new Notification({
        user: teacherId,
        type: 'assignment_due',
        title: 'Teacher Notification',
        message: 'Teacher message',
        read: false
      });
      await teacherNotification.save();

      // Student tries to mark teacher's notification as read
      const response = await request(app)
        .patch(`/api/notifications/${teacherNotification._id}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);

      // Cleanup
      await Notification.findByIdAndDelete(teacherNotification._id);
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .patch(`/api/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      // Create some unread notifications
      await Notification.create([
        {
          user: studentId,
          type: 'assignment_due',
          title: 'Notification 1',
          message: 'Message 1',
          read: false
        },
        {
          user: studentId,
          type: 'assignment_graded',
          title: 'Notification 2',
          message: 'Message 2',
          read: false
        }
      ]);

      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.modifiedCount).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when no unread notifications', async () => {
      // Mark all as read first
      await Notification.updateMany({ user: studentId }, { read: true });

      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification', async () => {
      // Create notification to delete
      const deleteNotification = new Notification({
        user: studentId,
        type: 'assignment_due',
        title: 'Notification to Delete',
        message: 'Delete me',
        read: false
      });
      await deleteNotification.save();

      const response = await request(app)
        .delete(`/api/notifications/${deleteNotification._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid notification ID', async () => {
      const response = await request(app)
        .delete('/api/notifications/invalid-id')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should prevent deleting other user notification', async () => {
      // Create notification for teacher
      const teacherNotification = new Notification({
        user: teacherId,
        type: 'assignment_due',
        title: 'Teacher Notification',
        message: 'Teacher message',
        read: false
      });
      await teacherNotification.save();

      // Student tries to delete teacher's notification
      const response = await request(app)
        .delete(`/api/notifications/${teacherNotification._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);

      // Cleanup
      await Notification.findByIdAndDelete(teacherNotification._id);
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should get notification preferences', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should create default preferences if none exist', async () => {
      // Delete existing preferences
      await NotificationPreferences.deleteMany({ user: studentId });

      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    it('should update notification preferences', async () => {
      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          email: {
            assignmentsDue: true,
            assignmentsGraded: false
          },
          inApp: {
            assignmentsDue: true,
            assignmentsGraded: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBeDefined();
      expect(response.body.data.inApp).toBeDefined();
    });

    it('should update push preferences', async () => {
      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          push: {
            assignmentsDue: true
          },
          pushSubscription: {
            endpoint: 'https://example.com/push',
            keys: {
              p256dh: 'test-key',
              auth: 'test-auth'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.push).toBeDefined();
      expect(response.body.data.pushSubscription).toBeDefined();
    });

    it('should update quiet hours', async () => {
      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.quietHours).toBeDefined();
    });

    it('should create preferences if none exist', async () => {
      // Delete existing preferences
      await NotificationPreferences.deleteMany({ user: studentId });

      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          email: {
            assignmentsDue: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });
});

