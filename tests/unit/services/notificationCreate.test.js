const mongoose = require('mongoose');

const mockSave = jest.fn().mockResolvedValue({ _id: 'notif1', title: 'T' });
const mockFindOne = jest.fn().mockResolvedValue(null);
const mockFindById = jest.fn().mockResolvedValue({ _id: 'existing1', title: 'Existing' });

jest.mock('../../../models/notification.model', () => {
  const ctor = jest.fn().mockImplementation((doc) => ({
    ...doc,
    save: mockSave,
  }));
  ctor.findOne = (...args) => mockFindOne(...args);
  ctor.findById = (...args) => mockFindById(...args);
  return ctor;
});

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

jest.mock('../../../models/user.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../services/notification/notificationPreferences', () => ({
  getPreferencesForUser: jest.fn(),
  isInAppNotificationEnabled: jest.fn(),
  mapNotificationTypeToPreferenceKey: jest.requireActual(
    '../../../services/notification/notificationPreferences'
  ).mapNotificationTypeToPreferenceKey,
}));

const mockResolveDedupeKey = jest.fn();
const mockFindExistingNotification = jest.fn();
const mockIsNotificationDedupeEnabled = jest.fn();

jest.mock('../../../services/notification/notificationDedupe.service', () => ({
  isNotificationDedupeEnabled: (...args) => mockIsNotificationDedupeEnabled(...args),
  resolveDedupeKey: (...args) => mockResolveDedupeKey(...args),
  findExistingNotification: (...args) => mockFindExistingNotification(...args),
  recordDedupeMetric: jest.fn(),
  isDuplicateKeyError: jest.fn(() => false),
  buildDedupeKey: jest.requireActual('../../../services/notification/notificationDedupe.service')
    .buildDedupeKey,
}));

const Notification = require('../../../models/notification.model');
const User = require('../../../models/user.model');
const preferences = require('../../../services/notification/notificationPreferences');
const { normalizeNotificationPayload } = require('../../../services/notification/notificationPayload');
const { createNotification } = require('../../../services/notification/notificationCreate.service');

describe('notificationPayload', () => {
  it('moves unsupported fields into metadata', () => {
    const courseId = new mongoose.Types.ObjectId();
    const assignmentId = new mongoose.Types.ObjectId();
    const normalized = normalizeNotificationPayload({
      type: 'grade',
      title: 'Graded',
      message: 'You were graded',
      course: courseId,
      assignment: assignmentId,
      eventKey: 'grades_finalized',
    });

    expect(normalized.type).toBe('grade');
    expect(normalized.course).toBeUndefined();
    expect(normalized.assignment).toBeUndefined();
    expect(normalized.metadata.get('courseId')).toBe(String(courseId));
    expect(normalized.metadata.get('assignmentId')).toBe(String(assignmentId));
    expect(normalized.metadata.get('eventKey')).toBe('grades_finalized');
  });
});

