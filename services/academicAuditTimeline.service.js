const SystemAuditEvent = require('../models/systemAuditEvent.model');
const GradingPolicyAudit = require('../models/gradingPolicyAudit.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');
const AsyncJob = require('../models/asyncJob.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const gradeLifecycleService = require('./gradeLifecycle.service');
const gradingPolicyService = require('./gradingPolicy.service');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

function toTimelineEntry({ id, at, category, action, summary, actor, severity, metadata }) {
  return {
    id,
    at: at instanceof Date ? at.toISOString() : at,
    category,
    action,
    summary,
    actor: actor
      ? {
          id: actor._id,
          name: `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email,
          role: actor.role,
        }
      : null,
    severity: severity || 'info',
    metadata: metadata || null,
  };
}

async function getCourseGradeProvenance(course) {
  const courseId = course._id;
  const { term, year } = getSemesterFromCourse(course);
  let lifecycleDoc = await gradeLifecycleService.getLifecycle(courseId, term, year);
  if (!lifecycleDoc) {
    const created = await gradeLifecycleService.getOrCreateLifecycle(course);
    lifecycleDoc = created.toObject ? created.toObject() : created;
  }

  const breakdown = await gradingPolicyService.getEffectivePolicyBreakdown(course);

  const [currentSnapshots, historicalSnapshots] = await Promise.all([
    StudentCourseGradeSnapshot.countDocuments({
      course: courseId,
      term,
      year: Number(year),
      isCurrent: true,
    }),
    StudentCourseGradeSnapshot.countDocuments({
      course: courseId,
      term,
      year: Number(year),
      isCurrent: false,
    }),
  ]);

  const amendmentCount = await GradeAmendmentRecord.countDocuments({
    course: courseId,
    term,
    year: Number(year),
  });

  return {
    term,
    year,
    lifecycle: lifecycleDoc,
    gradingEngineVersion: getGradingEngineVersion(),
    lifecyclePolicyHash: lifecycleDoc?.policyHash || null,
    lifecyclePolicyVersion: lifecycleDoc?.policyVersion || null,
    effectivePolicyHash: breakdown.resolvedPolicyHash,
    effectivePolicyVersion: breakdown.resolvedPolicyVersion,
    policyChain: {
      institution: breakdown.institutionPolicy
        ? { version: breakdown.institutionPolicy.version }
        : null,
      course: breakdown.coursePolicy
        ? { version: breakdown.coursePolicy.version }
        : null,
      resolved: {
        version: breakdown.resolvedPolicyVersion,
        hash: breakdown.resolvedPolicyHash,
      },
    },
    snapshots: {
      current: currentSnapshots,
      superseded: historicalSnapshots,
    },
    amendmentCount,
  };
}

async function getCourseAuditTimeline(course, { limit = 100 } = {}) {
  const courseId = course._id;
  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await gradeLifecycleService.getOrCreateLifecycle(course);
  const lifecycleId = String(lifecycle._id);

  const [systemEvents, policyAudits, amendments, jobs] = await Promise.all([
    SystemAuditEvent.find({
      $or: [
        { entityType: 'course_grade_lifecycle', entityId: lifecycleId },
        { entityType: 'grade_amendment' },
        { 'metadata.courseId': String(courseId) },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'firstName lastName email role')
      .lean(),
    GradingPolicyAudit.find({ entityType: 'course', entityId: String(courseId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'firstName lastName email role')
      .lean(),
    GradeAmendmentRecord.find({ course: courseId, term, year: Number(year) })
      .sort({ sequence: -1 })
      .populate('amendedBy', 'firstName lastName email role')
      .lean(),
    AsyncJob.find({
      'payload.courseId': String(courseId),
      status: { $in: ['completed', 'failed'] },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('requestedBy', 'firstName lastName email role')
      .lean(),
  ]);

  const entries = [];

  for (const e of systemEvents) {
    entries.push(
      toTimelineEntry({
        id: `sys-${e._id}`,
        at: e.createdAt,
        category: 'system',
        action: e.action,
        summary: e.action.replace(/_/g, ' '),
        actor: e.actor,
        severity: e.severity,
        metadata: { before: e.before, after: e.after, ...e.metadata },
      })
    );
  }

  for (const a of policyAudits) {
    entries.push(
      toTimelineEntry({
        id: `policy-${a._id}`,
        at: a.createdAt,
        category: 'policy',
        action: 'grading_policy_changed',
        summary: `Course grading policy updated (v${a.oldHash?.slice(0, 8)} → v${a.newHash?.slice(0, 8)})`,
        actor: a.actor,
        severity: 'warning',
        metadata: {
          oldHash: a.oldHash,
          newHash: a.newHash,
          reason: a.reason,
          diffSummary: a.diffSummary,
        },
      })
    );
  }

  for (const am of amendments) {
    entries.push(
      toTimelineEntry({
        id: `amend-${am._id}`,
        at: am.createdAt,
        category: 'amendment',
        action: 'grades_amended',
        summary: `Amendment #${am.sequence}: ${am.reason}`,
        actor: am.amendedBy,
        severity: 'critical',
        metadata: {
          sequence: am.sequence,
          beforePolicyHash: am.beforePolicyHash,
          afterPolicyHash: am.afterPolicyHash,
          studentCount: am.studentCount,
        },
      })
    );
  }

  for (const j of jobs) {
    entries.push(
      toTimelineEntry({
        id: `job-${j._id}`,
        at: j.updatedAt || j.createdAt,
        category: 'job',
        action: j.type,
        summary: `Background job ${j.type} — ${j.status}`,
        actor: j.requestedBy,
        severity: j.status === 'failed' ? 'warning' : 'info',
        metadata: { status: j.status, result: j.result, error: j.error },
      })
    );
  }

  if (lifecycle.postedAt) {
    entries.push(
      toTimelineEntry({
        id: `lc-posted-${lifecycleId}`,
        at: lifecycle.postedAt,
        category: 'lifecycle',
        action: 'lifecycle_posted',
        summary: 'Grades posted to students',
        actor: null,
        severity: 'info',
      })
    );
  }
  if (lifecycle.finalizedAt) {
    entries.push(
      toTimelineEntry({
        id: `lc-finalized-${lifecycleId}`,
        at: lifecycle.finalizedAt,
        category: 'lifecycle',
        action: 'lifecycle_finalized',
        summary: `Grades finalized (${lifecycle.studentSnapshotCount || 0} snapshots)`,
        actor: null,
        severity: 'critical',
        metadata: {
          policyHash: lifecycle.policyHash,
          gradingEngineVersion: lifecycle.gradingEngineVersion,
        },
      })
    );
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return entries.slice(0, limit);
}

module.exports = {
  getCourseGradeProvenance,
  getCourseAuditTimeline,
};
