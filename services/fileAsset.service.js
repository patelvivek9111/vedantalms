const crypto = require('crypto');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const { loadUploadSettings, resolveUploadMimeType } = require('../utils/fileSettings');
const { storeMulterFile, deleteStoredBlob } = require('./fileStorage.service');
const { assertCourseFilesMutable, resolveCourseForAssignment } = require('./fileLifecycle.service');
const { newVersionGroupId } = require('./fileVersioning.service');
const { assertFileMutable } = require('./fileGovernance.service');
const { queueFileScan } = require('./fileScan.service');
const academicAuditService = require('./academicAudit.service');
const { isEnrolledStudent, isCourseGradingStaff, ADMIN_ROLES } = require('../middleware/academicPermissions');

function sha256Buffer(buf) {
  if (!Buffer.isBuffer(buf)) {
    throw new TypeError('Checksum requires a Buffer');
  }
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function buildDownloadPath(fileAssetId, token = null) {
  const base = `/api/files/${fileAssetId}/download`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

function buildDownloadPathForUser(fileAssetId, userId) {
  const fileAccessService = require('./fileAccess.service');
  const { token } = fileAccessService.createFileDownloadToken(fileAssetId, userId);
  return buildDownloadPath(fileAssetId, token);
}

function enrichLegacyFileUrls(urls, userId) {
  if (!urls?.length || !userId) return urls || [];
  return urls.map((url) => {
    if (typeof url !== 'string') return url;
    const m = url.match(/\/api\/files\/([a-f0-9]{24})\/download/i);
    if (m) return buildDownloadPathForUser(m[1], userId);
    return url;
  });
}

function serializeFileAsset(asset, userId = null) {
  if (!asset) return null;
  const id = asset._id || asset.id;
  const url = userId ? buildDownloadPathForUser(id, userId) : buildDownloadPath(id);
  return {
    fileAssetId: String(id),
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    category: asset.category,
    url,
    path: url,
  };
}

async function validateUpload(file, { user, category, courseId, metadata = {} }) {
  const settings = await loadUploadSettings();
  const size = file.size || file.buffer?.length || 0;
  const fileQuotaService = require('./fileQuota.service');
  await fileQuotaService.assertUploadWithinQuota({
    user,
    courseId,
    additionalBytes: size,
    audit: { ip: metadata.ip, requestId: metadata.requestId },
  });
  if (size > settings.maxFileSizeBytes) {
    const err = new Error(`File exceeds maximum size of ${settings.maxFileSizeBytes} bytes`);
    err.statusCode = 400;
    throw err;
  }
  const resolvedMime = resolveUploadMimeType(file.originalname, file.mimetype);
  file.mimetype = resolvedMime;
  if (resolvedMime && !settings.allowedMimeTypes.includes(resolvedMime)) {
    const err = new Error(
      `File type is not allowed (${resolvedMime}). Enable mp4/mov in Admin → System Settings if needed.`
    );
    err.statusCode = 400;
    throw err;
  }
  if (!user?._id) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  if (category === 'submission' && user.role !== 'student') {
    const err = new Error('Only students may upload submission files');
    err.statusCode = 403;
    throw err;
  }
  if (category === 'feedback' && user.role === 'student') {
    const err = new Error('Only instructors may upload feedback files');
    err.statusCode = 403;
    throw err;
  }
}

async function createFileAsset({
  file,
  uploadedBy,
  category,
  visibility = 'private',
  accessScope = {},
  courseId = null,
  assignmentId = null,
  submissionId = null,
  pageId = null,
  announcementId = null,
  discussionId = null,
  institutionId = 'default',
  lifecycleLocked = false,
  metadata = {},
  cloudinaryFolder,
  resourceType,
  skipLifecycleCheck = false,
}) {
  await validateUpload(file, { user: uploadedBy, category, courseId, metadata });

  if (!skipLifecycleCheck && courseId) {
    const Course = require('../models/course.model');
    const course = await Course.findById(courseId);
    await assertCourseFilesMutable(course, uploadedBy, { action: 'upload' });
  }

  const stored = await storeMulterFile(file, {
    category,
    courseId: courseId || 'global',
    cloudinaryFolder,
    resourceType,
  });

  let checksumSha256 = '';
  try {
    if (file.buffer) checksumSha256 = sha256Buffer(file.buffer);
  } catch {
    checksumSha256 = '';
  }

  const ext = path.extname(file.originalname || '').toLowerCase();

  const doc = await FileAsset.create({
    storageKey: stored.storageKey,
    provider: stored.provider,
    bucket: stored.bucket || '',
    path: stored.path,
    originalName: file.originalname || 'file',
    mimeType: file.mimetype || 'application/octet-stream',
    extension: ext,
    size: stored.size,
    checksumSha256,
    uploadedBy: uploadedBy._id || uploadedBy,
    institutionId,
    courseId,
    assignmentId,
    submissionId,
    pageId,
    announcementId,
    discussionId,
    category,
    visibility,
    accessScope,
    lifecycleLocked,
    versionNumber: 1,
    isCurrentVersion: true,
    versionGroupId: newVersionGroupId(),
    scanStatus: 'skipped',
    cleanupState: 'ACTIVE',
    metadata: {
      ...metadata,
      providerUrl: stored.providerUrl || undefined,
    },
  });

  queueFileScan(doc._id, { dryRun: false }).catch(() => {});

  const previewJob = require('./filePreviewJob.service');
  previewJob.processPreviewJob(doc._id, { actorId: uploadedBy._id || uploadedBy }).catch(() => {});

  await academicAuditService.recordAuditEvent({
    actorId: uploadedBy._id || uploadedBy,
    entityType: 'file_asset',
    entityId: doc._id,
    action: 'file_upload',
    after: { category, courseId, assignmentId, submissionId },
    ip: metadata.ip,
    requestId: metadata.requestId,
  }).catch(() => {});

  return doc;
}

/**
 * Validate that file asset IDs belong to the uploader and optional course/assignment scope.
 */
async function validateFileAssetIdsForAttach(fileAssetIds, {
  user,
  courseId,
  assignmentId,
  category,
  ownerOnly = true,
}) {
  if (!Array.isArray(fileAssetIds) || fileAssetIds.length === 0) {
    return [];
  }
  const assets = await FileAsset.find({
    _id: { $in: fileAssetIds },
    isDeleted: false,
  });

  if (assets.length !== fileAssetIds.length) {
    const err = new Error('One or more file assets are invalid or deleted');
    err.statusCode = 400;
    throw err;
  }

  for (const asset of assets) {
    if (asset.category !== category && category) {
      const allowedStaging =
        asset.category === 'temporary' &&
        ['submission', 'assignment', 'page', 'announcement', 'syllabus', 'message', 'discussion', 'feedback'].includes(
          category
        );
      if (!allowedStaging) {
        const err = new Error('File asset category mismatch');
        err.statusCode = 400;
        throw err;
      }
    }
    if (ownerOnly && String(asset.uploadedBy) !== String(user._id)) {
      const err = new Error('Cannot attach files uploaded by another user');
      err.statusCode = 403;
      throw err;
    }
    if (courseId && asset.courseId && String(asset.courseId) !== String(courseId)) {
      const err = new Error('File asset does not belong to this course');
      err.statusCode = 403;
      throw err;
    }
    if (assignmentId && asset.assignmentId && String(asset.assignmentId) !== String(assignmentId)) {
      const err = new Error('File asset does not belong to this assignment');
      err.statusCode = 403;
      throw err;
    }
    if (asset.lifecycleLocked) {
      const err = new Error('File asset is locked');
      err.statusCode = 403;
      throw err;
    }
    if (asset.scanStatus === 'unsafe') {
      const err = new Error('File asset failed safety scan');
      err.statusCode = 403;
      throw err;
    }
  }

  return assets;
}

async function attachFileAssets(fileAssetIds, patch) {
  if (!fileAssetIds?.length) return;
  await FileAsset.updateMany(
    { _id: { $in: fileAssetIds } },
    { $set: patch }
  );
}

async function deleteFileAsset(fileAssetId, user, audit = {}) {
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset || asset.isDeleted) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
  await assertFileMutable(asset, { action: 'delete', user });
  const Course = require('../models/course.model');
  const course = asset.courseId ? await Course.findById(asset.courseId) : null;
  const staffOk = course && isCourseGradingStaff(user, course);
  if (
    String(asset.uploadedBy) !== String(user._id) &&
    !ADMIN_ROLES.has(user.role) &&
    !staffOk
  ) {
    const err = new Error('Not authorized to delete this file');
    err.statusCode = 403;
    throw err;
  }

  if (asset.courseId) {
    const course = await require('../models/course.model').findById(asset.courseId);
    await assertCourseFilesMutable(course, user, { action: 'delete' });
  }

  asset.isDeleted = true;
  asset.deletedAt = new Date();
  await asset.save();

  const blobRetention = require('./blobRetention.service');
  try {
    const qResult = await blobRetention.quarantineBlob(asset, {
      actorId: user._id,
      ip: audit.ip,
      requestId: audit.requestId,
    });
    if (!qResult.quarantined && qResult.reason !== 'blob_already_missing') {
      asset.cleanupState = 'PENDING_QUARANTINE';
      asset.metadata = { ...(asset.metadata || {}), quarantineFailed: true, quarantineReason: qResult.reason };
      await asset.save();
      const err = new Error('Blob quarantine failed; live blob preserved for operator recovery');
      err.statusCode = 500;
      throw err;
    }
  } catch (quarantineErr) {
    if (quarantineErr.statusCode === 423) throw quarantineErr;
    asset.cleanupState = 'PENDING_QUARANTINE';
    asset.metadata = { ...(asset.metadata || {}), quarantineFailed: true };
    await asset.save();
    throw quarantineErr;
  }

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: asset._id,
    action: 'file_delete',
    ip: audit.ip,
    requestId: audit.requestId,
  }).catch(() => {});

  return asset;
}

