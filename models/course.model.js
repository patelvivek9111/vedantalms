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
    default: []
  },
  published: {
    type: Boolean,
    default: false
  },
  catalog: {
    isPublic: { type: Boolean, default: false },
    subject: { type: String, default: '' },
    description: { type: String, default: '' },
    prerequisites: [{ type: String }],
    allowTeacherEnrollment: { type: Boolean, default: false },
    maxStudents: { type: Number },
    enrollmentDeadline: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    tags: [{ type: String }],
    thumbnail: { type: String },
    syllabus: { type: String }
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
          { id: 'modules', label: 'Modules', visible: true, order: 1 },
          { id: 'pages', label: 'Pages', visible: true, order: 2 },
          { id: 'assignments', label: 'Assignments', visible: true, order: 3 },
          { id: 'discussions', label: 'Discussions', visible: true, order: 4 },
          { id: 'announcements', label: 'Announcements', visible: true, order: 5 },
          { id: 'polls', label: 'Polls', visible: true, order: 6 },
          { id: 'groups', label: 'Groups', visible: true, order: 7 },
          { id: 'attendance', label: 'Attendance', visible: true, order: 8 },
          { id: 'grades', label: 'Grades', visible: true, order: 9 },
          { id: 'gradebook', label: 'Gradebook', visible: true, order: 10 },
          { id: 'students', label: 'People', visible: true, order: 11 }
        ]
      },
      studentVisibility: {
        type: {
          overview: { type: Boolean, default: true },
          modules: { type: Boolean, default: true },
          pages: { type: Boolean, default: true },
          assignments: { type: Boolean, default: true },
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
          modules: true,
          pages: true,
          assignments: true,
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
        { id: 'modules', label: 'Modules', visible: true, order: 1 },
        { id: 'pages', label: 'Pages', visible: true, order: 2 },
        { id: 'assignments', label: 'Assignments', visible: true, order: 3 },
        { id: 'discussions', label: 'Discussions', visible: true, order: 4 },
        { id: 'announcements', label: 'Announcements', visible: true, order: 5 },
        { id: 'polls', label: 'Polls', visible: true, order: 6 },
        { id: 'groups', label: 'Groups', visible: true, order: 7 },
        { id: 'attendance', label: 'Attendance', visible: true, order: 8 },
        { id: 'grades', label: 'Grades', visible: true, order: 9 },
        { id: 'gradebook', label: 'Gradebook', visible: true, order: 10 },
        { id: 'students', label: 'People', visible: true, order: 11 }
      ],
      studentVisibility: {
        overview: true,
        modules: true,
        pages: true,
        assignments: true,
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

module.exports = mongoose.model('Course', courseSchema); 