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

function getJobsDir() {
  return paths.jobExports;
}

function ensureJobsDir() {
  const jobsDir = getJobsDir();
  if (!fs.existsSync(jobsDir)) {
    fs.mkdirSync(jobsDir, { recursive: true });
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

async function processGradesPolicyImpactPreview(jobDoc) {
  const { courseId, payload } = jobDoc.payload;
  const gradingPolicyImpactService = require('./gradingPolicyImpact.service');
  const course = await Course.findById(courseId).select('students').lean();
  const total = (course?.students || []).length;
  await updateProgress(jobDoc._id, 0, total);

  const result = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, payload || {});
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
  const { courseId, gradingPeriodId } = jobDoc.payload;
  const exportOptions = gradingPeriodId ? { gradingPeriodId } : {};
  const dataset = await buildGradebookDataset(courseId, exportOptions);
  const buffer = await buildGradebookWorkbookBuffer(dataset, exportOptions);

  ensureJobsDir();
  const { resolvePeriodLabel } = require('./gradebookExport.service');
  const periodLabel = await resolvePeriodLabel(courseId, gradingPeriodId);
  const periodSlug = periodLabel
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const fileName = `gradebook-${courseId}-${periodSlug}-${Date.now()}.xlsx`;
  const filePath = path.join(getJobsDir(), fileName);
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

async function processCourseCopy(jobDoc) {
  const courseCopyService = require('./courseCopy.service');
  const { sourceCourseId, targetTitle, includeAnnouncements, includeDiscussions } = jobDoc.payload;
  const result = await courseCopyService.copyCourseContent(sourceCourseId, {
    targetTitle,
    requestedBy: jobDoc.requestedBy,
    includeAnnouncements: includeAnnouncements !== false,
    includeDiscussions: includeDiscussions !== false,
  });
  return { newCourseId: String(result.course._id), moduleCount: Object.keys(result.moduleIdMap).length };
}

async function processCourseBulk(jobDoc) {
  const Course = require('../models/course.model');
  const Assignment = require('../models/Assignment');
  const Module = require('../models/module.model');
  const { courseIds, operation, payload = {} } = jobDoc.payload;
  let completed = 0;
  const results = [];

  for (const courseId of courseIds) {
    const course = await Course.findById(courseId);
    if (!course) {
      results.push({ courseId, ok: false, error: 'not_found' });
      continue;
    }
    try {
      if (operation === 'publish') {
        course.published = true;
        await course.save();
      } else if (operation === 'unpublish') {
        course.published = false;
        await course.save();
      } else if (operation === 'archive') {
        const courseCopyService = require('./courseCopy.service');
        await courseCopyService.archiveCourse(courseId, { _id: jobDoc.requestedBy });
      } else if (operation === 'dueDateShift' && payload.days) {
        const mods = await Module.find({ course: courseId }).select('_id');
        const modIds = mods.map((m) => m._id);
        const assignments = await Assignment.find({ module: { $in: modIds } });
        for (const a of assignments) {
          if (a.dueDate) {
            a.dueDate = new Date(new Date(a.dueDate).getTime() + payload.days * 86400000);
            await a.save();
          }
        }
      }
      completed += 1;
      results.push({ courseId, ok: true });
    } catch (e) {
      results.push({ courseId, ok: false, error: e.message });
    }
    await updateProgress(jobDoc._id, completed, courseIds.length);
  }
  return { completed, total: courseIds.length, results };
}

async function processMaintenanceFiles(jobDoc) {
  const courseMaintenanceService = require('./courseMaintenance.service');
  return courseMaintenanceService.runMaintenanceBundle(jobDoc.payload || {});
}

async function processFilesBulkJob(jobDoc) {
  const fileBulkOperations = require('./fileBulkOperations.service');
  const { fileAssetIds = [], reason, dryRun } = jobDoc.payload || {};
  const user = { _id: jobDoc.requestedBy, role: 'admin' };
  if (dryRun) return { dryRun: true, count: fileAssetIds.length };
  switch (jobDoc.type) {
    case 'files.bulk.restore':
      return fileBulkOperations.bulkRestore(fileAssetIds, user, {});
    case 'files.bulk.quarantine':
      return fileBulkOperations.bulkQuarantine(fileAssetIds, reason, user, {});
    case 'files.bulk.release':
      return fileBulkOperations.bulkRelease(fileAssetIds, user, {});
    case 'files.bulk.zip':
      return fileBulkOperations.bulkZipExport(fileAssetIds, user, {});
    case 'files.bulk.retention':
      return fileBulkOperations.bulkMarkRetention(fileAssetIds, user, {});
    default:
      return { skipped: true };
  }
}

async function processFilePreviewJob(jobDoc) {
  const { processPreviewJob } = require('./filePreviewJob.service');
  const ids = jobDoc.payload?.fileAssetIds || [];
  const results = [];
  for (const id of ids) {
    results.push(
      await processPreviewJob(id, {
        actorId: jobDoc.requestedBy,
        regenerate: Boolean(jobDoc.payload?.regenerate),
      })
    );
  }
  return { processed: results.length, results };
}

async function runJobByType(jobDoc) {
  switch (jobDoc.type) {
    case 'grades.finalize':
      return processGradesFinalize(jobDoc);
    case 'grades.recompute':
      return processGradesRecompute(jobDoc);
    case 'grades.policyImpactPreview':
      return processGradesPolicyImpactPreview(jobDoc);
    case 'transcript.regenerate':
      return processTranscriptRegenerate(jobDoc);
    case 'export.gradebook':
      return processExportGradebook(jobDoc);
    case 'course.copy':
      return processCourseCopy(jobDoc);
    case 'course.bulk':
      return processCourseBulk(jobDoc);
    case 'maintenance.files':
      return processMaintenanceFiles(jobDoc);
    case 'files.bulk.restore':
    case 'files.bulk.quarantine':
    case 'files.bulk.release':
    case 'files.bulk.zip':
    case 'files.bulk.retention':
      return processFilesBulkJob(jobDoc);
    case 'files.preview':
      return processFilePreviewJob(jobDoc);
    case 'files.bulk.download': {
      const bulkDownload = require('./bulkDownload.service');
      const User = require('../models/user.model');
      const requester = await User.findById(jobDoc.requestedBy).select('role').lean();
      const user = { _id: jobDoc.requestedBy, role: requester?.role || 'admin' };
      const ids = jobDoc.payload?.fileAssetIds || [];
      if (!ids.length) {
        throw new Error('No files selected for bulk download');
      }
      return bulkDownload.buildZipArchive({
        fileAssetIds: ids,
        label: jobDoc.payload?.label,
        user,
        audit: {},
      });
    }
    case 'files.storage.recalculate': {
      const courseStorageAnalytics = require('./courseStorageAnalytics.service');
      return courseStorageAnalytics.aggregateCourseStorage(jobDoc.payload.courseId, {
        bypassCache: true,
      });
    }
    default:
      throw new Error(`Unknown job type: ${jobDoc.type}`);
  }
}

module.exports = {
  runJobByType,
  createDownloadToken,
  verifyDownloadToken,
  getJobsDir,
};
