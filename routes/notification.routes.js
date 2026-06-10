const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/auth');
const NotificationPreferences = require('../models/notificationPreferences.model');
const { createNotification } = require('../services/notification');
const {
  listNotificationsForUser,
  getUnreadCountForUser,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
  deleteNotificationForUser,
} = require('../services/notification/notificationRead.service');

router.get('/', protect, async (req, res) => {
  try {
    const { read, type, limit = 50, page = 1 } = req.query;

    if (type !== undefined) {
      if (!type || !String(type).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Type cannot be empty',
        });
      }
    }

    const readFilter =
      read !== undefined ? read === 'true' || read === true : undefined;
    const typeFilter = type !== undefined ? String(type).trim() : undefined;

    const result = await listNotificationsForUser(req.user._id, {
      read: readFilter,
      type: typeFilter,
      limit,
      page,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await getUnreadCountForUser(req.user._id);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const notification = await markNotificationReadForUser(
      req.user._id,
      notificationId
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    const result = await markAllNotificationsReadForUser(req.user._id);

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      message: `Marked ${result.modifiedCount} notifications as read`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const notification = await deleteNotificationForUser(req.user._id, notificationId);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/preferences', protect, async (req, res) => {
  try {
    let preferences = await NotificationPreferences.findOne({ user: req.user._id });

    if (!preferences) {
      preferences = new NotificationPreferences({ user: req.user._id });
      await preferences.save();
    }

    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/preferences', protect, async (req, res) => {
  try {
    let preferences = await NotificationPreferences.findOne({ user: req.user._id });

    if (!preferences) {
      preferences = new NotificationPreferences({ user: req.user._id });
    }

    if (req.body.email) {
      preferences.email = { ...preferences.email, ...req.body.email };
    }
    if (req.body.inApp) {
      preferences.inApp = { ...preferences.inApp, ...req.body.inApp };
    }
    if (req.body.push) {
      preferences.push = { ...preferences.push, ...req.body.push };
    }
    if (req.body.quietHours) {
      preferences.quietHours = { ...preferences.quietHours, ...req.body.quietHours };
    }
    if (req.body.assignmentReminders) {
      preferences.assignmentReminders = {
        ...preferences.assignmentReminders,
        ...req.body.assignmentReminders,
      };
    }
    if (req.body.pushSubscription) {
      preferences.pushSubscription = req.body.pushSubscription;
    }

    await preferences.save();

    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Disabled in production unless ENABLE_NOTIFICATION_TEST_CREATE=true */
function allowNotificationTestCreate(req, res, next) {
  const enabled = process.env.ENABLE_NOTIFICATION_TEST_CREATE === 'true';
  if (process.env.NODE_ENV === 'production' && !enabled) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  return next();
}

router.post('/test-create', protect, allowNotificationTestCreate, async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    const testUserId = userId || req.user._id;

    const notification = await createNotification(
      testUserId,
      {
        type: 'assignment_graded',
        title: title || 'Test Notification',
        message: message || 'This is a test notification',
        link: null,
        relatedId: null,
        relatedType: 'assignment',
        priority: 'high',
      },
      { source: 'notifications.test-create', requestId: req.requestId || null }
    );

    if (notification) {
      res.json({
        success: true,
        message: 'Test notification created',
        notification: {
          _id: notification._id,
          title: notification.title,
          user: notification.user,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Notification not created (check preferences)',
      });
    }
  } catch (error) {
    console.error('❌ TEST: Error creating test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test notification',
      error: error.message,
    });
  }
});

module.exports = { router };
