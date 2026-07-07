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
const {
  normalizeApplyMode,
  structuralPolicyPayload,
  stripPolicyApplication,
} = require('../shared/grading/policyApplication.cjs');

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
    try {
      const policyRedisCache = require('./policyRedisCache.service');
      const cached = await Promise.race([
        policyRedisCache.getCachedResolvedPolicy(courseId),
        new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (cached) {
        if (cache) cache.set(String(courseId), cached);
        return cached;
      }
    } catch {
      /* fall through to DB */
    }
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
    try {
      const policyRedisCache = require('./policyRedisCache.service');
      await Promise.race([
        policyRedisCache.setCachedResolvedPolicy(courseId, resolved),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch {
      /* ignore cache write failures */
    }
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

  const applyMode = normalizeApplyMode(
    payload.applyMode !== undefined ? payload.applyMode : doc.applyMode
  );
  if (structuralPolicyPayload(payload) && applyMode !== 'retroactive_all') {
    const err = new Error(
      'Group weight or grade scale changes require retroactive apply mode.'
    );
    err.statusCode = 400;
    throw err;
  }

  const policyChanging = Boolean(policyPart || payload.groups || payload.gradeScale);
  if (payload.applyMode !== undefined || policyChanging) {
    doc.applyMode = applyMode;
  }
  if (!doc.applyMode) doc.applyMode = 'retroactive_all';

  if (applyMode === 'from_assignment' && policyChanging) {
    if (!payload.effectiveAssignmentId) {
      const err = new Error('effectiveAssignmentId is required for from_assignment apply mode.');
      err.statusCode = 400;
      throw err;
    }
    doc.effectiveAssignmentId = payload.effectiveAssignmentId;
    doc.effectiveAt = null;
    if (oldSnapshot) doc.legacyPolicySnapshot = oldSnapshot.resolvedPolicySnapshot;
  } else if (applyMode === 'prospective_only' && policyChanging) {
    doc.effectiveAt = payload.effectiveAt ? new Date(payload.effectiveAt) : new Date();
    doc.effectiveAssignmentId = null;
    if (oldSnapshot) doc.legacyPolicySnapshot = oldSnapshot.resolvedPolicySnapshot;
  }

  if (applyMode === 'retroactive_all') {
    doc.effectiveAt = null;
    doc.effectiveAssignmentId = null;
    doc.legacyPolicySnapshot = null;
  }

  doc.version = (doc.version || 0) + 1;
  doc.updatedBy = userId;
  await doc.save();
  await require('./policyRedisCache.service').invalidateCoursePolicyCache(courseId);
  await require('./workflowCache.service').invalidateAllStudentCourseGrades(courseId);
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
      applyMode: doc.applyMode,
      effectiveAt: doc.effectiveAt,
      impactSummary: payload.impactSummary || undefined,
    });
  }

  return saved;
}

/**
 * Courses that would recalculate on next grade view after an institution policy change.
 */
async function getInstitutionPolicyImpactSummary() {
  const Course = require('../models/course.model');
  const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');

  const publishedCourses = await Course.find({ published: true }).select('_id').lean();
  const courseIds = publishedCourses.map((c) => c._id);
  if (!courseIds.length) {
    return {
      totalPublishedCourses: 0,
      finalizedCourseCount: 0,
      liveRecalcCourseCount: 0,
    };
  }

  const finalizedCourseIds = await CourseGradeLifecycle.find({
    course: { $in: courseIds },
    status: { $in: ['FINALIZED', 'AMENDED'] },
  }).distinct('course');
  const finalizedSet = new Set(finalizedCourseIds.map(String));
  const liveRecalcCourseCount = courseIds.filter((id) => !finalizedSet.has(String(id))).length;

  return {
    totalPublishedCourses: courseIds.length,
    finalizedCourseCount: finalizedSet.size,
    liveRecalcCourseCount,
  };
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
  getInstitutionPolicyImpactSummary,
};
