const InstitutionGradingPolicy = require('../models/institutionGradingPolicy.model');
const CourseGradingPolicy = require('../models/courseGradingPolicy.model');
const {
  resolveGradingPolicy,
  courseContextFromResolvedPolicy,
} = require('../shared/grading/policyResolver.cjs');
const {
  validateGradingPolicy,
  sanitizeGradingPolicy,
  deepMergePolicy,
} = require('../shared/grading/policyValidation.cjs');
const { DEFAULT_GRADING_POLICY } = require('../shared/grading/policyDefaults.cjs');
const gradingPolicyAuditService = require('./gradingPolicyAudit.service');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');

/**
 * Load and resolve effective grading policy for a course.
 */
async function getResolvedPolicyForCourse(course, options = {}) {
  const courseId = course?._id || course?.id;
  const cache = options.policyCache;
  if (cache && courseId) {
    const key = String(courseId);
    if (cache.has(key)) return cache.get(key);
  }

  if (!options.skipRedisCache && courseId) {
    const policyRedisCache = require('./policyRedisCache.service');
    const cached = await policyRedisCache.getCachedResolvedPolicy(courseId);
    if (cached) return cached;
  }

  const [institutionPolicy, coursePolicy] = await Promise.all([
    options.skipInstitution ? null : InstitutionGradingPolicy.getPolicy().catch(() => null),
    courseId ? CourseGradingPolicy.findByCourseId(courseId) : null,
  ]);

  const resolved = resolveGradingPolicy({
    course,
    institutionPolicy: institutionPolicy
      ? { policy: institutionPolicy.policy, version: institutionPolicy.version }
      : null,
    coursePolicy,
    teacherPolicy: options.teacherPolicy || null,
  });

  if (cache && courseId) {
    cache.set(String(courseId), resolved);
  }

  if (!options.skipRedisCache && courseId) {
    const policyRedisCache = require('./policyRedisCache.service');
    await policyRedisCache.setCachedResolvedPolicy(courseId, resolved);
  }

  return resolved;
}

/**
 * Course + gradingPolicy for calculateFinalGradeWithWeightedGroups.
 */
async function getCourseGradingContext(course, options = {}) {
  const resolved = await getResolvedPolicyForCourse(course, options);
  const ctx = courseContextFromResolvedPolicy(resolved);
  return { resolved, courseContext: ctx };
}

async function getInstitutionPolicyDocument() {
  return InstitutionGradingPolicy.getPolicy();
}

async function updateInstitutionPolicy(policyPayload, userId, options = {}) {
  const sanitized = sanitizeGradingPolicy(policyPayload);
  const validation = validateGradingPolicy(sanitized);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  const doc = await InstitutionGradingPolicy.getPolicy();
  const oldResolved = await getResolvedPolicyForCourse(null, { skipInstitution: false });
  const oldSnapshot = generateResolvedPolicySnapshot(oldResolved);

  doc.policy = sanitized;
  doc.version = (doc.version || 1) + 1;
  doc.updatedBy = userId;
  await doc.save();
  await require('./policyRedisCache.service').invalidateInstitutionPolicyCache();

  const newResolved = await getResolvedPolicyForCourse(null);
  const newSnapshot = generateResolvedPolicySnapshot(newResolved);

  await gradingPolicyAuditService.recordPolicyChange({
    actorId: userId,
    entityType: 'institution',
    entityId: 'default',
    oldPolicy: oldSnapshot.resolvedPolicySnapshot,
    newPolicy: newSnapshot.resolvedPolicySnapshot,
    reason: options.reason,
  });

  return doc;
}

async function getCoursePolicyDocument(courseId) {
  return CourseGradingPolicy.findByCourseId(courseId);
}

async function upsertCoursePolicy(courseId, payload, userId) {
  const gradeLifecycleService = require('./gradeLifecycle.service');
  await gradeLifecycleService.assertCanMutateCoursePolicy(courseId);

  const policyPart = payload.policy ? sanitizeGradingPolicy(payload.policy) : null;
  if (policyPart) {
    const validation = validateGradingPolicy(policyPart);
    if (!validation.valid) {
      const err = new Error(validation.errors.join('; '));
      err.statusCode = 400;
      throw err;
    }
  }

  let doc = await CourseGradingPolicy.findOne({ course: courseId });
  const Course = require('../models/course.model');
  const course = await Course.findById(courseId).lean();
  const oldResolved = course ? await getResolvedPolicyForCourse(course) : null;
  const oldSnapshot = oldResolved ? generateResolvedPolicySnapshot(oldResolved) : null;

  if (!doc) {
    doc = new CourseGradingPolicy({ course: courseId });
  }

  if (policyPart) {
    doc.policy = deepMergePolicy(
      doc.policy && Object.keys(doc.policy).length ? doc.policy : DEFAULT_GRADING_POLICY,
      policyPart
    );
  }
  if (payload.groups) doc.groups = payload.groups;
  if (payload.gradeScale) doc.gradeScale = payload.gradeScale;
  doc.version = (doc.version || 0) + 1;
  doc.updatedBy = userId;
  await doc.save();
  await require('./policyRedisCache.service').invalidateCoursePolicyCache(courseId);
  const saved = doc.toObject();

  if (course && oldSnapshot) {
    const newResolved = await getResolvedPolicyForCourse(course);
    const newSnapshot = generateResolvedPolicySnapshot(newResolved);
    await gradingPolicyAuditService.recordPolicyChange({
      actorId: userId,
      entityType: 'course',
      entityId: courseId,
      oldPolicy: oldSnapshot.resolvedPolicySnapshot,
      newPolicy: newSnapshot.resolvedPolicySnapshot,
      reason: payload.reason,
    });
  }

  return saved;
}

/**
 * Effective policy breakdown for debugging / audit UI.
 */
async function getEffectivePolicyBreakdown(course) {
  const coursePlain = course?.toObject ? course.toObject() : course;
  const [institutionDoc, coursePolicyDoc] = await Promise.all([
    InstitutionGradingPolicy.getPolicy().catch(() => null),
    coursePlain?._id ? CourseGradingPolicy.findByCourseId(coursePlain._id) : null,
  ]);

  const institutionPolicy = institutionDoc
    ? { policy: institutionDoc.policy, version: institutionDoc.version }
    : null;
  const coursePolicy = coursePolicyDoc || null;

  const resolved = resolveGradingPolicy({
    course: coursePlain,
    institutionPolicy,
    coursePolicy,
    teacherPolicy: null,
  });

  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  return {
    institutionPolicy: institutionDoc
      ? { version: institutionDoc.version, policy: institutionDoc.policy }
      : null,
    coursePolicy: coursePolicyDoc,
    resolvedPolicy: resolved,
    resolvedPolicyHash: snapshotBundle.policyHash,
    resolvedPolicyVersion: snapshotBundle.policyVersion,
    resolvedPolicySnapshot: snapshotBundle.resolvedPolicySnapshot,
  };
}

module.exports = {
  getResolvedPolicyForCourse,
  getCourseGradingContext,
  getInstitutionPolicyDocument,
  updateInstitutionPolicy,
  getCoursePolicyDocument,
  upsertCoursePolicy,
  getEffectivePolicyBreakdown,
};