describe('notificationCreate.service', () => {
  const userId = new mongoose.Types.ObjectId();
  const originalDedupeFlag = process.env.NOTIFICATION_DEDUPE_ENABLED;
  const originalRetentionFlag = process.env.NOTIFICATION_RETENTION_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NOTIFICATION_RETENTION_ENABLED;
    mockIsNotificationDedupeEnabled.mockReturnValue(false);
    mockResolveDedupeKey.mockReturnValue(null);
    mockFindExistingNotification.mockResolvedValue(null);
    mockFindOne.mockResolvedValue(null);
    mockSave.mockResolvedValue({ _id: 'notif1', title: 'T' });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: userId, email: 'a@test.com' }),
    });
    preferences.getPreferencesForUser.mockResolvedValue(null);
    preferences.isInAppNotificationEnabled.mockReturnValue(true);
  });

  afterAll(() => {
    process.env.NOTIFICATION_DEDUPE_ENABLED = originalDedupeFlag;
    if (originalRetentionFlag === undefined) {
      delete process.env.NOTIFICATION_RETENTION_ENABLED;
    } else {
      process.env.NOTIFICATION_RETENTION_ENABLED = originalRetentionFlag;
    }
  });

  it('creates notification when preferences allow', async () => {
    const result = await createNotification(userId, {
      type: 'message',
      title: 'New Message',
      message: 'Hello',
    });

    expect(result).toBeTruthy();
    expect(Notification).toHaveBeenCalled();
  });

  it('returns null when in-app preference is disabled', async () => {
    preferences.isInAppNotificationEnabled.mockReturnValue(false);

    const result = await createNotification(userId, {
      type: 'message',
      title: 'New Message',
      message: 'Hello',
    });

    expect(result).toBeNull();
    expect(Notification).not.toHaveBeenCalled();
  });

  it('returns null for invalid user id', async () => {
    const result = await createNotification('not-an-object-id', {
      type: 'message',
      title: 'x',
      message: 'y',
    });
    expect(result).toBeNull();
  });

  it('returns existing notification on dedupe hit when flag enabled', async () => {
    mockIsNotificationDedupeEnabled.mockReturnValue(true);
    mockResolveDedupeKey.mockReturnValue('announcement.created:actor:announcement:rel:default');
    mockFindExistingNotification.mockResolvedValue({ _id: 'existing1' });

    const result = await createNotification(
      userId,
      {
        type: 'announcement',
        title: 'New Announcement',
        message: 'Hello',
        relatedId: new mongoose.Types.ObjectId(),
        relatedType: 'announcement',
      },
      {
        source: 'announcement.created',
        actorId: new mongoose.Types.ObjectId(),
      }
    );

    expect(result).toEqual(expect.objectContaining({ _id: 'existing1' }));
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockFindById).toHaveBeenCalledWith('existing1');
  });

  it('inserts with dedupeKey when flag enabled and no duplicate exists', async () => {
    mockIsNotificationDedupeEnabled.mockReturnValue(true);
    mockResolveDedupeKey.mockReturnValue('announcement.created:actor:announcement:rel:default');

    await createNotification(
      userId,
      {
        type: 'announcement',
        title: 'New Announcement',
        message: 'Hello',
        relatedId: new mongoose.Types.ObjectId(),
        relatedType: 'announcement',
      },
      { source: 'announcement.created', actorId: new mongoose.Types.ObjectId() }
    );

    expect(Notification).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'announcement.created:actor:announcement:rel:default',
      })
    );
    expect(mockSave).toHaveBeenCalled();
  });

  it('ignores dedupe when flag is disabled', async () => {
    mockIsNotificationDedupeEnabled.mockReturnValue(false);

    await createNotification(
      userId,
      {
        type: 'announcement',
        title: 'New Announcement',
        message: 'Hello',
        relatedId: new mongoose.Types.ObjectId(),
        relatedType: 'announcement',
      },
      { source: 'announcement.created', actorId: new mongoose.Types.ObjectId() }
    );

    expect(mockFindExistingNotification).not.toHaveBeenCalled();
    expect(Notification).toHaveBeenCalledWith(
      expect.not.objectContaining({ dedupeKey: expect.any(String) })
    );
  });

  it('returns null when user does not exist', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });

    const result = await createNotification(userId, {
      type: 'message',
      title: 'x',
      message: 'y',
    });
    expect(result).toBeNull();
  });

  it('applies default expiresAt for ephemeral types when retention flag enabled', async () => {
    process.env.NOTIFICATION_RETENTION_ENABLED = 'true';
    const before = Date.now();

    await createNotification(userId, {
      type: 'message',
      title: 'New Message',
      message: 'Hello',
    });

    expect(Notification).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: expect.any(Date),
      })
    );
    const call = Notification.mock.calls[0][0];
    expect(call.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 89 * 24 * 60 * 60 * 1000
    );
  });

  it('does not override explicit expiresAt', async () => {
    process.env.NOTIFICATION_RETENTION_ENABLED = 'true';
    const explicit = new Date('2030-06-01T00:00:00.000Z');

    await createNotification(userId, {
      type: 'message',
      title: 'New Message',
      message: 'Hello',
      expiresAt: explicit,
    });

    expect(Notification).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: explicit })
    );
  });
});
