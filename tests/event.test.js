const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Event = require('../models/event.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Events API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;
  let eventId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-event@test.com', 'student-event@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Events' });
    await Event.deleteMany({ title: 'Test Event' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Event',
        email: 'teacher-event@test.com',
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
        lastName: 'Event',
        email: 'student-event@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    // Create course
    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Events',
        description: 'Course for testing events',
        code: 'EVT101',
        published: true
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Enroll student in course
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: { students: studentId }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-event@test.com', 'student-event@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Events' });
    await Event.deleteMany({ title: 'Test Event' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/events', () => {
    it('should get events for teacher', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get events for student (own calendar and enrolled courses)', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter events by calendar', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ calendar: teacherId });

      expect(response.status).toBe(200);
    });

    it('should filter events by date range', async () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);

      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          start: start.toISOString(),
          end: end.toISOString()
        });

      expect(response.status).toBe(200);
    });

    it('should reject invalid calendar ID', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ calendar: 'invalid-id' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid date range (end before start)', async () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() - 7);

      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          start: start.toISOString(),
          end: end.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should prevent student from accessing unauthorized calendar', async () => {
      // Create another teacher
      const otherTeacherResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Other',
          lastName: 'Teacher',
          email: 'other-teacher-event@test.com',
          password: 'password123',
          role: 'teacher'
        });
      const otherTeacherId = otherTeacherResponse.body.user.id;

      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ calendar: otherTeacherId });

      expect(response.status).toBe(403);

      // Cleanup
      await User.deleteMany({ email: 'other-teacher-event@test.com' });
    });
  });

  describe('POST /api/events', () => {
    it('should create event (teacher)', async () => {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event',
          color: '#3788d8',
          location: 'Test Location'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Event');
      eventId = response.body._id || response.body.id;
    });

    it('should create event with calendar', async () => {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event with Calendar',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event',
          calendar: courseId
        });

      expect(response.status).toBe(201);
    });

    it('should require title', async () => {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event'
        });

      expect(response.status).toBe(400);
    });

    it('should require start date', async () => {
      const end = new Date();
      end.setHours(end.getHours() + 2);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event',
          end: end.toISOString(),
          type: 'event'
        });

      expect(response.status).toBe(400);
    });

    it('should require end date', async () => {
      const start = new Date();

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event',
          start: start.toISOString(),
          type: 'event'
        });

      expect(response.status).toBe(400);
    });

    it('should reject end date before start date', async () => {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() - 2);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event',
          start: 'invalid-date',
          end: 'invalid-date',
          type: 'event'
        });

      expect(response.status).toBe(400);
    });

    it('should allow student to create event', async () => {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Event',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event'
        });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/events/:id', () => {
    it('should get event by ID (creator)', async () => {
      if (!eventId) {
        // Create an event first if none exists
        const start = new Date();
        const end = new Date();
        end.setHours(end.getHours() + 2);
        const createResponse = await request(app)
          .post('/api/events')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Event for Get',
            start: start.toISOString(),
            end: end.toISOString(),
            type: 'event'
          });
        eventId = createResponse.body._id || createResponse.body.id;
      }

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should reject invalid event ID', async () => {
      const response = await request(app)
        .get('/api/events/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should prevent student from accessing other student events', async () => {
      // Create event as teacher
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);
      const createResponse = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Teacher Event',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event',
          calendar: teacherId
        });
      const teacherEventId = createResponse.body._id || createResponse.body.id;

      // Student should not be able to access teacher's personal event
      const response = await request(app)
        .get(`/api/events/${teacherEventId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      // This might be 403 or 404 depending on implementation
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('PUT /api/events/:id', () => {
    it('should update event (creator)', async () => {
      if (!eventId) {
        const start = new Date();
        const end = new Date();
        end.setHours(end.getHours() + 2);
        const createResponse = await request(app)
          .post('/api/events')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Event for Update',
            start: start.toISOString(),
            end: end.toISOString(),
            type: 'event'
          });
        eventId = createResponse.body._id || createResponse.body.id;
      }

      const newEnd = new Date();
      newEnd.setHours(newEnd.getHours() + 4);

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Event Title',
          end: newEnd.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Event Title');
    });

    it('should prevent student from updating teacher event', async () => {
      if (!eventId) return;

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });

    it('should reject invalid event ID', async () => {
      const response = await request(app)
        .put('/api/events/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Title'
        });

      expect(response.status).toBe(400);
    });

    it('should reject end date before start date', async () => {
      if (!eventId) return;

      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() - 2);

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          start: start.toISOString(),
          end: end.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should allow admin to update any event', async () => {
      // Clean up any existing user first
      await User.deleteMany({ email: 'admin-event@test.com' });

      // Create admin user directly in database to avoid rate limiting
      const adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'Event',
        email: 'admin-event@test.com',
        password: 'password123',
        role: 'admin'
      });
      const adminToken = adminUser.getSignedJwtToken();

      if (!eventId) {
        const start = new Date();
        const end = new Date();
        end.setHours(end.getHours() + 2);
        const createResponse = await request(app)
          .post('/api/events')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Event for Admin Update',
            start: start.toISOString(),
            end: end.toISOString(),
            type: 'event'
          });
        eventId = createResponse.body._id || createResponse.body.id;
      }

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Updated Title'
        });

      expect(response.status).toBe(200);

      // Cleanup
      await User.deleteMany({ email: 'admin-event@test.com' });
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should delete event (creator)', async () => {
      // Create event to delete
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);
      const createResponse = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event to Delete',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event'
        });
      const deleteEventId = createResponse.body._id || createResponse.body.id;

      const response = await request(app)
        .delete(`/api/events/${deleteEventId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent student from deleting teacher event', async () => {
      if (!eventId) return;

      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject invalid event ID', async () => {
      const response = await request(app)
        .delete('/api/events/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });

    it('should allow admin to delete any event', async () => {
      // Clean up any existing user first
      await User.deleteMany({ email: 'admin-delete-event@test.com' });

      // Create admin user directly in database to avoid rate limiting
      const adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'Delete',
        email: 'admin-delete-event@test.com',
        password: 'password123',
        role: 'admin'
      });
      const adminToken = adminUser.getSignedJwtToken();

      // Create event to delete
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 2);
      const createResponse = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Event for Admin Delete',
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'event'
        });
      const adminDeleteEventId = createResponse.body._id || createResponse.body.id;

      const response = await request(app)
        .delete(`/api/events/${adminDeleteEventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Cleanup
      await User.deleteMany({ email: 'admin-delete-event@test.com' });
    });
  });
});

