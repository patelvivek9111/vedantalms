const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/notification.model');
const NotificationPreferences = require('../models/notificationPreferences.model');

// Get all notifications for current user
router.get('/', protect, async (req, res) => {
  try {
    const { read, type, limit = 50, page = 1 } = req.query;
    const query = { user: req.user._id };
    
    // Validate type if provided
    if (type !== undefined) {
      if (!type || !type.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Type cannot be empty'
        });
      }
      query.type = type.trim();
    }
    
    if (read !== undefined) {
      query.read = read === 'true';
    }
    
    // Cap limit at 100
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unread count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user._id, 
      read: false 
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const notificationId = req.params.id;
    
    // Validate ObjectId
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid notification ID' 
      });
    }
    
    const notification = await Notification.findOne({
      _id: notificationId,
      user: req.user._id
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
    
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all notifications as read
router.patch('/read-all', protect, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    
    res.json({ 
      success: true,
      modifiedCount: result.modifiedCount,
      message: `Marked ${result.modifiedCount} notifications as read` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const notificationId = req.params.id;
    
    // Validate ObjectId
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid notification ID' 
      });
    }
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: req.user._id
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get notification preferences
router.get('/preferences', protect, async (req, res) => {
  try {
    let preferences = await NotificationPreferences.findOne({ user: req.user._id });
    
    if (!preferences) {
      // Create default preferences
      preferences = new NotificationPreferences({ user: req.user._id });
      await preferences.save();
    }
    
    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update notification preferences
router.put('/preferences', protect, async (req, res) => {
  try {
    let preferences = await NotificationPreferences.findOne({ user: req.user._id });
    
    if (!preferences) {
      preferences = new NotificationPreferences({ user: req.user._id });
    }
    
    // Update preferences from request body
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
      preferences.assignmentReminders = { ...preferences.assignmentReminders, ...req.body.assignmentReminders };
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

// Helper function to create notification (can be used by other routes)
async function createNotification(userId, notificationData) {
  try {
    // Check user preferences
    const preferences = await NotificationPreferences.findOne({ user: userId });
    
    if (!preferences) {
      // No preferences set, create notification by default
      const notification = new Notification({
        user: userId,
        ...notificationData
      });
      return await notification.save();
    }
    
    // Check if in-app notifications are enabled for this type
    const typeKey = notificationData.type === 'assignment_due' ? 'assignmentsDue' :
                    notificationData.type === 'assignment_graded' ? 'assignmentsGraded' :
                    notificationData.type;
    
    if (preferences.inApp && preferences.inApp[typeKey] !== false) {
      const notification = new Notification({
        user: userId,
        ...notificationData
      });
      return await notification.save();
    }
    
    return null;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

module.exports = { router, createNotification };

