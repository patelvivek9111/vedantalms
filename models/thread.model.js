const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');

const replySchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentReply: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reply',
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    previousContent: { type: String },
    reason: { type: String, default: null }
  }],
  grade: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  feedback: {
    type: String,
    default: null
  },
  fileAssets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileAsset',
  }],
  // Like/reaction system
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const threadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: false
  },
  groupSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupSet',
    required: false
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileAssets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileAsset',
  }],
  replies: [replySchema],
  counters: {
    replyCount: { type: Number, min: 0, default: 0 },
    participantCount: { type: Number, min: 0, default: 0 },
    unreadCount: { type: Number, min: 0, default: 0 },
    likeCount: { type: Number, min: 0, default: 0 },
    unresolvedModerationCount: { type: Number, min: 0, default: 0 }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  // New fields for grading
  isGraded: {
    type: Boolean,
    default: false
  },
  totalPoints: {
    type: Number,
    min: 0,
    default: 100
  },
  group: {
    type: String,
    default: 'Discussions'
  },
  published: {
    type: Boolean,
    default: true
  },
  availableFrom: {
    type: Date,
    default: null
  },
  locked: {
    type: Boolean,
    default: false
  },
  lockAfterDue: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  discussionReleaseMode: {
    type: String,
    enum: ['immediate', 'manual', 'hidden'],
    default: 'immediate'
  },
  gradesReleasedAt: {
    type: Date,
    default: null
  },
  gradeHidden: {
    type: Boolean,
    default: false
  },
  gradingPeriodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseGradingPeriod',
    default: null,
  },
  dueDate: {
    type: Date,
    default: null
  },
  studentGrades: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    grade: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    excused: {
      type: Boolean,
      default: false
    },
    feedback: {
      type: String,
      default: null
    },
    gradedAt: {
      type: Date,
      default: null
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }],
  // Discussion settings
  settings: {
    requirePostBeforeSee: {
      type: Boolean,
      default: false
    },
    allowLikes: {
      type: Boolean,
      default: true
    },
    allowComments: {
      type: Boolean,
      default: true
    }
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  editHistory: [{
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    previousTitle: { type: String },
    previousContent: { type: String },
    reason: { type: String, default: null }
  }],
  moderation: {
    state: {
      type: String,
      enum: ['active', 'hidden', 'flagged', 'archived'],
      default: 'active'
    },
    lastAction: { type: String, default: null },
    lastActionAt: { type: Date, default: null },
    lastActionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: null }
  },
  moderationState: {
    type: String,
    enum: ['active', 'hidden', 'flagged', 'archived'],
    default: 'active'
  },
  lastReplyIdempotencyKeys: [{
    key: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    replyId: { type: mongoose.Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

threadSchema.index({ course: 1, isGraded: 1, published: 1, dueDate: 1 });
threadSchema.index({ module: 1, published: 1, lastActivity: -1 });
threadSchema.index({ module: 1, deletedAt: 1, lastActivity: -1 });
threadSchema.index({ course: 1, lastActivity: -1 });
threadSchema.index({ groupSet: 1, groupId: 1, published: 1, lastActivity: -1 });
threadSchema.index({ course: 1, deletedAt: 1, lastActivity: -1 });
threadSchema.index({ course: 1, moderationState: 1, lastActivity: -1 });
threadSchema.index({ groupSet: 1, published: 1, lastActivity: -1 });

// Virtual for reply count
threadSchema.virtual('replyCount').get(function() {
  return this.counters?.replyCount ?? this.replies.length;
});

function clampThreadCounters(doc) {
  if (!doc?.counters) return;
  for (const key of [
    'replyCount',
    'participantCount',
    'unreadCount',
    'likeCount',
    'unresolvedModerationCount',
  ]) {
    if (typeof doc.counters[key] === 'number' && doc.counters[key] < 0) {
      doc.counters[key] = 0;
    }
  }
}

threadSchema.pre('validate', function(next) {
  clampThreadCounters(this);
  next();
});

// Update lastActivity when a reply is added.
threadSchema.pre('save', function(next) {
  if (this.isModified('replies')) {
    this.lastActivity = new Date();
  }
  clampThreadCounters(this);
  next();
});

const Thread = mongoose.model('Thread', threadSchema);

threadSchema.plugin(courseChildTenantPlugin, { coursePath: 'course' });

module.exports = Thread; 