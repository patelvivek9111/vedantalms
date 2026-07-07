const Course = require('../models/course.model');
const CourseGradingPolicy = require('../models/courseGradingPolicy.model');
const InstitutionGradingPolicy = require('../models/institutionGradingPolicy.model');
const User = require('../models/user.model');
const { resolveGradingPolicy, courseContextFromResolvedPolicy } = require('../shared/grading/policyResolver.cjs');
const {
  validateGradingPolicy,
  sanitizeGradingPolicy,
  deepMergePolicy,
} = require('../shared/grading/policyValidation.cjs');
const { DEFAULT_GRADING_POLICY } = require('../shared/grading/policyDefaults.cjs');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { diffPolicies, summarizePolicyDiff } = require('../shared/grading/policyDiff.cjs');
const {
  normalizeApplyMode,
  enrichResolvedForAssignmentOrder,
  buildPreviewPolicyApplication,
} = require('../shared/grading/policyApplication.cjs');
const { computeDualGradeTotals } = require('./gradeCalculation.service');
const gradingPolicyService = require('./gradingPolicy.service');
const gradeLifecycleService = require('./gradeLifecycle.service');
const {
  loadCourseGradeAssignments,
  buildStudentGradeInputs,
} = require('./gradeCalculationInputs.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

const ROUND = (n) => Math.round(n * 100) / 100;

function normalizeStudentId(id) {
  if (id && typeof id === 'object' && id._id) return String(id._id);
  return String(id);
}

/**
 * Resolve policy as it would be after a course policy upsert (without persisting).
 */
async function buildProposedResolvedPolicy(course, payload = {}) {
  const courseId = course._id || course.id;
  const coursePlain = course?.toObject ? course.toObject() : course;

  const [institutionPolicy, coursePolicyDoc] = await Promise.all([
    InstitutionGradingPolicy.getPolicy().catch(() => null),
    CourseGradingPolicy.findByCourseId(courseId),
  ]);

  let mergedPolicy = coursePolicyDoc?.policy;
  if (mergedPolicy && Object.keys(mergedPolicy).length === 0) mergedPolicy = null;

  if (payload.policy) {
    const sanitized = sanitizeGradingPolicy(payload.policy);
    mergedPolicy = deepMergePolicy(
      mergedPolicy && Object.keys(mergedPolicy).length ? mergedPolicy : DEFAULT_GRADING_POLICY,
      sanitized
    );
  }

  const courseForResolve = { ...coursePlain };
  if (payload.groups) courseForResolve.groups = payload.groups;
  if (payload.gradeScale) courseForResolve.gradeScale = payload.gradeScale;

  const proposedCoursePolicy =
    mergedPolicy || payload.groups || payload.gradeScale || payload.applyMode
      ? {
          policy: mergedPolicy || undefined,
          groups: payload.groups ?? coursePolicyDoc?.groups,
          gradeScale: payload.gradeScale ?? coursePolicyDoc?.gradeScale,
          applyMode: payload.applyMode ?? coursePolicyDoc?.applyMode,
          effectiveAt:
            payload.effectiveAt !== undefined
              ? payload.effectiveAt
              : coursePolicyDoc?.effectiveAt,
          effectiveAssignmentId:
            payload.effectiveAssignmentId ?? coursePolicyDoc?.effectiveAssignmentId,
          version: (coursePolicyDoc?.version || 0) + 1,
        }
      : coursePolicyDoc;

  return resolveGradingPolicy({
    course: courseForResolve,
    institutionPolicy: institutionPolicy
      ? { policy: institutionPolicy.policy, version: institutionPolicy.version }
      : null,
    coursePolicy: proposedCoursePolicy,
  });
}

function gradeRowChanged(currentPercent, proposedPercent, currentLetter, proposedLetter) {
  if (currentLetter !== proposedLetter) return true;
  return Math.abs(proposedPercent - currentPercent) >= 0.005;
}

function withApplyModeForPreview(
  proposedResolved,
  currentResolved,
  applyMode,
  effectiveAt,
  effectiveAssignmentId,
  assignmentOrder
) {
  const policyApplication = buildPreviewPolicyApplication({
    applyMode,
    currentResolved,
    effectiveAt,
    effectiveAssignmentId,
    assignmentOrder,
  });
  return {
    ...proposedResolved,
    policyApplication,
  };
}

async function computeStudentGradePair(
  course,
  studentId,
  assignmentCatalog,
  currentResolved,
  proposedResolved,
  applyMode = 'retroactive_all',
  effectiveAt = null,
  effectiveAssignmentId = null
) {
  const sid = normalizeStudentId(studentId);
  const { allAssignments, grades, submissionMap } = await buildStudentGradeInputs(
    course,
    sid,
    assignmentCatalog,
    'instructor'
  );

  const assignmentOrder = assignmentCatalog.map((a) => String(a._id));
  const proposedForCalc = enrichResolvedForAssignmentOrder(
    withApplyModeForPreview(
      proposedResolved,
      currentResolved,
      applyMode,
      effectiveAt,
      effectiveAssignmentId,
      assignmentOrder
    ),
    assignmentCatalog
  );

  const currentForCalc = enrichResolvedForAssignmentOrder(currentResolved, assignmentCatalog);
  const currentCtx = courseContextFromResolvedPolicy(currentForCalc);
  const proposedCtx = courseContextFromResolvedPolicy(proposedForCalc);

  const current = computeDualGradeTotals(
    sid,
    currentCtx,
    allAssignments,
    grades,
    submissionMap,
    currentForCalc
  );
  const proposed = computeDualGradeTotals(
    sid,
    proposedCtx,
    allAssignments,
    grades,
    submissionMap,
    proposedForCalc
  );

  return { current, proposed };
}

/**
 * Dry-run proposed course policy against enrolled students (instructor visibility).
 */
async function previewCoursePolicyImpact(courseId, payload = {}, options = {}) {
  if (payload.policy) {
    const validation = validateGradingPolicy(payload.policy);
    if (!validation.valid) {
      const err = new Error(validation.errors.join('; '));
      err.statusCode = 400;
      throw err;
    }
  }

  const course = await Course.findById(courseId).select('students instructor groups gradeScale semester createdAt').lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }

  const studentIds = (options.studentIds || course.students || []).map(normalizeStudentId);
  const filterSet =
    payload.studentIds && payload.studentIds.length > 0
      ? new Set(payload.studentIds.map(String))
      : null;
  const targetIds = filterSet
    ? studentIds.filter((id) => filterSet.has(id))
    : studentIds;

  const [currentResolved, assignmentCatalog] = await Promise.all([
    gradingPolicyService.getResolvedPolicyForCourse(course, { policyCache: options.policyCache }),
    loadCourseGradeAssignments(courseId),
  ]);

  const hasProposal = Boolean(payload.policy || payload.groups || payload.gradeScale);
  const proposedResolved = hasProposal
    ? await buildProposedResolvedPolicy(course, payload)
    : currentResolved;

  const currentSnapshot = generateResolvedPolicySnapshot(currentResolved);
  const proposedSnapshot = generateResolvedPolicySnapshot(proposedResolved);

  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await gradeLifecycleService.getLifecycle(courseId, term, year);
  const lifecycleStatus = lifecycle?.status || 'DRAFT';

  const policyDiff = diffPolicies(
    currentSnapshot.resolvedPolicySnapshot,
    proposedSnapshot.resolvedPolicySnapshot
  );

  const applyMode = normalizeApplyMode(payload.applyMode);
  const previewEffectiveAt = payload.effectiveAt || new Date().toISOString();
  const previewAssignmentId = payload.effectiveAssignmentId || null;

  if (applyMode === 'from_assignment' && hasProposal && !previewAssignmentId) {
    const err = new Error('effectiveAssignmentId is required for from_assignment impact preview.');
    err.statusCode = 400;
    throw err;
  }

  const assignmentOptions = assignmentCatalog.map((a) => ({
    id: String(a._id),
    title: a.title || String(a._id),
    group: a.group || '',
  }));

  const users =
    targetIds.length > 0
      ? await User.find({ _id: { $in: targetIds } })
          .select('firstName lastName email')
          .lean()
      : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const students = [];
  let affectedCount = 0;
  let maxDeltaPercent = 0;
  let letterChanges = 0;

  for (const studentId of targetIds) {
    const { current, proposed } = await computeStudentGradePair(
      course,
      studentId,
      assignmentCatalog,
      currentResolved,
      proposedResolved,
      applyMode,
      previewEffectiveAt,
      previewAssignmentId
    );

    const currentPercent = ROUND(current.currentPercent);
    const proposedPercent = ROUND(proposed.currentPercent);
    const deltaPercent = ROUND(proposedPercent - currentPercent);
    const currentLetter = current.letterGrade;
    const proposedLetter = proposed.letterGrade;
    const changed = gradeRowChanged(
      currentPercent,
      proposedPercent,
      currentLetter,
      proposedLetter
    );

    if (changed) {
      affectedCount += 1;
      if (currentLetter !== proposedLetter) letterChanges += 1;
      const absDelta = Math.abs(deltaPercent);
      if (absDelta > maxDeltaPercent) maxDeltaPercent = absDelta;
    }

    const user = userById.get(studentId);
    const displayName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
      : studentId;

    students.push({
      studentId,
      displayName,
      email: user?.email || null,
      currentPercent,
      proposedPercent,
      deltaPercent,
      currentLetter,
      proposedLetter,
      changed,
    });
  }

  students.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));

  return {
    applyMode,
    effectiveAt: applyMode === 'prospective_only' ? previewEffectiveAt : null,
    effectiveAssignmentId: applyMode === 'from_assignment' ? previewAssignmentId : null,
    lifecycleStatus,
    currentPolicyHash: currentSnapshot.policyHash,
    proposedPolicyHash: proposedSnapshot.policyHash,
    policyUnchanged: currentSnapshot.policyHash === proposedSnapshot.policyHash,
    policyDiff: {
      changed: policyDiff.changed,
      added: policyDiff.added,
      removed: policyDiff.removed,
      summaryLines: summarizePolicyDiff(policyDiff),
    },
    summary: {
      studentCount: targetIds.length,
      affectedCount,
      unchangedCount: targetIds.length - affectedCount,
      maxDeltaPercent: ROUND(maxDeltaPercent),
      letterChanges,
    },
    students,
    assignments: assignmentOptions,
  };
}

module.exports = {
  buildProposedResolvedPolicy,
  previewCoursePolicyImpact,
};
