const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Can be assigned later
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  published: {
    type: Boolean,
    default: false
  },
  defaultColor: {
    type: String,
    default: '#556B2F' // Default earthy color
  },
  semester: {
    term: {
      type: String,
      enum: ['Fall', 'Spring', 'Summer', 'Winter'],
      default: 'Fall'
    },
    year: {
      type: Number,
      default: new Date().getFullYear()
    }
  },
  gradeScale: [{
    letter: {
      type: String,
      required: true
    },
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    }
  }],
  groups: [{
    name: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  catalog: {
    subject: String,
    courseCode: String,
    maxStudents: Number,
    description: String,
    startDate: Date,
    endDate: Date,
    tags: [String]
  },
  enrollmentRequests: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  waitlist: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    position: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  publishedStateSnapshot: {
    modules: [{
      moduleId: mongoose.Schema.Types.ObjectId,
      published: Boolean
    }],
    pages: [{
      pageId: mongoose.Schema.Types.ObjectId,
      published: Boolean
    }],
    assignments: [{
      assignmentId: mongoose.Schema.Types.ObjectId,
      published: Boolean
    }],
    threads: [{
      threadId: mongoose.Schema.Types.ObjectId,
      published: Boolean
    }]
  },
  overviewConfig: {
    showLatestAnnouncements: {
      type: Boolean,
      default: true
    },
    numberOfAnnouncements: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    }
  },
  sidebarConfig: {
    items: [{
      id: String,
      label: String,
      visible: Boolean,
      order: Number
    }],
    studentVisibility: {
      overview: { type: Boolean, default: true },
      syllabus: { type: Boolean, default: true },
      modules: { type: Boolean, default: true },
      pages: { type: Boolean, default: true },
      assignments: { type: Boolean, default: true },
      quizzes: { type: Boolean, default: true },
      discussions: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      polls: { type: Boolean, default: true },
      groups: { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      grades: { type: Boolean, default: true },
      gradebook: { type: Boolean, default: true },
      students: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
courseSchema.index({ instructor: 1 });
courseSchema.index({ students: 1 });
courseSchema.index({ published: 1 });

module.exports = mongoose.model('Course', courseSchema);