/**
 * Create assets from multer files (batch) — used by /api/upload and domain controllers.
 */
async function createFileAssetsFromMulter(files, options) {
  const results = [];
  for (const file of files) {
    results.push(await createFileAsset({ file, ...options }));
  }
  return results;
}

/**
 * Accept legacy URL strings OR ObjectId strings; return validated asset ids.
 */
async function resolveSubmissionFileInputs(uploadedFiles, { user, assignmentId, courseId }) {
  if (!uploadedFiles?.length) return { fileAssetIds: [], legacyUrls: [] };

  const ids = [];
  const legacyUrls = [];

  for (const item of uploadedFiles) {
    if (typeof item === 'string' && /^[a-f0-9]{24}$/i.test(item)) {
      ids.push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      if (item.fileAssetId) {
        ids.push(item.fileAssetId);
        continue;
      }
      if (item.url) {
        if (/^\/api\/files\/[a-f0-9]{24}\/download/.test(item.url)) {
          const m = item.url.match(/\/api\/files\/([a-f0-9]{24})\/download/);
          if (m) ids.push(m[1]);
          continue;
        }
        legacyUrls.push(item.url);
        continue;
      }
    }
    if (typeof item === 'string' && (item.startsWith('/uploads/') || item.includes('cloudinary.com'))) {
      legacyUrls.push(item);
    }
  }

  if (legacyUrls.length) {
    const err = new Error(
      'Legacy file URLs are not accepted. Upload files via POST /api/upload and attach fileAssetId references.'
    );
    err.statusCode = 400;
    throw err;
  }

  const uniqueIds = [...new Set(ids)];
  await validateFileAssetIdsForAttach(uniqueIds, {
    user,
    courseId,
    assignmentId,
    category: 'submission',
    ownerOnly: true,
  });

  return { fileAssetIds: uniqueIds, legacyUrls: [] };
}

