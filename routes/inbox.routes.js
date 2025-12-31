const express = require('express');
const router = express.Router();
const inboxController = require('../controllers/inbox.controller');
const { protect } = require('../middleware/auth');

// List all conversations for the current user
router.get('/conversations', protect, inboxController.getConversations);

// Start a new conversation
router.post('/conversations', protect, inboxController.createConversation);

// Get all messages in a conversation
router.get('/conversations/:conversationId/messages', protect, inboxController.getMessages);

// Send a new message in a conversation
router.post('/conversations/:conversationId/messages', protect, inboxController.sendMessage);

// Mark conversation as read for the current user
router.post('/conversations/:conversationId/read', protect, inboxController.markAsRead);

// Move conversation to a folder for the current user
router.post('/conversations/:conversationId/move', protect, inboxController.moveConversation);

// Toggle star for the current user in a conversation
router.post('/conversations/:conversationId/star', protect, inboxController.toggleStar);

// Permanently delete a conversation for the current user
router.delete('/conversations/:conversationId/forever', protect, inboxController.deleteForever);

module.exports = router; 