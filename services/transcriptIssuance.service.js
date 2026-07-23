const Course = require('../models/course.model');
const User = require('../models/user.model');
const TranscriptIssueLog = require('../models/transcriptIssueLog.model');
const StudentHold = require('../models/studentHold.model');
const { hashTranscriptPayload } = require('../shared/grading/transcriptHash.cjs');
const gradingPolicySnapshotService = require('./gradingPolicySnapshot.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const { withTenantFilter } = require('../utils/tenantContext');

const OFFICIAL_LIFECYCLE = new Set(['FINALIZED', 'AMENDED']);

function semesterMatches(course, term, year) {
  const sem = getSemesterFromCourse(course);
  return sem.term === term && Number(sem.year) === Number(year);
}

/**
 * Build canonical transcript rows from current frozen snapshots (per course).
 */
async function buildTranscriptHashPayload(studentId, term, year, { rootAccountId } = {}) {
  const courseFilter = withTenantFilter(
    { students: studentId, published: true },
    rootAccountId || undefined
  );
  const courses = await Course.find(courseFilter)
    .select('_id title catalog semester createdAt rootAccountId')
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
      courseCode: course.catalog?.courseCode || '',
      title: course.title || '',
      creditHours: course.catalog?.creditHours ?? course.catalog?.credits ?? null,
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

/**
 * Official transcripts may only include FINALIZED/AMENDED frozen rows.
 */
function assertOfficialEligible(payload) {
  if (!payload?.courses?.length) {
    const err = new Error('No courses found for this student/term to issue an official transcript');
    err.statusCode = 400;
    err.code = 'NO_COURSES';
    throw err;
  }

  const ineligible = payload.courses.filter(
    (c) => !c.lifecycleStatus || !OFFICIAL_LIFECYCLE.has(c.lifecycleStatus)
  );
  if (ineligible.length) {
    const err = new Error(
      `Official transcript requires FINALIZED/AMENDED grades. Ineligible courses: ${ineligible
        .map((c) => `${c.courseCode || c.courseId}(${c.lifecycleStatus || 'NONE'})`)
        .join(', ')}`
    );
    err.statusCode = 400;
    err.code = 'NOT_FINALIZED';
    err.ineligible = ineligible.map((c) => ({
      courseId: c.courseId,
      lifecycleStatus: c.lifecycleStatus,
    }));
    throw err;
  }
}

function publicVerifyBaseUrl() {
  const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (base) return `${base}/api/public/transcript/verify`;
  return '/api/public/transcript/verify';
}

async function issueOfficialTranscript({
  studentId,
  term,
  year,
  issuedBy,
  notes,
  ip,
  templateId,
  requestId,
  skipOfficialGuard = false,
}) {
  const student = await User.findById(studentId)
    .select('rootAccountId accountId firstName lastName email studentProfile')
    .lean();
  if (!student) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }

  const rootAccountId = student.rootAccountId;
  if (rootAccountId) {
    const hold = await StudentHold.hasBlockingHold(rootAccountId, studentId, {
      transcript: true,
    });
    if (hold) {
      const err = new Error(`Transcript hold: ${hold.reason}`);
      err.statusCode = 403;
      err.code = 'HOLD_BLOCKS_TRANSCRIPT';
      err.hold = hold;
      throw err;
    }
  }

  const payload = await buildTranscriptHashPayload(studentId, term, year, { rootAccountId });
  if (!skipOfficialGuard) {
    assertOfficialEligible(payload);
  }

  // Hash payload stays stable: only fields used historically for hashing
  const hashPayload = {
    studentId: payload.studentId,
    term: payload.term,
    year: payload.year,
    courses: payload.courses.map((c) => ({
      courseId: c.courseId,
      finalPercent: c.finalPercent,
      letterGrade: c.letterGrade,
      gradingPolicyHash: c.gradingPolicyHash,
      gradingPolicyVersion: c.gradingPolicyVersion,
      gradingEngineVersion: c.gradingEngineVersion,
      lifecycleStatus: c.lifecycleStatus,
    })),
  };
  const transcriptHash = hashTranscriptPayload(hashPayload);
  const verifyUrl = `${publicVerifyBaseUrl()}/${transcriptHash}`;

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
    rootAccountId: rootAccountId || undefined,
    accountId: student.accountId || rootAccountId || undefined,
    templateId: templateId || undefined,
    requestId: requestId || undefined,
    verifyUrl,
  });

  try {
    const institutionalNotification = require('./institutionalNotification.service');
    await institutionalNotification.notifyUser(studentId, 'transcript_ready', {
      message: `Your official transcript for ${term} ${year} is ready.`,
      link: `/reports/transcript?term=${encodeURIComponent(term)}&year=${year}`,
      metadata: { transcriptHash, verifyUrl, term, year: Number(year) },
    });
  } catch {
    /* non-blocking */
  }

  return { log: log.toObject(), transcriptHash, payload, verifyUrl, student };
}

async function listIssuanceHistory(studentId, term, year, { limit = 20, rootAccountId } = {}) {
  const filter = withTenantFilter(
    {
      student: studentId,
      term,
      year: Number(year),
    },
    rootAccountId || undefined
  );
  return TranscriptIssueLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('issuedBy', 'firstName lastName email role')
    .lean();
}

async function verifyByHash(transcriptHash) {
  const hash = String(transcriptHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    const err = new Error('Invalid transcript hash');
    err.statusCode = 400;
    throw err;
  }

  const log = await TranscriptIssueLog.findOne({ transcriptHash: hash })
    .populate('student', 'firstName lastName email studentProfile.admissionNumber')
    .populate('issuedBy', 'firstName lastName role')
    .lean();

  if (!log) {
    const err = new Error('Transcript not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return {
    valid: true,
    transcriptHash: log.transcriptHash,
    term: log.term,
    year: log.year,
    courseCount: log.courseCount,
    issuedAt: log.createdAt,
    student: log.student
      ? {
          firstName: log.student.firstName,
          lastName: log.student.lastName,
          admissionNumber: log.student.studentProfile?.admissionNumber || null,
        }
      : null,
    issuedBy: log.issuedBy
      ? {
          firstName: log.issuedBy.firstName,
          lastName: log.issuedBy.lastName,
          role: log.issuedBy.role,
        }
      : null,
    courses: (log.payloadSummary?.courses || []).map((c) => ({
      courseId: c.courseId,
      courseCode: c.courseCode || null,
      title: c.title || null,
      letterGrade: c.letterGrade,
      finalPercent: c.finalPercent,
      lifecycleStatus: c.lifecycleStatus,
    })),
  };
}

module.exports = {
  OFFICIAL_LIFECYCLE,
  buildTranscriptHashPayload,
  assertOfficialEligible,
  issueOfficialTranscript,
  listIssuanceHistory,
  verifyByHash,
  publicVerifyBaseUrl,
};
