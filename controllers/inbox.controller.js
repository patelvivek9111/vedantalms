const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');
const mongoose = require('mongoose');
const { prepareMessageBody } = require('../services/messageSanitizer.service');
const {
  serializeMessageForClient,
  serializeMessagesPage,
  serializeConversationList,
} = require('../services/messageSerializer.service');
const inboxCache = require('../services/inboxCache.service');
const participantPolicy = require('../services/participantPolicy.service');
const messageAttachment = require('../services/messageAttachment.service');
const inboxUnread = require('../services/inboxUnread.service');
const messageAudit = require('../services/messageAudit.service');
const inboxAntiSpam = require('../services/inboxAntiSpam.service');
const messagingRealtime = require('../services/messagingRealtime.service');

async function respondWithError(res, err, req) {
  if (err.statusCode === 403 && req) {
    await messageAudit.recordAccessDenied(req, {
      conversationId: req.params?.conversationId,
      reason: err.message,
      code: err.code,
    });
  }
  if (err.statusCode === 429 && req) {
    await inboxAntiSpam.handleSpamViolation(req, err);
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }
  return res.status(500).json({ error: err.message });
}

// Helper function to validate ObjectId
const validateObjectId = (id, paramName = 'ID') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return { valid: false, error: `Invalid ${paramName}` };
  }
  return { valid: true };
};

async function buildMessageDocumentFields(req, { body, attachments, fileAssetIds, courseId }) {
  messageAttachment.assertAttachmentInputs({ attachments, fileAssetIds });
  const prepared = prepareMessageBody(body);
  const attachmentFields = await messageAttachment.resolveMessageAttachments({
    user: req.user,
    courseId: courseId || null,
    fileAssetIds,
    legacyAttachments: attachments,
  });
  return {
    ...prepared,
    ...attachmentFields,
  };
}

// List all conversations for the current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const folder = req.query.folder;
    const cacheKey = inboxCache.conversationListKey(userId, folder);
    const cached = await inboxCache.getJson(cacheKey);
    if (cached) {
      return res.json(serializeConversationList(cached));
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

    const baseQueries = [
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
    ];

    const [conversationParticipants, latestMessages, sentMessageConversationIds, receivedMessageConversationIds] =
      await Promise.all(baseQueries);

    const unreadByConversation = await inboxUnread.aggregateUnreadByConversation(
      conversationIds,
      userId
    );

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
          unreadCount: p.userId?._id?.toString() === userId.toString()
            ? Math.max(0, p.unreadCount || 0)
            : undefined,
        })),
        lastMessage: lastMessageByConversation.get(key) || null,
        unreadCount: unreadByConversation.get(key) || 0,
        hasSentMessage: sentMessageConversationSet.has(key),
        hasReceivedMessage: receivedMessageConversationSet.has(key)
      };
    });

    const serialized = serializeConversationList(results);
    await inboxCache.setJson(cacheKey, serialized, 90);
    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Start a new conversation
