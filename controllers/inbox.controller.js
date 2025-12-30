const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');
const User = require('../models/user.model');
const { asyncHandler } = require('../utils/errorHandler');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errorHandler');

// List all conversations for the current user
exports.getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
    
    // Find all conversations where user is a participant
    const participants = await ConversationParticipant.find({ userId });
    const conversationIds = participants.map(p => p.conversationId);
    
    if (conversationIds.length === 0) {
      return res.json([]);
    }
    
    // Get conversations and populate last message and participants
    const conversations = await Conversation.find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 });
    const results = await Promise.all(conversations.map(async (conv) => {
      const convParticipants = await ConversationParticipant.find({ conversationId: conv._id }).populate('userId', 'firstName lastName email profilePicture lastLogin');
      const lastMessage = await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 });
      const participant = participants.find(p => String(p.conversationId) === String(conv._id));
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        createdAt: { $gt: participant?.lastReadAt || new Date(0) },
        senderId: { $ne: userId }
      });
      // New: check if user has sent any message in this conversation
      const hasSentMessage = await Message.exists({ conversationId: conv._id, senderId: userId });
      
      // Fetch showOnlineStatus for each participant
      const participantsWithStatus = await Promise.all(convParticipants.map(async (p) => {
        let showOnlineStatus = true; // default
        if (p.userId?._id) {
          const user = await User.findById(p.userId._id).select('preferences.showOnlineStatus');
          showOnlineStatus = user?.preferences?.showOnlineStatus !== undefined ? user.preferences.showOnlineStatus : true;
        }
        return {
          _id: p.userId?._id,
          firstName: p.userId?.firstName,
          lastName: p.userId?.lastName,
          email: p.userId?.email,
          profilePicture: p.userId?.profilePicture,
          lastLogin: p.userId?.lastLogin,
          showOnlineStatus,
          folder: p.folder,
          starred: p.starred,
          lastReadAt: p.lastReadAt,
        };
      }));
      
      return {
        _id: conv._id,
        subject: conv.subject,
        course: conv.course,
        createdBy: conv.createdBy,
        updatedAt: conv.updatedAt,
        participants: participantsWithStatus,
        lastMessage,
        unreadCount,
        hasSentMessage: !!hasSentMessage // boolean
      };
    }));
    res.json(results);
});

// Start a new conversation
exports.createConversation = asyncHandler(async (req, res) => {
  const { subject, participantIds, body, sendIndividually, course } = req.body;
  const userId = req.user._id || req.user.id;
  
  // Validate inputs
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  if (!subject || !subject.trim()) {
    throw new ValidationError('Subject is required');
  }
  
  if (!body || !body.trim()) {
    throw new ValidationError('Message body is required');
  }
  
  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    throw new ValidationError('At least one participant is required');
  }
  
  // Validate all participant IDs
  for (const pid of participantIds) {
    if (!mongoose.Types.ObjectId.isValid(pid)) {
      throw new ValidationError(`Invalid participant ID: ${pid}`);
    }
    // Don't allow sending to self
    if (pid.toString() === userId.toString()) {
      throw new ValidationError('Cannot send message to yourself');
    }
  }
  
  // Validate course ID if provided
  if (course && !mongoose.Types.ObjectId.isValid(course)) {
    throw new ValidationError('Invalid course ID format');
  }
    
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
});

// Get all messages in a conversation
exports.getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError('Invalid conversation ID format');
  }
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  // Check if user is a participant
  const participant = await ConversationParticipant.findOne({ conversationId, userId });
  if (!participant) throw new ForbiddenError('Not a participant');
  
  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).populate('senderId', 'firstName lastName email profilePicture lastLogin');
  
  // Add showOnlineStatus to each message sender
  const messagesWithStatus = await Promise.all(messages.map(async (msg) => {
    let showOnlineStatus = true; // default
    if (msg.senderId?._id) {
      const user = await User.findById(msg.senderId._id).select('preferences.showOnlineStatus');
      showOnlineStatus = user?.preferences?.showOnlineStatus !== undefined ? user.preferences.showOnlineStatus : true;
    }
    const msgObj = msg.toObject();
    msgObj.senderId = {
      ...msgObj.senderId,
      showOnlineStatus
    };
    return msgObj;
  }));
  
  res.json(messagesWithStatus);
});

// Send a new message in a conversation
exports.sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { body, attachments } = req.body;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError('Invalid conversation ID format');
  }
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  // Validate body
  if (!body || !body.trim()) {
    throw new ValidationError('Message body is required');
  }
  
  // Check if user is a participant
  const participant = await ConversationParticipant.findOne({ conversationId, userId });
  if (!participant) throw new ForbiddenError('Not a participant');
  
  // Validate attachments if provided
  if (attachments && !Array.isArray(attachments)) {
    throw new ValidationError('Attachments must be an array');
  }
  
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
});

// Mark conversation as read for the current user
exports.markAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError('Invalid conversation ID format');
  }
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const participant = await ConversationParticipant.findOne({ conversationId, userId });
  if (!participant) throw new ForbiddenError('Not a participant');
  
  participant.lastReadAt = new Date();
  await participant.save();
  res.json({ success: true });
});

// Move conversation to a folder for the current user
exports.moveConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { folder } = req.body; // inbox, sent, archived
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError('Invalid conversation ID format');
  }
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  // Validate folder
  const validFolders = ['inbox', 'sent', 'archived'];
  if (!folder || !validFolders.includes(folder)) {
    throw new ValidationError(`Folder must be one of: ${validFolders.join(', ')}`);
  }
  
  const participant = await ConversationParticipant.findOne({ conversationId, userId });
  if (!participant) throw new ForbiddenError('Not a participant');
  
  participant.folder = folder;
  await participant.save();
  res.json({ success: true });
});

// Toggle star for the current user in a conversation
exports.toggleStar = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError('Invalid conversation ID format');
  }
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const participant = await ConversationParticipant.findOne({ conversationId, userId });
  if (!participant) throw new ForbiddenError('Not a participant');
  
  participant.starred = !participant.starred;
  await participant.save();
  res.json({ starred: participant.starred });
});

// Permanently delete a conversation for the current user
exports.deleteForever = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ValidationError('Invalid conversation ID format');
  }
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  // Remove the participant record for this user
  await ConversationParticipant.deleteOne({ conversationId, userId });
  
  // Optionally, clean up the conversation/messages if no participants remain
  const remaining = await ConversationParticipant.countDocuments({ conversationId });
  if (remaining === 0) {
    await Message.deleteMany({ conversationId });
    await Conversation.deleteOne({ _id: conversationId });
  }
  
  res.json({ success: true });
}); 