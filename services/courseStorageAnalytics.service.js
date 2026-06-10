const mongoose = require('mongoose');
const FileAsset = require('../models/fileAsset.model');
const Course = require('../models/course.model');
const { getQuotaSnapshot } = require('./fileQuota.service');
const { isCourseGradingStaff, ADMIN_ROLES } = require('../middleware/academicPermissions');

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const value = String(id);
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : id;
}

function courseFileMatch(courseId) {
  return { courseId: toObjectId(courseId), isDeleted: false };
}

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(courseId) {
  return `course-storage:v2:${courseId}`;
}

async function assertCourseStorageAccess(user, courseId) {
  const course = await Course.findById(courseId).lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }
  if (!ADMIN_ROLES.has(user.role) && !isCourseGradingStaff(user, course)) {
    const err = new Error('Not authorized to view course storage');
    err.statusCode = 403;
    throw err;
  }
  return course;
}

async function aggregateCourseStorage(courseId, { bypassCache = false } = {}) {
  const key = cacheKey(courseId);
  const hit = cache.get(key);
  if (!bypassCache && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const baseMatch = courseFileMatch(courseId);

  const [byCategory, byAssignment, largest, byStudent, totals] = await Promise.all([
    FileAsset.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$category', bytes: { $sum: '$size' }, count: { $sum: 1 } } },
      { $sort: { bytes: -1 } },
    ]),
    FileAsset.aggregate([
      { $match: { ...baseMatch, assignmentId: { $ne: null } } },
      { $group: { _id: '$assignmentId', bytes: { $sum: '$size' }, count: { $sum: 1 } } },
      { $sort: { bytes: -1 } },
      { $limit: 20 },
    ]),
    FileAsset.find(baseMatch)
      .sort({ size: -1 })
      .limit(10)
      .select('originalName size category assignmentId uploadedBy createdAt')
      .lean(),
    FileAsset.aggregate([
      { $match: { ...baseMatch, category: 'submission' } },
      { $group: { _id: '$uploadedBy', bytes: { $sum: '$size' }, count: { $sum: 1 } } },
      { $sort: { bytes: -1 } },
      { $limit: 25 },
    ]),
    FileAsset.aggregate([
      { $match: baseMatch },
      { $group: { _id: null, bytes: { $sum: '$size' }, count: { $sum: 1 } } },
    ]),
  ]);

  const totalBytes = totals[0]?.bytes || 0;
  const totalFiles = totals[0]?.count || 0;
  const quota = await getQuotaSnapshot(null, courseId);

  const data = {
    courseId: String(courseId),
    totalBytes,
    totalFiles,
    byCategory: byCategory.map((r) => ({
      category: r._id,
      bytes: r.bytes,
      count: r.count,
    })),
    byAssignment: byAssignment.map((r) => ({
      assignmentId: String(r._id),
      bytes: r.bytes,
      count: r.count,
    })),
    largestFiles: largest,
    studentUploadBytes: byStudent.map((r) => ({
      studentId: String(r._id),
      bytes: r.bytes,
      count: r.count,
    })),
    quota: {
      courseUsed: totalBytes,
      courseLimit: quota.quotas.maxStoragePerCourseBytes,
      courseRemaining: quota.courseRemaining,
      percentUsed: quota.quotas.maxStoragePerCourseBytes
        ? Math.min(100, Math.round((totalBytes / quota.quotas.maxStoragePerCourseBytes) * 100))
        : 0,
    },
    cachedAt: new Date().toISOString(),
  };

  cache.set(key, { at: Date.now(), data });
  return data;
}

async function enqueueRecalculate(courseId, user) {
  const { enqueueJob } = require('./jobQueue.service');
  return enqueueJob('files.storage.recalculate', { courseId }, user);
}

module.exports = {
  assertCourseStorageAccess,
  aggregateCourseStorage,
  enqueueRecalculate,
};
