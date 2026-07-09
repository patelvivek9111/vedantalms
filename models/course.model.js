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
  teachingAssistants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
        id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
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
  operationalStatus: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'active',
  },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  restoredAt: { type: Date, default: null },
  copyOfCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
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
      fileAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' },
      versionGroupId: { type: String },
      order: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now },
    }],
  },
  semester: {
    term: { type: String, default: 'Fall' },
    year: { type: Number, default: new Date().getFullYear() }
  },
  /** Display label e.g. "2025–26" for year-long school courses. */
  academicYearLabel: { type: String, default: null, trim: true },
  /**
   * How the course is scheduled for grading/reporting.
   * single_term — one reporting period (~college semester or school one-term class)
   * full_year — year-long course; use grading periods (quarters/terms) inside the course
   * custom — no assumptions
   */
  scheduleType: {
    type: String,
    enum: ['single_term', 'full_year', 'custom'],
    default: 'single_term',
  },
  /** Canvas-style grading period display rules for students. */
  gradingPeriodSettings: {
    allowStudentAllPeriods: { type: Boolean, default: true },
    displayTotalsForAllPeriods: { type: Boolean, default: true },
  },
  /** Opaque token embedded in join QR / deep links; not the Mongo _id. */
  enrollmentQrToken: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
  },
  /** Human-readable 8-character join code (same enrollment as QR). */
  enrollmentJoinCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    unique: true,
    minlength: 8,
    maxlength: 8,
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
          { id: 'meetings', label: 'Meetings', visible: true, order: 10 },
          { id: 'attendance', label: 'Attendance', visible: true, order: 11 },
          { id: 'grades', label: 'Grades', visible: true, order: 12 },
          { id: 'gradebook', label: 'Gradebook', visible: true, order: 13 },
          { id: 'students', label: 'People', visible: true, order: 14 }
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
          quizwave: { type: Boolean, default: true },
          discussions: { type: Boolean, default: true },
          announcements: { type: Boolean, default: true },
          polls: { type: Boolean, default: true },
          groups: { type: Boolean, default: true },
          meetings: { type: Boolean, default: true },
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
          quizwave: true,
          discussions: true,
          announcements: true,
          polls: true,
          groups: true,
          meetings: true,
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
        { id: 'meetings', label: 'Meetings', visible: true, order: 10 },
        { id: 'attendance', label: 'Attendance', visible: true, order: 11 },
        { id: 'grades', label: 'Grades', visible: true, order: 12 },
        { id: 'gradebook', label: 'Gradebook', visible: true, order: 13 },
        { id: 'students', label: 'People', visible: true, order: 14 }
      ],
      studentVisibility: {
        overview: true,
        syllabus: true,
        modules: true,
        pages: true,
        assignments: true,
        quizzes: true,
        quizwave: true,
        discussions: true,
        announcements: true,
        polls: true,
        groups: true,
        meetings: true,
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

const crypto = require('crypto');

courseSchema.pre('save', async function assignEnrollmentQrToken(next) {
  if (this.enrollmentQrToken) return next();
  try {
    const CourseModel = this.constructor;
    for (let i = 0; i < 8; i++) {
      const token = crypto.randomBytes(18).toString('base64url');
      // eslint-disable-next-line no-await-in-loop
      const exists = await CourseModel.exists({
        enrollmentQrToken: token,
        _id: { $ne: this._id },
      });
      if (!exists) {
        this.set('enrollmentQrToken', token);
        break;
      }
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

courseSchema.index({ instructor: 1, updatedAt: -1 });
courseSchema.index({ operationalStatus: 1, published: 1 });
courseSchema.index({ instructor: 1, operationalStatus: 1 });
courseSchema.index({ students: 1 });
courseSchema.index({ students: 1, published: 1, updatedAt: -1 });
courseSchema.index({ 'catalog.isPublic': 1, 'catalog.startDate': 1, 'catalog.endDate': 1 });
courseSchema.index({ 'catalog.courseCode': 1 });

const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
courseSchema.plugin(portabilityMetadataPlugin);

module.exports = mongoose.model('Course', courseSchema); 