exports.createConversation = async (req, res) => {
  try {
    const { subject, participantIds, body, sendIndividually, course, attachments, fileAssetIds } = req.body;
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

    await participantPolicy.assertCanAddParticipants({
      sender: req.user,
      participantIds,
      courseId: course || null,
      sendIndividually: Boolean(sendIndividually),
      req,
    });

    const messageFields = await buildMessageDocumentFields(req, {
      body,
      attachments,
      fileAssetIds,
      courseId: course || null,
    });

    const composeBatchSize = sendIndividually ? participantIds.length : 1;
    await inboxAntiSpam.assertCanCreateConversations(userId, { batchSize: composeBatchSize });

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
          ...messageFields,
        });
        await inboxUnread.recordMessageSent({
          conversationId: conversation._id,
          senderId: userId,
          messageId: message._id,
        });
        if (!inboxUnread.isDenormUnreadEnabled()) {
          await ConversationParticipant.updateMany(
            { conversationId: conversation._id, userId: { $ne: userId } },
            { folder: 'inbox' }
          );
        }
        await inboxCache.invalidateAfterMessageChange(conversation._id, [userId, recipientId]);
        await messageAudit.recordConversationCreated(req, {
          conversationId: conversation._id,
          courseId: course,
          recipientCount: 1,
          sendIndividually: true,
        });
        await messageAudit.recordMessageSent(req, {
          conversationId: conversation._id,
          messageId: message._id,
          attachmentCount: (messageFields.fileAssetIds || []).length,
        });
        await messagingRealtime.notifyMessageNew({
          conversationId: conversation._id,
          messageId: message._id,
          senderId: userId,
          participantUserIds: [userId, recipientId],
        });
        return {
          conversation,
          message: serializeMessageForClient(message),
        };
      }));
      await inboxCache.invalidateConversationLists([userId, ...participantIds]);
      res.status(201).json({
        results: results.map((r) => ({
          conversation: r.conversation,
          message: r.message,
        })),
      });
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
        ...messageFields,
      });
      await inboxUnread.recordMessageSent({
        conversationId: conversation._id,
        senderId: userId,
        messageId: message._id,
      });
      if (!inboxUnread.isDenormUnreadEnabled()) {
        await ConversationParticipant.updateMany(
          { conversationId: conversation._id, userId: { $ne: userId } },
          { folder: 'inbox' }
        );
      }
      await inboxCache.invalidateAfterMessageChange(conversation._id, allParticipantIds);
      await messageAudit.recordConversationCreated(req, {
        conversationId: conversation._id,
        courseId: course,
        recipientCount: participantIds.length,
        sendIndividually: false,
      });
      await messageAudit.recordMessageSent(req, {
        conversationId: conversation._id,
        messageId: message._id,
        attachmentCount: (messageFields.fileAssetIds || []).length,
      });
      await messagingRealtime.notifyMessageNew({
        conversationId: conversation._id,
        messageId: message._id,
        senderId: userId,
        participantUserIds: allParticipantIds,
      });
      res.status(201).json({
        conversation,
        message: serializeMessageForClient(message),
      });
    }
  } catch (err) {
    return respondWithError(res, err, req);
  }
};

// Global inbox unread badge total
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = inboxCache.unreadTotalKey(userId);
    const cached = await inboxCache.getJson(cacheKey);
    if (cached && typeof cached.count === 'number') {
      return res.json({ success: true, count: cached.count });
    }
    const count = await inboxUnread.getInboxUnreadTotal(userId);
    await inboxCache.setJson(cacheKey, { count }, 30);
    res.json({ success: true, count });
  } catch (err) {
    return respondWithError(res, err, req);
  }
};