function parseFileAssetIdsFromBody(body = {}) {
  const raw = body.fileAssetIds ?? body.uploadedFileIds;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Resolve attachments from multer files and/or pre-uploaded fileAssetIds (Canvas-style flow).
 */
async function resolveAttachmentsFromRequest(req, {
  user,
  courseId,
  assignmentId,
  category,
  allowTemporaryCategory = true,
}) {
  let fileAssetIds = parseFileAssetIdsFromBody(req.body);
  let attachments = [];

  if (fileAssetIds.length) {
    const attachCategory = allowTemporaryCategory ? category : category;
    await validateFileAssetIdsForAttach(fileAssetIds, {
      user,
      courseId,
      assignmentId,
      category: attachCategory,
      ownerOnly: true,
    });
    attachments = fileAssetIds.map((id) => buildDownloadPath(id));
  }

  if (req.files?.length) {
    const assets = await createFileAssetsFromMulter(req.files, {
      uploadedBy: user,
      category,
      courseId,
      assignmentId,
      visibility: 'course',
      accessScope: { enrolledOnly: true },
      metadata: { ip: req.ip, requestId: req.requestId },
    });
    const newIds = assets.map((a) => String(a._id));
    fileAssetIds = [...new Set([...fileAssetIds, ...newIds])];
    attachments = [...attachments, ...assets.map((a) => buildDownloadPath(a._id))];
  }

  return { fileAssetIds, attachments };
}

/**
 * Clone FileAsset metadata for course copy (same blob, new ownership row).
 */
async function cloneFileAssetForCourseCopy(sourceAssetId, {
  uploadedBy,
  courseId,
  category,
  assignmentId,
  pageId,
  announcementId,
  discussionId,
}) {
  const source = await FileAsset.findById(sourceAssetId).lean();
  if (!source || source.isDeleted) return null;

  const doc = await FileAsset.create({
    storageKey: source.storageKey,
    provider: source.provider,
    bucket: source.bucket,
    path: source.path,
    originalName: source.originalName,
    mimeType: source.mimeType,
    extension: source.extension,
    size: source.size,
    checksumSha256: source.checksumSha256,
    uploadedBy: uploadedBy._id || uploadedBy,
    institutionId: source.institutionId,
    courseId,
    assignmentId,
    pageId,
    announcementId,
    discussionId,
    category: category || source.category,
    visibility: source.visibility,
    accessScope: source.accessScope,
    lifecycleLocked: false,
    versionNumber: 1,
    isCurrentVersion: true,
    versionGroupId: newVersionGroupId(),
    scanStatus: source.scanStatus === 'unsafe' ? 'pending' : source.scanStatus,
    cleanupState: 'ACTIVE',
    metadata: { ...source.metadata, copiedFrom: String(source._id) },
  });
  return doc;
}

async function cloneFileAssetIdsForCourseCopy(sourceIds, options) {
  if (!sourceIds?.length) return [];
  const cloned = [];
  for (const id of sourceIds) {
    const doc = await cloneFileAssetForCourseCopy(id, options);
    if (doc) cloned.push(doc._id);
  }
  return cloned;
}

async function assertStudentEnrolledInCourse(user, course) {
  if (!course || user.role !== 'student') return;
  if (!isEnrolledStudent(user, course)) {
    const err = new Error('Student is not enrolled in this course');
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  createFileAsset,
  createFileAssetsFromMulter,
  validateUpload,
  validateFileAssetIdsForAttach,
  attachFileAssets,
  deleteFileAsset,
  serializeFileAsset,
  buildDownloadPath,
  buildDownloadPathForUser,
  enrichLegacyFileUrls,
  resolveSubmissionFileInputs,
  assertStudentEnrolledInCourse,
  resolveCourseForAssignment,
  parseFileAssetIdsFromBody,
  resolveAttachmentsFromRequest,
  cloneFileAssetForCourseCopy,
  cloneFileAssetIdsForCourseCopy,
};
