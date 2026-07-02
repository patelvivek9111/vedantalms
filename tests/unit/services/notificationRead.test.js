const mongoose = require('mongoose');

const mockAggregate = jest.fn();
const mockCountDocuments = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindOneAndDelete = jest.fn();
const mockFind = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock('../../../models/notification.model', () => ({
  aggregate: (...args) => mockAggregate(...args),
  countDocuments: (...args) => mockCountDocuments(...args),
  findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
  updateMany: (...args) => mockUpdateMany(...args),
  findOneAndDelete: (...args) => mockFindOneAndDelete(...args),
  find: (...args) => mockFind(...args),
  deleteMany: (...args) => mockDeleteMany(...args),
}));

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const mockNotifyInvalidated = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../services/notification/notificationRealtime.service', () => ({
  notifyNotificationInvalidated: (...args) => mockNotifyInvalidated(...args),
}));

const observability = require('../../../services/workflowObservability.service');
const {
  serializeNotification,
  listNotificationsForUser,
  getUnreadCountForUser,
  markNotificationReadForUser,
} = require('../../../services/notification/notificationRead.service');

describe('notificationRead.service', () => {
  const userId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(3);
    mockFind.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([]),
      }),
    });
    mockDeleteMany.mockResolvedValue({ deletedCount: 0 });
  });

  describe('serializeNotification', () => {
    it('strips dedupeKey and converts metadata Map', () => {
      const metadata = new Map([['courseId', 'abc']]);
      const out = serializeNotification({
        _id: '1',
        title: 'T',
        dedupeKey: 'secret-key',
        metadata,
      });

      expect(out.dedupeKey).toBeUndefined();
      expect(out.metadata).toEqual({ courseId: 'abc' });
    });
  });

  describe('listNotificationsForUser', () => {
    it('uses facet aggregation and parallel unread count', async () => {
      mockAggregate.mockResolvedValue([
        {
          data: [
            {
              _id: new mongoose.Types.ObjectId(),
              title: 'Hello',
              dedupeKey: 'should-not-appear',
              read: false,
            },
          ],
          filteredTotal: [{ count: 1 }],
        },
      ]);

      const result = await listNotificationsForUser(userId, { limit: 10, page: 1 });

      expect(mockAggregate).toHaveBeenCalledTimes(1);
      expect(mockCountDocuments).toHaveBeenCalledWith({ user: userId, read: false });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].dedupeKey).toBeUndefined();
      expect(result.pagination.total).toBe(1);
      expect(result.unreadCount).toBe(3);
      expect(observability.metric).toHaveBeenCalledWith(
        'notification_read_completed',
        expect.objectContaining({ endpoint: 'list', queryCount: 2 })
      );
    });
  });

  describe('getUnreadCountForUser', () => {
    it('returns unread count', async () => {
      mockCountDocuments.mockResolvedValue(5);
      const count = await getUnreadCountForUser(userId);
      expect(count).toBe(5);
    });
  });

  describe('markNotificationReadForUser', () => {
    it('returns serialized notification when found', async () => {
      const notifId = new mongoose.Types.ObjectId();
      mockFindOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: notifId,
          read: true,
          dedupeKey: 'hidden',
        }),
      });

      const result = await markNotificationReadForUser(userId, notifId);
      expect(result.read).toBe(true);
      expect(result.dedupeKey).toBeUndefined();
      expect(mockNotifyInvalidated).toHaveBeenCalledWith(
        expect.objectContaining({ userId, reason: 'read', notificationId: notifId })
      );
    });

    it('returns null when not found', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await markNotificationReadForUser(
        userId,
        new mongoose.Types.ObjectId()
      );
      expect(result).toBeNull();
    });
  });
});
