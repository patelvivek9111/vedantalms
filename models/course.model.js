const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Course instructor is required']
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  gradeScale: {
    type: [
      {
        letter: { type: String, required: true },
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      }
    ],
    default: [
      { letter: 'A', min: 94, max: 100 },
      { letter: 'A-', min: 90, max: 94 },
      { letter: 'B+', min: 87, max: 90 },
      { letter: 'B', min: 84, max: 87 },
      { letter: 'B-', min: 80, max: 84 },
      { letter: 'C+', min: 77, max: 80 },
      { letter: 'C', min: 74, max: 77 },
      { letter: 'D', min: 64, max: 74 },
      { letter: 'F', min: 0, max: 64 }
    ]
  },
  groups: {
    type: [
      {
        name: { type: String, required: true },
        weight: { type: Number, required: true }
      }
    ],
    default: [
      { name: 'Projects', weight: 15 },
      { name: 'Homework', weight: 15 },
      { name: 'Exams', weight: 20 },
      { name: 'Quizzes', weight: 30 },
      { name: 'Participation', weight: 20 }
    ]
  },
  published: {
    type: Boolean,
    default: false
  },
  publishedStateSnapshot: {
    type: {
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
    default: null
  },
  catalog: {
    isPublic: { type: Boolean, default: false },
    subject: { type: String, default: '' },
    description: { type: String, default: '' },
    prerequisites: [{ type: String }],
    allowTeacherEnrollment: { type: Boolean, default: false },
    maxStudents: { type: Number },
    creditHours: { type: Number, default: 3 },
    enrollmentDeadline: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    tags: [{ type: String }],
    thumbnail: { type: String },
    syllabus: { type: String },
    courseCode: { type: String, default: '' },
    officeHours: { type: String, default: 'By Appointment' },
    syllabusContent: { type: String, default: '' },
    syllabusFiles: [{ 
      name: { type: String },
      url: { type: String },
      size: { type: Number },
      uploadedAt: { type: Date, default: Date.now }
    }]
  },
  semester: {
    term: { type: String, enum: ['Fall', 'Spring', 'Summer', 'Winter'], default: 'Fall' },
    year: { type: Number, default: new Date().getFullYear(), min: 2000, max: 2100 }
  },
  enrollmentRequests: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'denied', 'waitlisted'],
      default: 'pending'
    },
    requestDate: { type: Date, default: Date.now },
    responseDate: { type: Date },
    teacherNotes: { type: String },
    studentNotes: { type: String }
  }],
  waitlist: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    position: { type: Number, required: true },
    addedDate: { type: Date, default: Date.now },
    notes: { type: String }
  }],
  overviewConfig: {
    type: {
      showLatestAnnouncements: { type: Boolean, default: false },
      numberOfAnnouncements: { type: Number, default: 3, min: 1, max: 10 }
    },
    default: {
      showLatestAnnouncements: false,
      numberOfAnnouncements: 3
    }
  },
  defaultColor: {
    type: String,
    default: '#556B2F' // Default olive green
  },
  sidebarConfig: {
    type: {
      items: {
        type: [
          {
            id: { type: String, required: true },
            label: { type: String, required: true },
            visible: { type: Boolean, default: true },
            order: { type: Number, required: true }
          }
        ],
        default: [
          { id: 'overview', label: 'Overview', visible: true, order: 0 },
          { id: 'syllabus', label: 'Syllabus', visible: true, order: 1 },
          { id: 'modules', label: 'Modules', visible: true, order: 2 },
          { id: 'pages', label: 'Pages', visible: true, order: 3 },
          { id: 'assignments', label: 'Assignments', visible: true, order: 4 },
          { id: 'quizzes', label: 'Quizzes', visible: true, order: 5 },
          { id: 'discussions', label: 'Discussions', visible: true, order: 6 },
          { id: 'announcements', label: 'Announcements', visible: true, order: 7 },
          { id: 'polls', label: 'Polls', visible: true, order: 8 },
          { id: 'groups', label: 'Groups', visible: true, order: 9 },
          { id: 'attendance', label: 'Attendance', visible: true, order: 10 },
          { id: 'grades', label: 'Grades', visible: true, order: 11 },
          { id: 'gradebook', label: 'Gradebook', visible: true, order: 12 },
          { id: 'students', label: 'People', visible: true, order: 13 }
        ]
      },
      studentVisibility: {
        type: {
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
          gradebook: { type: Boolean, default: false },
          students: { type: Boolean, default: true }
        },
        default: {
          overview: true,
          syllabus: true,
          modules: true,
          pages: true,
          assignments: true,
          quizzes: true,
          discussions: true,
          announcements: true,
          polls: true,
          groups: true,
          attendance: true,
          grades: true,
          gradebook: false,
          students: true
        }
      }
    },
    default: {
      items: [
        { id: 'overview', label: 'Overview', visible: true, order: 0 },
        { id: 'syllabus', label: 'Syllabus', visible: true, order: 1 },
        { id: 'modules', label: 'Modules', visible: true, order: 2 },
        { id: 'pages', label: 'Pages', visible: true, order: 3 },
        { id: 'assignments', label: 'Assignments', visible: true, order: 4 },
        { id: 'quizzes', label: 'Quizzes', visible: true, order: 5 },
        { id: 'discussions', label: 'Discussions', visible: true, order: 6 },
        { id: 'announcements', label: 'Announcements', visible: true, order: 7 },
        { id: 'polls', label: 'Polls', visible: true, order: 8 },
        { id: 'groups', label: 'Groups', visible: true, order: 9 },
        { id: 'attendance', label: 'Attendance', visible: true, order: 10 },
        { id: 'grades', label: 'Grades', visible: true, order: 11 },
        { id: 'gradebook', label: 'Gradebook', visible: true, order: 12 },
        { id: 'students', label: 'People', visible: true, order: 13 }
      ],
      studentVisibility: {
        overview: true,
        syllabus: true,
        modules: true,
        pages: true,
        assignments: true,
        quizzes: true,
        discussions: true,
        announcements: true,
        polls: true,
        groups: true,
        attendance: true,
        grades: true,
        gradebook: false,
        students: true
      }
    }
  }
}, {
  timestamps: true // This will add createdAt and updatedAt fields
});

// Add validation to ensure endDate is after startDate and enrollmentDeadline is before startDate
courseSchema.pre('validate', function(next) {
  if (this.catalog) {
    // Validate endDate is after startDate
    if (this.catalog.startDate && this.catalog.endDate) {
      if (new Date(this.catalog.endDate) <= new Date(this.catalog.startDate)) {
        this.invalidate('catalog.endDate', 'End date must be after start date');
      }
    }
    
    // Validate enrollmentDeadline is before startDate (if both exist)
    if (this.catalog.enrollmentDeadline && this.catalog.startDate) {
      if (new Date(this.catalog.enrollmentDeadline) >= new Date(this.catalog.startDate)) {
        this.invalidate('catalog.enrollmentDeadline', 'Enrollment deadline must be before start date');
      }
    }
    
    // Validate maxStudents is positive if provided
    if (this.catalog.maxStudents !== undefined && this.catalog.maxStudents !== null) {
      if (this.catalog.maxStudents < 1) {
        this.invalidate('catalog.maxStudents', 'Maximum students must be at least 1');
      }
    }
    
    // Validate creditHours is positive
    if (this.catalog.creditHours !== undefined && this.catalog.creditHours !== null) {
      if (this.catalog.creditHours < 0) {
        this.invalidate('catalog.creditHours', 'Credit hours must be non-negative');
      }
    }
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema); 