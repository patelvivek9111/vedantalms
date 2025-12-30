const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const Notification = require('../models/notification.model');
const NotificationPreferences = require('../models/notificationPreferences.model');
const logger = require('../utils/logger');

// Get all notifications for current user
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const { read, type, limit = 50, page = 1 } = req.query;
    const query = { user: userId };
    
    if (read !== undefined) {
      query.read = read === 'true';
    }
    
    if (type !== undefined) {
      // Validate type is a non-empty string
      if (typeof type !== 'string' || type.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid notification type' 
        });
      }
      query.type = type.trim();
    }
    
    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Max 100, min 1
    
    const skip = (pageNum - 1) * limitNum;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: userId, read: false });
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: limitNum > 0 ? Math.ceil(total / limitNum) : 0
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
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const count = await Notification.countDocuments({ 
      user: userId, 
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
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const notification = await Notification.findOne({
      _id: id,
      user: userId
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
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const result = await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    
    const modifiedCount = result && typeof result.modifiedCount === 'number' 
      ? result.modifiedCount 
      : 0;
    
    res.json({ 
      success: true, 
      message: `Marked ${modifiedCount} notifications as read`,
      modifiedCount: modifiedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID format' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: userId
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
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    let preferences = await NotificationPreferences.findOne({ user: userId });
    
    if (!preferences) {
      // Create default preferences
      preferences = new NotificationPreferences({ user: userId });
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
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    let preferences = await NotificationPreferences.findOne({ user: userId });
    
    if (!preferences) {
      preferences = new NotificationPreferences({ user: userId });
    }
    
    // Update preferences from request body
    if (req.body.email && typeof req.body.email === 'object' && !Array.isArray(req.body.email)) {
      preferences.email = { ...(preferences.email || {}), ...req.body.email };
    }
    if (req.body.inApp && typeof req.body.inApp === 'object' && !Array.isArray(req.body.inApp)) {
      preferences.inApp = { ...(preferences.inApp || {}), ...req.body.inApp };
    }
    if (req.body.push && typeof req.body.push === 'object' && !Array.isArray(req.body.push)) {
      preferences.push = { ...(preferences.push || {}), ...req.body.push };
    }
    if (req.body.quietHours && typeof req.body.quietHours === 'object' && !Array.isArray(req.body.quietHours)) {
      preferences.quietHours = { ...(preferences.quietHours || {}), ...req.body.quietHours };
    }
    if (req.body.assignmentReminders && typeof req.body.assignmentReminders === 'object' && !Array.isArray(req.body.assignmentReminders)) {
      preferences.assignmentReminders = { ...(preferences.assignmentReminders || {}), ...req.body.assignmentReminders };
    }
    if (req.body.pushSubscription !== undefined) {
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
    // Validate inputs
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn('Invalid userId provided to createNotification', { userId });
      return null;
    }
    
    if (!notificationData || !notificationData.type || !notificationData.title || !notificationData.message) {
      logger.warn('Invalid notificationData provided to createNotification', { notificationData });
      return null;
    }
    
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
    logger.logError(error, { action: 'createNotification', userId });
    return null;
  }
}

module.exports = { router, createNotification };

