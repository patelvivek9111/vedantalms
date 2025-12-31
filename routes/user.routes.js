const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { searchUsers } = require('../controllers/user.controller');
const { updateMe, uploadProfilePicture, getPreferences, updatePreferences } = require('../controllers/user.controller');
const upload = require('../middleware/upload');

const router = express.Router();

// Search users by email
router.get('/search', protect, authorize('teacher', 'admin'), searchUsers);
// Update current user's profile
router.put('/me', protect, updateMe);
// Upload profile picture
router.post('/me/profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);
// Get current user's preferences
router.get('/me/preferences', protect, getPreferences);
// Update current user's preferences
router.put('/me/preferences', protect, updatePreferences);

module.exports = router; 