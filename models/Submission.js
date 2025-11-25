const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: Map,
    of: String,
    default: {}
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  grade: {
    type: Number,
    min: 0,
    // Note: This field stores points earned, not percentage
  },
  feedback: {
    type: String
  },
  questionGrades: {
    type: Map,
    of: Number,
    default: {}
  },
  // Auto-grading fields
  autoGraded: {
    type: Boolean,
    default: false
  },
  autoGrade: {
    type: Number,
    min: 0,
    // Note: This field stores points earned, not percentage
  },
  autoQuestionGrades: {
    type: Map,
    of: Number,
    default: {}
  },
  teacherApproved: {
    type: Boolean,
    default: false
  },
  finalGrade: {
    type: Number,
    min: 0,
    // Note: This field stores points earned, not percentage
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  },
  submissionText: {
    type: String
  },
  files: [{
    type: mongoose.Schema.Types.Mixed // Can be String (URL) or Object {url, name, originalname}
  }],
  teacherFeedbackFiles: [{
    type: mongoose.Schema.Types.Mixed // Can be String (URL) or Object {url, name, originalname}
  }],
  memberGrades: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    grade: {
      type: Number,
      min: 0,
      max: 100
    },
    feedback: {
      type: String
    },
    gradedAt: {
      type: Date,
      default: Date.now
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  useIndividualGrades: {
    type: Boolean,
    default: false
  },
  showCorrectAnswers: {
    type: Boolean,
    default: false
  },
  showStudentAnswers: {
    type: Boolean,
    default: false
  },
  isManualGrade: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound index to ensure one submission per student per assignment for individual assignments
// Note: For individual submissions, group should be null/undefined
submissionSchema.index(
  { assignment: 1, student: 1 },
  { 
    unique: true,
    partialFilterExpression: {
      $or: [
        { group: { $exists: false } },
        { group: null }
      ]
    },
    name: 'assignment_student_unique_individual'
  }
);

// Add a compound index for group submissions
// Note: For group submissions, group must exist and not be null
submissionSchema.index(
  { assignment: 1, group: 1 },
  { 
    unique: true,
    partialFilterExpression: {
      group: { $exists: true, $ne: null }
    },
    name: 'assignment_group_unique'
  }
);

module.exports = mongoose.model('Submission', submissionSchema); 