const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: function() {
      return !this.isGroupAssignment;
    }
  },
  availableFrom: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  lockAfterDue: {
    type: Boolean,
    default: true
  },
  attachments: [{
    type: String // Legacy URL paths — prefer fileAssets
  }],
  fileAssets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileAsset',
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [
    {
      id: String,
      type: { type: String, enum: ['text', 'multiple-choice', 'matching'], required: true },
      text: String,
      points: Number,
      options: [
        {
          text: String,
          isCorrect: Boolean
        }
      ],
      // For matching questions
      leftItems: [
        {
          id: String,
          text: String
        }
      ],
      rightItems: [
        {
          id: String,
          text: String,
          isCorrect: Boolean // for possible future use
        }
      ]
    }
  ],
  published: {
    type: Boolean,
    default: false
  },
  isGroupAssignment: {
    type: Boolean,
    default: false
  },
  groupSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupSet',
    required: function() {
      return this.isGroupAssignment;
    }
  },
  group: {
    type: String,
    required: false
  },
  groupId: {
    type: String,
    required: false
  },
  isGradedQuiz: {
    type: Boolean,
    default: false
  },
  quizSubmissionMode: {
    type: String,
    enum: ['online', 'paper_upload'],
    default: 'online'
  },
  isTimedQuiz: {
    type: Boolean,
    default: false
  },
  quizTimeLimit: {
    type: Number,
    min: 1,
    max: 480,
    required: function() {
      return this.isTimedQuiz;
    }
  },
  allowStudentUploads: {
    type: Boolean,
    default: false
  },
  displayMode: {
    type: String,
    enum: ['single', 'scrollable'],
    default: 'single'
  },
  showCorrectAnswers: {
    type: Boolean,
    default: false
  },
  showStudentAnswers: {
    type: Boolean,
    default: false
  },
  gradeReleaseMode: {
    type: String,
    enum: ['immediate', 'manual', 'on_grade'],
    default: 'immediate'
  },
  defaultGradeHidden: {
    type: Boolean,
    default: false
  },
  isOfflineAssignment: {
    type: Boolean,
    default: false
  },
  totalPoints: {
    type: Number,
    min: 0,
    default: 0
  }
}, {
  timestamps: true
});

assignmentSchema.index({ module: 1, published: 1, dueDate: 1 });
assignmentSchema.index({ isGroupAssignment: 1, groupSet: 1, dueDate: 1 });

const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
assignmentSchema.plugin(portabilityMetadataPlugin);

module.exports = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema); 