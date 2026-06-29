const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getSystemStats,
  getRecentActivity,
  getAnalytics,
  getAllUsers,
  updateUser,
  deleteUser,
  updateUserStatus,
  getAllCourses,
  getSecurityStats,
  getSecurityEvents,
  getSystemSettings,
  updateSystemSettings,
  testEmailConfig
} = require('../controllers/admin.controller');

// All admin routes require authentication and admin role
router.get('/stats', protect, authorize('admin'), getSystemStats);
router.get('/activity', protect, authorize('admin'), getRecentActivity);
router.get('/analytics', protect, authorize('admin'), getAnalytics);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.put('/users/:id', protect, authorize('admin'), updateUser);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);
router.patch('/users/:id/status', protect, authorize('admin'), updateUserStatus);
router.get('/courses', protect, authorize('admin'), getAllCourses);
router.get('/security/stats', protect, authorize('admin'), getSecurityStats);
router.get('/security/events', protect, authorize('admin'), getSecurityEvents);
router.get('/settings', protect, authorize('admin'), getSystemSettings);
router.put('/settings', protect, authorize('admin'), updateSystemSettings);
router.post('/settings/test-email', protect, authorize('admin'), testEmailConfig);

module.exports = router;

