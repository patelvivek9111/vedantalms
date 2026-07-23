const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');

const discussionReplySchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: true,
      index: true,
    },
    parentReplyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscussionReply',
      default: null,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    sanitizedContent: {
      type: String,
      required: true,
    },
    depth: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    path: {
      type: String,
      default: '',
      index: true,
    },
    fileAssets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FileAsset',
      },
    ],
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FileAsset',
      },
    ],
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    editHistory: [
      {
        editedAt: { type: Date, default: Date.now },
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        previousContent: { type: String },
        previousSanitizedContent: { type: String },
        previousFileAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' }],
        previousAttachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' }],
        reason: { type: String, default: null },
      },
    ],
    moderation: {
      hidden: { type: Boolean, default: false },
      hiddenAt: { type: Date, default: null },
      hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      note: { type: String, default: null },
      lastAction: { type: String, default: null },
      lastActionAt: { type: Date, default: null },
      lastActionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    moderationState: {
      type: String,
      enum: ['active', 'hidden', 'flagged', 'archived'],
      default: 'active',
      index: true,
    },
    hiddenByModerator: {
      type: Boolean,
      default: false,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedReason: {
      type: String,
      default: null,
    },
    moderatorNote: {
      type: String,
      default: null,
    },
    childCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    latestChildReplyAt: {
      type: Date,
      default: null,
      index: true,
    },
    likeCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    legacyReplyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

discussionReplySchema.index({ threadId: 1, parentReplyId: 1, createdAt: 1, _id: 1 });
discussionReplySchema.index({ threadId: 1, authorId: 1, deletedAt: 1 });
discussionReplySchema.index({ threadId: 1, path: 1 });
discussionReplySchema.index({ authorId: 1, createdAt: -1 });
discussionReplySchema.index({ threadId: 1, createdAt: -1 });
discussionReplySchema.index({ threadId: 1, deletedAt: 1 });
discussionReplySchema.index({ parentReplyId: 1, createdAt: 1 });
discussionReplySchema.index(
  { threadId: 1, authorId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

discussionReplySchema.plugin(courseChildTenantPlugin, {});

module.exports =
  mongoose.models.DiscussionReply || mongoose.model('DiscussionReply', discussionReplySchema);
