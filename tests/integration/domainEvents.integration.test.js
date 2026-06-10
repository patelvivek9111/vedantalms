const mongoose = require('mongoose');
const DomainEvent = require('../../models/domainEvent.model');
const { waitForMongoConnection } = require('../helpers');
const {
  recordDomainEvent,
  DOMAIN_EVENT_TYPES,
  AGGREGATE_TYPES,
  AUDIENCE_SCOPES,
} = require('../../services/domainEvents');
const { createNotification } = require('../../services/notification');
const Notification = require('../../models/notification.model');
const User = require('../../models/user.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('domain events integration', () => {
  const originalFlag = process.env.DOMAIN_EVENTS_ENABLED;
  let userId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    await DomainEvent.syncIndexes();
    await User.deleteMany({ email: 'domain-event-int@test.com' });
    await Notification.deleteMany({});
    await DomainEvent.collection.deleteMany({});

    const user = await User.create({
      firstName: 'Domain',
      lastName: 'Event',
      email: 'domain-event-int@test.com',
      password: 'password123',
      role: 'student',
    });
    userId = user._id;
  });

  afterAll(async () => {
    process.env.DOMAIN_EVENTS_ENABLED = originalFlag;
    await User.deleteMany({ email: 'domain-event-int@test.com' });
    await Notification.deleteMany({});
    await DomainEvent.collection.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await DomainEvent.collection.deleteMany({});
    await Notification.deleteMany({ user: userId });
  });

  it('does not persist events when DOMAIN_EVENTS_ENABLED is false', async () => {
    process.env.DOMAIN_EVENTS_ENABLED = 'false';

    const result = await recordDomainEvent({
      eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED,
      aggregateType: AGGREGATE_TYPES.ANNOUNCEMENT,
      aggregateId: new mongoose.Types.ObjectId(),
      actorId: userId,
      audienceScope: AUDIENCE_SCOPES.COURSE,
      payload: { courseId: 'c1' },
    });

    expect(result).toBeNull();
    expect(await DomainEvent.countDocuments()).toBe(0);
  });

  it('persists append-only events when DOMAIN_EVENTS_ENABLED is true', async () => {
    process.env.DOMAIN_EVENTS_ENABLED = 'true';
    const aggregateId = new mongoose.Types.ObjectId();

    const saved = await recordDomainEvent({
      eventType: DOMAIN_EVENT_TYPES.COURSE_ENROLLMENT_REQUESTED,
      aggregateType: AGGREGATE_TYPES.COURSE,
      aggregateId,
      actorId: userId,
      audienceScope: AUDIENCE_SCOPES.COURSE,
      correlationId: 'enroll-req-1',
      payload: { studentId: String(userId), waitlisted: false },
      metadata: { source: 'course.routes.enroll' },
    });

    expect(saved).toBeTruthy();
    expect(saved.eventType).toBe(DOMAIN_EVENT_TYPES.COURSE_ENROLLMENT_REQUESTED);
    expect(await DomainEvent.countDocuments()).toBe(1);

    await expect(
      DomainEvent.updateOne({ _id: saved._id }, { $set: { eventType: 'MUTATED' } })
    ).rejects.toThrow(/immutable/i);
  });

  it('does not block notification creation when domain events run in parallel', async () => {
    process.env.DOMAIN_EVENTS_ENABLED = 'true';
    const relatedId = new mongoose.Types.ObjectId();

    const [notification, domainEvent] = await Promise.all([
      createNotification(
        userId,
        {
          type: 'announcement',
          title: 'Test',
          message: 'Hello',
          relatedId,
          relatedType: 'announcement',
        },
        { source: 'announcement.created', actorId: userId }
      ),
      recordDomainEvent({
        eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED,
        aggregateType: AGGREGATE_TYPES.ANNOUNCEMENT,
        aggregateId: relatedId,
        actorId: userId,
        audienceScope: AUDIENCE_SCOPES.COURSE,
        payload: { courseId: 'course-1' },
      }),
    ]);

    expect(notification).toBeTruthy();
    expect(domainEvent).toBeTruthy();
    expect(await Notification.countDocuments({ user: userId })).toBe(1);
    expect(await DomainEvent.countDocuments()).toBe(1);
  });
});
