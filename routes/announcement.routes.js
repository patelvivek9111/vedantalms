const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Comments (threaded)
router.get('/:id/comments', protect, announcementController.getAnnouncementComments);
router.post('/:id/comments', protect, announcementController.addAnnouncementComment);
router.post('/:id/comments/:commentId/reply', protect, announcementController.replyToAnnouncementComment);
router.post('/:id/comments/:commentId/like', protect, announcementController.likeAnnouncementComment);
router.post('/:id/comments/:commentId/unlike', protect, announcementController.unlikeAnnouncementComment);

// Update and delete announcement
router.put('/:id', protect, authorize('teacher', 'admin'), upload.array('attachments'), announcementController.updateAnnouncement);
router.delete('/:id', protect, announcementController.deleteAnnouncement);

module.exports = router; 