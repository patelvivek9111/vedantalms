const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');
const mongoose = require('mongoose');
const { getJson, setJson, delJson } = require('../utils/cache');

const INBOX_FOLDER_CACHE_KEYS = ['inbox', 'sent', 'archived', 'deleted', 'all'];

const invalidateInboxConversationListCaches = async (userIds) => {
  const ids = [...new Set((userIds || []).map((id) => (id && id.toString ? id.toString() : String(id))))];
  await Promise.all(
    ids.flatMap((idStr) => INBOX_FOLDER_CACHE_KEYS.map((folder) => delJson(`inbox:conversations:${idStr}:${folder}`)))
  );
};

// Helper function to validate ObjectId
const validateObjectId = (id, paramName = 'ID') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return { valid: false, error: `Invalid ${paramName}` };
  }
  return { valid: true };
};

// List all conversations for the current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const folder = req.query.folder;
    const cacheKey = `inbox:conversations:${userId}:${folder || 'all'}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const participantFilter = { userId };
    // Gmail-like behavior: conversation "views" (Inbox/Sent/Favorite) are derived
    // from metadata and can overlap. Only hard-filter deleted at query time.
    if (folder === 'deleted') {
      participantFilter.folder = 'deleted';
    }

    // Find all conversations where user is a participant
    const participants = await ConversationParticipant.find(participantFilter).lean();
    const conversationIds = participants.map(p => p.conversationId);
    if (conversationIds.length === 0) {
      return res.json([]);
    }

    // Get conversations and aggregate participant/message metadata in batches
    const conversations = await Conversation.find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 })
      .lean();

    const participantColl = ConversationParticipant.collection.collectionName;

    const [conversationParticipants, latestMessages, sentMessageConversationIds, receivedMessageConversationIds, unreadAgg] = await Promise.all([
      ConversationParticipant.find({ conversationId: { $in: conversationIds } })
        .populate('userId', 'firstName lastName email profilePicture')
        .lean(),
      Message.aggregate([
        { $match: { conversationId: { $in: conversationIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$conversationId', message: { $first: '$$ROOT' } } }
      ]),
      Message.distinct('conversationId', { conversationId: { $in: conversationIds }, senderId: userId }),
      Message.distinct('conversationId', { conversationId: { $in: conversationIds }, senderId: { $ne: userId } }),
      Message.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            senderId: { $ne: userId }
          }
        },
        {
          $lookup: {
            from: participantColl,
            let: { cid: '$conversationId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$conversationId', '$$cid'] },
                      { $eq: ['$userId', userId] }
                    ]
                  }
                }
              },
              { $project: { lastReadAt: 1, _id: 0 } }
            ],
            as: 'me'
          }
        },
        {
          $addFields: {
            lastReadAt: { $ifNull: [{ $arrayElemAt: ['$me.lastReadAt', 0] }, new Date(0)] }
          }
        },
        {
          $match: {
            $expr: { $gt: ['$createdAt', '$lastReadAt'] }
          }
        },
        {
          $group: {
            _id: '$conversationId',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const participantByConversation = conversationParticipants.reduce((acc, p) => {
      const key = String(p.conversationId);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(p);
      return acc;
    }, {});

    const lastMessageByConversation = new Map(
      latestMessages.map(item => [String(item._id), item.message])
    );
    const sentMessageConversationSet = new Set(
      sentMessageConversationIds.map(id => String(id))
    );
    const receivedMessageConversationSet = new Set(
      receivedMessageConversationIds.map(id => String(id))
    );

    const unreadByConversation = new Map(
      unreadAgg.map((item) => [String(item._id), item.count])
    );

    const results = conversations.map((conv) => {
      const key = String(conv._id);
      const convParticipants = participantByConversation[key] || [];
      return {
        _id: conv._id,
        subject: conv.subject,
        course: conv.course,
        createdBy: conv.createdBy,
        updatedAt: conv.updatedAt,
        participants: convParticipants.map(p => ({
          _id: p.userId?._id,
          firstName: p.userId?.firstName,
          lastName: p.userId?.lastName,
          email: p.userId?.email,
          profilePicture: p.userId?.profilePicture,
          folder: p.folder,
          starred: p.starred,
          lastReadAt: p.lastReadAt,
        })),
        lastMessage: lastMessageByConversation.get(key) || null,
        unreadCount: unreadByConversation.get(key) || 0,
        hasSentMessage: sentMessageConversationSet.has(key),
        hasReceivedMessage: receivedMessageConversationSet.has(key)
      };
    });

    await setJson(cacheKey, results, 90);
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

    // Validate required fields
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required' });
    }
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'At least one participant is required' });
    }

    // Validate participant IDs
    for (const pid of participantIds) {
      if (!pid || typeof pid !== 'string') {
        return res.status(400).json({ error: 'Invalid participant ID format' });
      }
      // Check if valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        return res.status(400).json({ error: 'Invalid participant ID' });
      }
      // Check if trying to send to self
      if (pid === userId.toString()) {
        return res.status(400).json({ error: 'Cannot send message to yourself' });
      }
    }

    // Validate course ID if provided
    if (course && !mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ error: 'Invalid course ID' });
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
      await invalidateInboxConversationListCaches([userId, ...participantIds]);
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
      await invalidateInboxConversationListCaches([userId, ...participantIds]);
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
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const cursor = req.query.cursor;
    const cacheKey = `inbox:messages:${req.user._id}:${conversationId}:${limit}:${cursor || 'start'}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const validation = validateObjectId(conversationId, 'conversation ID');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    // Check if user is a participant
    const participant = await ConversationParticipant.findOne({ conversationId, userId: req.user._id });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    const filter = { conversationId };
    if (cursor) {
      filter.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('senderId', 'firstName lastName email profilePicture')
      .lean();

    const hasMore = messages.length > limit;
    const pageItems = hasMore ? messages.slice(0, limit) : messages;
    const orderedItems = pageItems.reverse();
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.createdAt?.toISOString() : null;

    const payload = { data: orderedItems, nextCursor, hasMore };
    await setJson(cacheKey, payload, 20);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send a new message in a conversation
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const validation = validateObjectId(conversationId, 'conversation ID');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const { body, attachments } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required' });
    }
    
    // Validate attachments format
    if (attachments !== undefined && !Array.isArray(attachments)) {
      return res.status(400).json({ error: 'Attachments must be an array' });
    }
    
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
    // Update sender's lastReadAt only. Do not force folder to "sent":
    // Gmail-style behavior keeps a thread in Inbox unless explicitly archived/deleted.
    await ConversationParticipant.updateOne({ conversationId, userId }, { lastReadAt: new Date() });
    // Gmail-like behavior: a new incoming message should return the thread to Inbox
    // for all other participants (even if they had archived it).
    // Keep lastReadAt unchanged so unread count still reflects unread state.
    await ConversationParticipant.updateMany(
      { conversationId, userId: { $ne: userId } },
      { folder: 'inbox' }
    );
    
    // Notify other participants about new message
    try {
      const { createNotification } = require('../routes/notification.routes');
      const conversation = await Conversation.findById(conversationId);
      const otherParticipants = await ConversationParticipant.find({ 
        conversationId, 
        userId: { $ne: userId } 
      }).populate('userId', 'firstName lastName');
      
      const senderName = `${req.user.firstName} ${req.user.lastName}`;
      const messagePreview = body.length > 100 ? body.substring(0, 100) + '...' : body;
      
      await Promise.all(otherParticipants.map(participant => 
        createNotification(participant.userId._id, {
          type: 'message',
          title: 'New Message',
          message: `${senderName}: ${messagePreview}`,
          link: `/inbox?conversation=${conversationId}`,
          relatedId: message._id,
          relatedType: 'message',
          priority: 'high'
        }).catch(err => console.error(`Error notifying user ${participant.userId._id}:`, err))
      ));
    } catch (notifError) {
      console.error('Error creating message notifications:', notifError);
      // Don't fail the message if notification fails
    }

    const affectedUserIds = await ConversationParticipant.distinct('userId', { conversationId });
    await invalidateInboxConversationListCaches(affectedUserIds);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark conversation as read for the current user
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const validation = validateObjectId(conversationId, 'conversation ID');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const userId = req.user._id;
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    participant.lastReadAt = new Date();
    await participant.save();
    await invalidateInboxConversationListCaches([userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Move conversation to a folder for the current user
exports.moveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const validation = validateObjectId(conversationId, 'conversation ID');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const { folder } = req.body; // inbox, sent, archived, deleted
    const validFolders = ['inbox', 'sent', 'archived', 'deleted'];
    if (!folder || !validFolders.includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder. Must be one of: inbox, sent, archived, deleted' });
    }
    const userId = req.user._id;
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    participant.folder = folder;
    await participant.save();
    await invalidateInboxConversationListCaches([userId]);
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
    await invalidateInboxConversationListCaches([userId]);
    res.json({ starred: participant.starred });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Permanently delete a conversation for the current user
exports.deleteForever = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const validation = validateObjectId(conversationId, 'conversation ID');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const userId = req.user._id;
    const affectedUserIds = await ConversationParticipant.distinct('userId', { conversationId });
    // Remove the participant record for this user
    await ConversationParticipant.deleteOne({ conversationId, userId });
    // Optionally, clean up the conversation/messages if no participants remain
    const remaining = await ConversationParticipant.countDocuments({ conversationId });
    if (remaining === 0) {
      await Message.deleteMany({ conversationId });
      await Conversation.deleteOne({ _id: conversationId });
    }
    await invalidateInboxConversationListCaches(affectedUserIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 