const mongoose = require('mongoose');

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
  grade: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  feedback: {
    type: String,
    default: null
  }
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
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  replies: [replySchema],
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
  }]
}, {
  timestamps: true
});

// Virtual for reply count
threadSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Update lastActivity when a reply is added
threadSchema.pre('save', function(next) {
  if (this.isModified('replies')) {
    this.lastActivity = new Date();
  }
  next();
});

const Thread = mongoose.model('Thread', threadSchema);

module.exports = Thread; 