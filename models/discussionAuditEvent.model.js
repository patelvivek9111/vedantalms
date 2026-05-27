const mongoose = require('mongoose');

const discussionAuditEventSchema = new mongoose.Schema(
  {
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: true,
      index: true,
    },
    replyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

discussionAuditEventSchema.index({ thread: 1, createdAt: -1 });
discussionAuditEventSchema.index({ actor: 1, createdAt: -1 });
discussionAuditEventSchema.index({ action: 1, createdAt: -1 });
discussionAuditEventSchema.index({ thread: 1, action: 1, createdAt: -1 });

module.exports =
  mongoose.models.DiscussionAuditEvent ||
  mongoose.model('DiscussionAuditEvent', discussionAuditEventSchema);
