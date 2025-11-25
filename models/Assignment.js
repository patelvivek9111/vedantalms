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
  attachments: [{
    type: String // URLs to files
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
  isGradedQuiz: {
    type: Boolean,
    default: false
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

// Add validation to ensure dueDate is after availableFrom
assignmentSchema.pre('validate', function(next) {
  if (this.availableFrom && this.dueDate) {
    if (new Date(this.dueDate) <= new Date(this.availableFrom)) {
      this.invalidate('dueDate', 'Due date must be after available from date');
    }
  }
  next();
});

module.exports = mongoose.model('Assignment', assignmentSchema); 