// Get all messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const cursor = req.query.cursor;
    const cacheKey = await inboxCache.buildMessageCacheKey(
      req.user._id,
      conversationId,
      limit,
      cursor
    );
    const cached = await inboxCache.getJson(cacheKey);
    if (cached) {
      return res.json(serializeMessagesPage(cached));
    }
    const validation = validateObjectId(conversationId, 'conversation ID');
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    // Check if user is a participant
    const participant = await ConversationParticipant.findOne({ conversationId, userId: req.user._id });
    if (!participant) {
      await messageAudit.recordAccessDenied(req, {
        conversationId,
        reason: 'Not a participant',
        code: 'NOT_PARTICIPANT',
      });
      return res.status(403).json({ error: 'Not a participant' });
    }

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

    const payload = serializeMessagesPage({
      data: orderedItems,
      nextCursor,
      hasMore,
    });
    await inboxCache.setJson(cacheKey, payload, 20);
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
    const { body, attachments, fileAssetIds } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    const userId = req.user._id;
    // Check if user is a participant
    const participant = await ConversationParticipant.findOne({ conversationId, userId });
    if (!participant) {
      await messageAudit.recordAccessDenied(req, {
        conversationId,
        reason: 'Not a participant',
        code: 'NOT_PARTICIPANT',
      });
      return res.status(403).json({ error: 'Not a participant' });
    }

    const conversation = await Conversation.findById(conversationId).select('course').lean();
    await participantPolicy.assertSenderMayParticipateInConversation({
      sender: req.user,
      conversation,
      req,
    });

    const messageFields = await buildMessageDocumentFields(req, {
      body,
      attachments,
      fileAssetIds,
      courseId: conversation?.course || null,
    });

    await inboxAntiSpam.assertCanSendMessage(userId, {
      conversationId,
      bodyText: messageFields.bodyText,
    });

    let message;
    if (inboxUnread.isDenormUnreadEnabled()) {
      message = await Message.create({
        conversationId,
        senderId: userId,
        ...messageFields,
      });
      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
      await inboxUnread.recordMessageSent({
        conversationId,
        senderId: userId,
        messageId: message._id,
      });
    } else {
      message = await Message.create({
        conversationId,
        senderId: userId,
        ...messageFields,
      });
      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
      await ConversationParticipant.updateOne({ conversationId, userId }, { lastReadAt: new Date() });
      await ConversationParticipant.updateMany(
        { conversationId, userId: { $ne: userId } },
        { folder: 'inbox' }
      );
    }

    const affectedUserIds = await ConversationParticipant.distinct('userId', { conversationId });

    // Notify other participants about new message
    try {
      const { createNotification } = require('../services/notification');
      const otherParticipants = await ConversationParticipant.find({
        conversationId,
        userId: { $ne: userId }
      }).populate('userId', 'firstName lastName');

      const senderName = `${req.user.firstName} ${req.user.lastName}`;
      const messagePreview = messageFields.bodyText.length > 100
        ? `${messageFields.bodyText.substring(0, 100)}...`
        : messageFields.bodyText;

      await Promise.all(otherParticipants.map(p =>
        createNotification(p.userId._id, {
          type: 'message',
          title: 'New Message',
          message: `${senderName}: ${messagePreview}`,
          link: `/inbox?conversation=${conversationId}`,
          relatedId: message._id,
          relatedType: 'message',
          priority: 'high'
        }, {
          source: 'inbox.message',
          actorId: userId,
          eventWindow: String(message._id),
          requestId: req.requestId || null,
        }).catch(err => console.error(`Error notifying user ${p.userId._id}:`, err))
      ));
    } catch (notifError) {
      console.error('Error creating message notifications:', notifError);
      // Don't fail the message if notification fails
    }

    await inboxCache.invalidateAfterMessageChange(conversationId, affectedUserIds);

    await messageAudit.recordMessageSent(req, {
      conversationId,
      messageId: message._id,
      attachmentCount: (messageFields.fileAssetIds || []).length,
    });

    await messagingRealtime.notifyMessageNew({
      conversationId,
      messageId: message._id,
      senderId: userId,
      participantUserIds: affectedUserIds,
    });

    try {
      const {
        recordDomainEvent,
        DOMAIN_EVENT_TYPES,
        AGGREGATE_TYPES,
        AUDIENCE_SCOPES,
      } = require('../services/domainEvents');
      void recordDomainEvent({
        eventType: DOMAIN_EVENT_TYPES.INBOX_MESSAGE_SENT,
        aggregateType: AGGREGATE_TYPES.MESSAGE,
        aggregateId: message._id,
        actorId: userId,
        audienceScope: AUDIENCE_SCOPES.USER,
        correlationId: req.requestId,
        payload: {
          conversationId: String(conversationId),
          recipientCount: Math.max(0, (affectedUserIds?.length || 1) - 1),
        },
        metadata: { source: 'inbox.controller.sendMessage' },
      });
    } catch (domainEventError) {
      console.error('inbox_domain_event_failed', domainEventError);
    }

    res.status(201).json(serializeMessageForClient(message));
  } catch (err) {
    return respondWithError(res, err, req);
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
    if (!participant) {
      await messageAudit.recordAccessDenied(req, {
        conversationId,
        reason: 'Not a participant',
        code: 'NOT_PARTICIPANT',
      });
      return res.status(403).json({ error: 'Not a participant' });
    }

    if (inboxUnread.isDenormUnreadEnabled()) {
      await inboxUnread.markConversationRead({ conversationId, userId });
    } else {
      participant.lastReadAt = new Date();
      await participant.save();
    }

    await messageAudit.recordConversationRead(req, { conversationId });

    const readParticipantIds = await ConversationParticipant.distinct('userId', { conversationId });
    await messagingRealtime.notifyConversationRead({
      conversationId,
      userId,
      participantUserIds: readParticipantIds,
    });

    await inboxCache.invalidateConversationLists([userId]);
    await inboxCache.invalidateMessageCaches(conversationId, [userId]);
    await inboxCache.invalidateUnreadTotals([userId]);
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
    await inboxCache.invalidateConversationLists([userId]);
    await inboxCache.invalidateUnreadTotals([userId]);
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
    await inboxCache.invalidateConversationLists([userId]);
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
    await inboxCache.invalidateConversationLists(affectedUserIds);
    await inboxCache.invalidateMessageCaches(conversationId, affectedUserIds);
    await inboxCache.invalidateUnreadTotals(affectedUserIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
