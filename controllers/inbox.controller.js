const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');

// List all conversations for the current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    // Find all conversations where user is a participant
    const participants = await ConversationParticipant.find({ userId });
    const conversationIds = participants.map(p => p.conversationId);
    // Get conversations and populate last message and participants
    const conversations = await Conversation.find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 });
    const results = await Promise.all(conversations.map(async (conv) => {
      const convParticipants = await ConversationParticipant.find({ conversationId: conv._id }).populate('userId', 'firstName lastName email profilePicture');
      const lastMessage = await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 });
      const participant = participants.find(p => String(p.conversationId) === String(conv._id));
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        createdAt: { $gt: participant.lastReadAt || new Date(0) },
        senderId: { $ne: userId }
      });
      // New: check if user has sent any message in this conversation
      const hasSentMessage = await Message.exists({ conversationId: conv._id, senderId: userId });
      return {
        _id: conv._id,
        subject: conv.subject,
        course: conv.course,
        createdBy: conv.createdBy,
        updatedAt: conv.updatedAt,
        participants: convParticipants.map(p => ({
          _id: p.userId._id,
          firstName: p.userId.firstName,
          lastName: p.userId.lastName,
          email: p.userId.email,
          profilePicture: p.userId.profilePicture,
          folder: p.folder,
          starred: p.starred,
          lastReadAt: p.lastReadAt,
        })),
        lastMessage,
        unreadCount,
        hasSentMessage: !!hasSentMessage // boolean
      };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Start a new conversation
exports.createConversation = async (req, res) => {
  try {
    const { subject, participantIds, body, sendIndividually, course } = req.body;
    const userId = req.user._id;
    if (sendIndividually) {
      // Create a separate conversation for each recipient
      const results = await Promise.all(participantIds.map(async (recipientId) => {
        // Create conversation
        const conversation = await Conversation.create({ subject, course, createdBy: userId });
        // Add participants (sender and recipient)
        await Promise.all([
          ConversationParticipant.create({
            conversationId: conversation._id,
            userId: userId,
            lastReadAt: new Date(),
            folder: 'sent',
          }),
          ConversationParticipant.create({
            conversationId: conversation._id,
            userId: recipientId,
            lastReadAt: null,
            folder: 'inbox',
          })
        ]);
        // Create initial message
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: userId,
          body,
          attachments: []
        });
        return { conversation, message };
      }));
      res.status(201).json({ results });
    } else {
      // Create conversation
      const conversation = await Conversation.create({ subject, course, createdBy: userId });
      // Add participants (including sender)
      const allParticipantIds = Array.from(new Set([...participantIds, userId.toString()]));
      await Promise.all(allParticipantIds.map(pid =>
        ConversationParticipant.create({
          conversationId: conversation._id,
          userId: pid,
          lastReadAt: pid === userId.toString() ? new Date() : null,
          folder: pid === userId.toString() ? 'sent' : 'inbox'
        })
      ));
      // Create initial message
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: userId,
        body,
        attachments: []
      });
      res.status(201).json({ conversation, message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    // Check if user is a participant
    const participant = await ConversationParticipant.findOne({ conversationId, userId: req.user._id });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).populate('senderId', 'firstName lastName email profilePicture');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send a new message in a conversation
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { body, attachments } = req.body;
    const userId = req.user._id;
    // Check if user is a participant
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    // Create message
    const message = await Message.create({
      conversationId,
      senderId: userId,
      body,
      attachments: attachments || []
    });
    // Update conversation updatedAt
    await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
    // Update sender's lastReadAt
    await ConversationParticipant.updateOne({ conversationId, userId }, { lastReadAt: new Date(), folder: 'sent' });
    // Mark as unread for other participants (do not update their lastReadAt)
    await ConversationParticipant.updateMany({ conversationId, userId: { $ne: userId }, folder: { $ne: 'archived' } }, { folder: 'inbox' });
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark conversation as read for the current user
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    participant.lastReadAt = new Date();
    await participant.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Move conversation to a folder for the current user
exports.moveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { folder } = req.body; // inbox, sent, archived
    const userId = req.user._id;
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    participant.folder = folder;
    await participant.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle star for the current user in a conversation
exports.toggleStar = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    participant.starred = !participant.starred;
    await participant.save();
    res.json({ starred: participant.starred });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Permanently delete a conversation for the current user
exports.deleteForever = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    // Remove the participant record for this user
    await ConversationParticipant.deleteOne({ conversationId, userId });
    // Optionally, clean up the conversation/messages if no participants remain
    const remaining = await ConversationParticipant.countDocuments({ conversationId });
    if (remaining === 0) {
      await Message.deleteMany({ conversationId });
      await Conversation.deleteOne({ _id: conversationId });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 