const SubmissionVersion = require('../models/submissionVersion.model');
const DEFAULT_MAX_VERSIONS = parseInt(process.env.SUBMISSION_VERSION_MAX || '100', 10);

function mapToPlain(value) {
  if (!value) return value;
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

async function snapshotSubmission(submission, { actorId } = {}) {
  if (!submission?._id) return null;
  const hasEvidence =
    submission.submittedAt ||
    submission.submissionText ||
    (submission.answers && Object.keys(mapToPlain(submission.answers) || {}).length > 0) ||
    (submission.files || []).length > 0 ||
    (submission.fileAssets || []).length > 0;
  if (!hasEvidence) return null;

  const latest = await SubmissionVersion.findOne({ submission: submission._id })
    .sort({ version: -1 })
    .select('version')
    .lean();
  const version = (latest?.version || 0) + 1;
  if (version > DEFAULT_MAX_VERSIONS) {
    const err = new Error('Submission version limit reached');
    err.statusCode = 409;
    err.code = 'SUBMISSION_VERSION_LIMIT';
    throw err;
  }

  return SubmissionVersion.create({
    submission: submission._id,
    assignment: submission.assignment,
    student: submission.student,
    group: submission.group,
    version,
    answers: mapToPlain(submission.answers) || {},
    submissionText: submission.submissionText,
    files: submission.files || [],
    fileAssets: submission.fileAssets || [],
    submittedAt: submission.submittedAt,
    submittedBy: submission.submittedBy,
    autoGradeSnapshot: {
      autoGraded: submission.autoGraded,
      autoGrade: submission.autoGrade,
      autoQuestionGrades: mapToPlain(submission.autoQuestionGrades) || {},
    },
    createdBy: actorId,
  });
}

async function listSubmissionVersions(submissionId, { limit = 25, beforeVersion = null } = {}) {
  const query = { submission: submissionId };
  if (beforeVersion) query.version = { $lt: Number(beforeVersion) };
  return SubmissionVersion.find(query)
    .sort({ version: -1 })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 100))
    .lean();
}

module.exports = {
  snapshotSubmission,
  listSubmissionVersions,
};
