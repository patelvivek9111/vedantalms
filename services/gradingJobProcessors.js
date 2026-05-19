const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Course = require('../models/course.model');
const AsyncJob = require('../models/asyncJob.model');
const gradeLifecycleService = require('./gradeLifecycle.service');
const transcriptRecomputeService = require('./transcriptRecompute.service');
const { buildGradebookDataset, buildGradebookWorkbookBuffer } = require('./gradebookExport.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const User = require('../models/user.model');

const { paths } = require('../config/paths');
const JOBS_DIR = paths.jobExports;

function ensureJobsDir() {
  if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
  }
}

function createDownloadToken(jobId) {
  const secret = process.env.JOB_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'job-download-secret';
  const expiresAt = Date.now() + parseInt(process.env.JOB_DOWNLOAD_TTL_MS || `${60 * 60 * 1000}`, 10);
  const payload = `${jobId}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return {
    token: Buffer.from(`${payload}|${sig}`).toString('base64url'),
    expiresAt: new Date(expiresAt),
  };
}

function verifyDownloadToken(jobId, token) {
  const secret = process.env.JOB_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'job-download-secret';
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return false;
    const [payloadJobId, expiresAtPart, sig] = parts;
    const expiresAt = Number(expiresAtPart);
    if (payloadJobId !== String(jobId)) return false;
    if (Date.now() > expiresAt) return false;
    const payload = `${payloadJobId}|${expiresAtPart}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return sig === expected;
  } catch {
    return false;
  }
}

async function updateProgress(jobId, completed, total) {
  await AsyncJob.findByIdAndUpdate(jobId, {
    progress: { completed, total },
  });
}

async function processGradesFinalize(jobDoc) {
  const { courseId, userId } = jobDoc.payload;
  const user = await User.findById(userId);
  if (!user) throw new Error('Requesting user not found');

  const course = await Course.findById(courseId);
  const total = (course?.students || []).length;
  await updateProgress(jobDoc._id, 0, total);

  const result = await gradeLifecycleService.transitionToFinalized(courseId, user);
  await updateProgress(jobDoc._id, total, total);
  return result;
}

async function processGradesRecompute(jobDoc) {
  const user = await User.findById(jobDoc.payload.userId);
  if (!user) throw new Error('Requesting user not found');

  const result = await transcriptRecomputeService.recomputeTranscriptGrades({
    ...jobDoc.payload,
    user,
  });
  return result;
}

async function processTranscriptRegenerate(jobDoc) {
  const { courseId, term, year } = jobDoc.payload;
  const course = await Course.findById(courseId);
  if (!course) throw new Error('Course not found');

  const sem = getSemesterFromCourse(course);
  const termResolved = term || sem.term;
  const yearResolved = Number(year ?? sem.year);
  const lifecycle = await gradeLifecycleService.getLifecycle(courseId, termResolved, yearResolved);
  const status = lifecycle?.status || 'POSTED';

  const students = (course.students || []).map((id) =>
    id && typeof id === 'object' && id._id ? String(id._id) : String(id)
  );
  await updateProgress(jobDoc._id, 0, students.length);

  const { frozenCount } = await gradeLifecycleService.batchFreezeCourseGrades(
    course,
    termResolved,
    yearResolved,
    status === 'FINALIZED' ? 'FINALIZED' : 'POSTED',
    { allowReplaceCurrent: status === 'FINALIZED' }
  );

  await updateProgress(jobDoc._id, students.length, students.length);
  return { frozenCount, term: termResolved, year: yearResolved };
}

async function processExportGradebook(jobDoc) {
  const { courseId } = jobDoc.payload;
  const dataset = await buildGradebookDataset(courseId);
  const buffer = await buildGradebookWorkbookBuffer(dataset);

  ensureJobsDir();
  const fileName = `gradebook-${courseId}-${Date.now()}.xlsx`;
  const filePath = path.join(JOBS_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  const { token, expiresAt } = createDownloadToken(jobDoc._id);
  await AsyncJob.findByIdAndUpdate(jobDoc._id, {
    filePath,
    fileName,
    downloadToken: token,
    downloadExpiresAt: expiresAt,
  });

  return {
    fileName,
    studentCount: dataset.students.length,
    assignmentCount: dataset.assignments.length,
    policyHash: dataset.policyMeta?.policyHash,
    gradingEngineVersion: dataset.policyMeta?.gradingEngineVersion,
  };
}

async function runJobByType(jobDoc) {
  switch (jobDoc.type) {
    case 'grades.finalize':
      return processGradesFinalize(jobDoc);
    case 'grades.recompute':
      return processGradesRecompute(jobDoc);
    case 'transcript.regenerate':
      return processTranscriptRegenerate(jobDoc);
    case 'export.gradebook':
      return processExportGradebook(jobDoc);
    default:
      throw new Error(`Unknown job type: ${jobDoc.type}`);
  }
}

module.exports = {
  runJobByType,
  createDownloadToken,
  verifyDownloadToken,
  JOBS_DIR,
};
