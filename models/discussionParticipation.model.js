const mongoose = require('mongoose');

const discussionParticipationSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    firstReplyAt: { type: Date, default: null },
    lastReplyAt: { type: Date, default: null, index: true },
    replyCount: { type: Number, min: 0, default: 0 },
    rootReplyCount: { type: Number, min: 0, default: 0 },
    likeCount: { type: Number, min: 0, default: 0 },
    editedCount: { type: Number, min: 0, default: 0 },
    deletedCount: { type: Number, min: 0, default: 0 },
    hasPosted: { type: Boolean, default: false },
    hasInstructorReply: { type: Boolean, default: false },
    lastViewedAt: { type: Date, default: null },
    unreadCount: { type: Number, min: 0, default: 0 },
    lastReadReplyCreatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

discussionParticipationSchema.index({ threadId: 1, userId: 1 }, { unique: true });
discussionParticipationSchema.index({ userId: 1, updatedAt: -1 });
discussionParticipationSchema.index({ threadId: 1, lastReplyAt: -1 });
discussionParticipationSchema.index({ threadId: 1, updatedAt: -1 });
discussionParticipationSchema.index({ threadId: 1, unreadCount: 1 });
discussionParticipationSchema.index({ threadId: 1, hasPosted: 1, lastReplyAt: -1 });

module.exports =
  mongoose.models.DiscussionParticipation ||
  mongoose.model('DiscussionParticipation', discussionParticipationSchema);
