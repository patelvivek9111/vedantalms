const Course = require('../models/course.model');
const TranscriptIssueLog = require('../models/transcriptIssueLog.model');
const { hashTranscriptPayload } = require('../shared/grading/transcriptHash.cjs');
const gradingPolicySnapshotService = require('./gradingPolicySnapshot.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

function semesterMatches(course, term, year) {
  const sem = getSemesterFromCourse(course);
  return sem.term === term && Number(sem.year) === Number(year);
}

/**
 * Build canonical transcript rows from current frozen snapshots (per course).
 */
async function buildTranscriptHashPayload(studentId, term, year) {
  const courses = await Course.find({ students: studentId, published: true })
    .select('_id title catalog semester createdAt')
    .lean();

  const rows = [];
  for (const course of courses) {
    if (!semesterMatches(course, term, year)) continue;

    const snap = await gradingPolicySnapshotService.findFrozenTranscriptSnapshot(
      studentId,
      course._id,
      term,
      year
    );

    rows.push({
      courseId: String(course._id),
      finalPercent: snap?.finalPercent ?? null,
      letterGrade: snap?.letterGrade ?? null,
      gradingPolicyHash: snap?.gradingPolicyHash ?? null,
      gradingPolicyVersion: snap?.gradingPolicyVersion ?? null,
      gradingEngineVersion: snap?.gradingEngineVersion ?? null,
      lifecycleStatus: snap?.lifecycleStatus ?? null,
    });
  }

  rows.sort((a, b) => a.courseId.localeCompare(b.courseId));

  return {
    studentId: String(studentId),
    term,
    year: Number(year),
    courses: rows,
  };
}

async function issueOfficialTranscript({ studentId, term, year, issuedBy, notes, ip }) {
  const payload = await buildTranscriptHashPayload(studentId, term, year);
  const transcriptHash = hashTranscriptPayload(payload);

  const log = await TranscriptIssueLog.create({
    student: studentId,
    term,
    year: Number(year),
    issuedBy: issuedBy._id || issuedBy,
    transcriptHash,
    courseCount: payload.courses.length,
    payloadSummary: payload,
    notes: notes ? String(notes).trim() : undefined,
    ip,
  });

  return { log: log.toObject(), transcriptHash, payload };
}

async function listIssuanceHistory(studentId, term, year, { limit = 20 } = {}) {
  return TranscriptIssueLog.find({
    student: studentId,
    term,
    year: Number(year),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('issuedBy', 'firstName lastName email role')
    .lean();
}

module.exports = {
  buildTranscriptHashPayload,
  issueOfficialTranscript,
  listIssuanceHistory,
};
