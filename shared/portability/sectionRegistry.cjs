const { SCHEMA_VERSION } = require('./schemaMetadata.cjs');
const { leanExportDocs } = require('./exportUtils.cjs');

/**
 * Canonical section order for deterministic institution exports (Phase R1).
 * Partial export preserves this ordering among selected sections.
 */
const SECTION_ORDER = [
  'systemSettings',
  'users',
  'courses',
  'enrollments',
  'modules',
  'pages',
  'assignments',
  'submissions',
  'quizzes',
  'discussions',
  'announcements',
  'polls',
  'groups',
  'groupSets',
  'meetings',
  'attendance',
  'institutionPolicies',
  'coursePolicies',
  'gradeSnapshots',
  'transcriptSnapshots',
  'lifecycleRecords',
  'amendments',
  'policyAudits',
  'systemAudit',
  'asyncJobs',
  'notifications',
  'notificationPreferences',
  'calendarEvents',
  'uploadsMetadata',
  'permissionsRoles',
];

const DEFAULT_CHUNK_SIZE = 500;

function modelExporter(modelPath, query = {}, select = '-__v', sectionName) {
  return async function exportSection() {
    const Model = require(modelPath);
    const docs = await Model.find(query).select(select).lean();
    return leanExportDocs(docs, sectionName);
  };
}

function cursorExporter(modelPath, query = {}, select = '-__v', sectionName) {
  return async function* exportCursor(batchSize = DEFAULT_CHUNK_SIZE) {
    const Model = require(modelPath);
    const cursor = Model.find(query).select(select).sort({ _id: 1 }).cursor({ batchSize });
    let batch = [];
    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= batchSize) {
        yield leanExportDocs(batch, sectionName);
        batch = [];
      }
    }
    if (batch.length) yield leanExportDocs(batch, sectionName);
  };
}

/** Section metadata: schemaVersion, chunkable, export fn or cursor. */
const SECTION_DEFINITIONS = {
  systemSettings: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: false,
    export: async () => {
      const SystemSettings = require('../../models/systemSettings.model');
      const doc = await SystemSettings.findOne().select('-__v').lean();
      return leanExportDocs(doc ? [doc] : [], 'systemSettings');
    },
  },
  users: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/user.model', {}, '-__v -password', 'users'),
  },
  courses: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/course.model', {}, '-__v -enrollmentQrToken -enrollmentJoinCode', 'courses'),
  },
  enrollments: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: false,
    export: async () => {
      const Course = require('../../models/course.model');
      const courses = await Course.find({})
        .select('title students instructor semester')
        .sort({ _id: 1 })
        .lean();
      return courses.map((c) => ({
        courseId: String(c._id),
        title: c.title,
        instructor: c.instructor ? String(c.instructor) : null,
        studentIds: (c.students || []).map(String),
        semester: c.semester,
      }));
    },
  },
  modules: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/module.model', {}, '-__v', 'modules'),
  },
  pages: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/page.model', {}, '-__v', 'pages'),
  },
  assignments: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/Assignment', {}, '-__v', 'assignments'),
  },
  submissions: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/Submission', {}, '-__v', 'submissions'),
  },
  quizzes: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    export: async () => {
      const { QuizWave, QuizSession, QuizResponse } = require('../../models/quizwave.model');
      const [quizzes, sessions, responses] = await Promise.all([
        QuizWave.find({}).select('-__v').sort({ _id: 1 }).lean(),
        QuizSession.find({}).select('-__v').sort({ _id: 1 }).lean(),
        QuizResponse.find({}).select('-__v').sort({ _id: 1 }).lean(),
      ]);
      return {
        quizzes: leanExportDocs(quizzes, 'quizzes'),
        sessions: leanExportDocs(sessions, 'quizzes'),
        responses: leanExportDocs(responses, 'quizzes'),
      };
    },
  },
  discussions: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/thread.model', {}, '-__v', 'discussions'),
  },
  announcements: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/announcement.model', {}, '-__v', 'announcements'),
  },
  polls: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/poll.model', {}, '-__v', 'polls'),
  },
  groups: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/Group', {}, '-__v', 'groups'),
  },
  groupSets: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/GroupSet', {}, '-__v', 'groupSets'),
  },
  meetings: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/groupMeeting.model', {}, '-__v', 'meetings'),
  },
  attendance: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/attendance.model', {}, '-__v', 'attendance'),
  },
  institutionPolicies: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: false,
    export: modelExporter('../../models/institutionGradingPolicy.model', {}, '-__v', 'institutionPolicies'),
  },
  coursePolicies: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/courseGradingPolicy.model', {}, '-__v', 'coursePolicies'),
  },
  gradeSnapshots: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter(
      '../../models/studentCourseGradeSnapshot.model',
      { frozen: true },
      '-__v',
      'gradeSnapshots'
    ),
  },
  transcriptSnapshots: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/transcriptIssueLog.model', {}, '-__v', 'transcriptSnapshots'),
  },
  lifecycleRecords: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/courseGradeLifecycle.model', {}, '-__v', 'lifecycleRecords'),
  },
  amendments: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/gradeAmendmentRecord.model', {}, '-__v', 'amendments'),
  },
  policyAudits: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/gradingPolicyAudit.model', {}, '-__v', 'policyAudits'),
  },
  systemAudit: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/systemAuditEvent.model', {}, '-__v', 'systemAudit'),
  },
  asyncJobs: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/asyncJob.model', {}, '-__v -downloadToken', 'asyncJobs'),
  },
  notifications: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/notification.model', {}, '-__v', 'notifications'),
  },
  notificationPreferences: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/notificationPreferences.model', {}, '-__v', 'notificationPreferences'),
  },
  calendarEvents: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: true,
    cursor: cursorExporter('../../models/event.model', {}, '-__v', 'calendarEvents'),
  },
  uploadsMetadata: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: false,
    export: async () => {
      const Course = require('../../models/course.model');
      const Submission = require('../../models/Submission');
      const courses = await Course.find({}).select('syllabusFiles title').lean();
      const courseFiles = courses.flatMap((c) =>
        (c.syllabusFiles || []).map((f) => ({
          source: 'course.syllabusFiles',
          courseId: String(c._id),
          courseTitle: c.title,
          name: f.name,
          url: f.url,
          size: f.size,
          uploadedAt: f.uploadedAt,
        }))
      );
      const subs = await Submission.find({ 'attachments.0': { $exists: true } })
        .select('assignment student attachments')
        .lean();
      const submissionFiles = subs.flatMap((s) =>
        (s.attachments || []).map((a) => ({
          source: 'submission.attachments',
          submissionId: String(s._id),
          assignmentId: s.assignment ? String(s.assignment) : null,
          studentId: s.student ? String(s.student) : null,
          name: a.name || a.filename,
          url: a.url || a.path,
          size: a.size,
        }))
      );
      return [...courseFiles, ...submissionFiles];
    },
  },
  permissionsRoles: {
    schemaVersion: SCHEMA_VERSION,
    chunkable: false,
    export: async () => {
      const User = require('../../models/user.model');
      const users = await User.find({}).select('email role').sort({ _id: 1 }).lean();
      return users.map((u) => ({
        userId: String(u._id),
        email: u.email,
        role: u.role,
      }));
    },
  },
};

function resolveSectionNames(requested) {
  if (!requested || requested.length === 0) return [...SECTION_ORDER];
  const set = new Set(requested);
  return SECTION_ORDER.filter((name) => set.has(name));
}

module.exports = {
  SECTION_ORDER,
  SECTION_DEFINITIONS,
  DEFAULT_CHUNK_SIZE,
  resolveSectionNames,
};
