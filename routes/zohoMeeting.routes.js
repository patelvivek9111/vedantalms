const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const zohoMeetingController = require('../controllers/zohoMeeting.controller');

const router = express.Router();

router.get('/status', protect, authorize('teacher', 'admin'), zohoMeetingController.getStatus);
router.get('/auth-url', protect, authorize('teacher', 'admin'), zohoMeetingController.getAuthUrl);
router.get('/callback', zohoMeetingController.handleCallback);
router.delete('/disconnect', protect, authorize('teacher', 'admin'), zohoMeetingController.disconnect);

module.exports = router;
