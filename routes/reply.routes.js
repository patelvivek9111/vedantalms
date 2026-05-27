const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Thread = require('../models/thread.model');
const discussionAccess = require('../services/discussionAccess.service');
const discussionReplyService = require('../services/discussionReply.service');
const discussionObservability = require('../services/discussionObservability.service');
const DiscussionAuditEvent = require('../models/discussionAuditEvent.model');

function sendRouteError(res, error, fallback = 'Reply request failed') {
  const status = error.statusCode || 500;
  if (status >= 500) {
    console.error(fallback, error);
  }
  return res.status(status).json({
    success: false,
    message: error.message || fallback,
    code: error.code,
  });
}

async function recordReplyModeration({ req, thread, replyId, action, after = {} }) {
  await DiscussionAuditEvent.create({
    thread: thread._id,
    replyId,
    actor: req.user._id,
    action,
    after,
    metadata: { source: 'reply.routes' },
    ip: req.ip,
  }).catch(() => {});
}

router.get('/:replyId/children', protect, async (req, res) => {
  const startedAt = Date.now();
  try {
    const reply = await discussionReplyService.getReplyById(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    const thread = await Thread.findById(reply.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });

    if (
      req.user.role === 'student' &&
      thread.settings?.requirePostBeforeSee &&
      !(await discussionReplyService.hasReplyByUser(thread, req.user._id))
    ) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: Number(req.query.limit) || 50, total: 0, totalPages: 1, nextCursor: null },
        repliesHiddenUntilPost: true,
      });
    }

    const page = await discussionReplyService.listChildReplies(req.params.replyId, {
      page: req.query.page,
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    discussionObservability.replyPageTiming({
      parentReplyId: String(req.params.replyId),
      threadId: String(thread._id),
      userId: req.user?._id ? String(req.user._id) : null,
      count: page.replies.length,
      source: page.source,
      durationMs: Date.now() - startedAt,
    });
    res.json({
      success: true,
      data: page.replies,
      pagination: page.pagination,
      source: page.source,
    });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching child replies');
  }
});

router.post('/:replyId/hide', protect, async (req, res) => {
  try {
    const reply = await discussionReplyService.getReplyById(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }
    const thread = await Thread.findById(reply.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    const updated = await discussionReplyService.hideReply({
      replyId: req.params.replyId,
      user: req.user,
      note: req.body?.note || null,
    });
    await recordReplyModeration({
      req,
      thread,
      replyId: req.params.replyId,
      action: 'reply_hidden',
      after: { note: req.body?.note || null },
    });
    discussionObservability.moderationAction({
      action: 'reply_hidden',
      threadId: String(thread._id),
      replyId: String(req.params.replyId),
      actorId: String(req.user._id),
    });
    res.json({ success: true, data: discussionReplyService.toLegacyReply(updated) });
  } catch (error) {
    sendRouteError(res, error, 'Error hiding reply');
  }
});

router.post('/:replyId/restore', protect, async (req, res) => {
  try {
    const reply = await discussionReplyService.getReplyById(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }
    const thread = await Thread.findById(reply.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    const updated = await discussionReplyService.restoreReply({
      replyId: req.params.replyId,
      user: req.user,
      note: req.body?.note || null,
    });
    await recordReplyModeration({
      req,
      thread,
      replyId: req.params.replyId,
      action: 'reply_restored',
      after: { note: req.body?.note || null },
    });
    discussionObservability.moderationAction({
      action: 'reply_restored',
      threadId: String(thread._id),
      replyId: String(req.params.replyId),
      actorId: String(req.user._id),
    });
    res.json({ success: true, data: discussionReplyService.toLegacyReply(updated) });
  } catch (error) {
    sendRouteError(res, error, 'Error restoring reply');
  }
});

module.exports = router;
