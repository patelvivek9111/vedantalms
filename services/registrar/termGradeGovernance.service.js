const AcademicTerm = require('../../models/academicTerm.model');
const Course = require('../../models/course.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
const CourseGradingPeriod = require('../../models/courseGradingPeriod.model');
const InstitutionGradingPeriod = require('../../models/institutionGradingPeriod.model');
const GradeAmendmentRecord = require('../../models/gradeAmendmentRecord.model');
const GradingPolicyAudit = require('../../models/gradingPolicyAudit.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const gradeLifecycleService = require('../gradeLifecycle.service');
const academicAuditService = require('../academicAudit.service');

async function assertTerm(tenantId, termId) {
  const term = await AcademicTerm.findOne(withTenantFilter({ _id: termId }, tenantId)).lean();
  if (!term) {
    const err = new Error('Term not found');
    err.status = 404;
    throw err;
  }
  return term;
}

async function listCoursesForTerm(tenantId, termId) {
  return Course.find(withTenantFilter({ academicTermId: termId }, tenantId))
    .select('title catalog academicTermId sectionNumber students semester')
    .lean();
}

async function buildGradeStatusRows(tenantId, term, courses) {
  const courseIds = courses.map((c) => c._id);
  const lifecycles = courseIds.length
    ? await CourseGradeLifecycle.find(withTenantFilter({ course: { $in: courseIds } }, tenantId)).lean()
    : [];
  const lifeByCourse = new Map(lifecycles.map((l) => [String(l.course), l]));

  const rows = courses.map((c) => {
    const life = lifeByCourse.get(String(c._id));
    return {
      courseId: String(c._id),
      title: c.title,
      courseCode: c.catalog?.courseCode || '',
      sectionNumber: c.sectionNumber || '',
      studentCount: (c.students || []).length,
      lifecycleStatus: life?.status || 'NONE',
      finalizedAt: life?.finalizedAt || null,
      studentSnapshotCount: life?.studentSnapshotCount || 0,
      policyHash: life?.policyHash || null,
      term: life?.term || term.legacyTermLabel || term.code,
      year: life?.year || term.legacyYear || null,
    };
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.lifecycleStatus] = (acc[r.lifecycleStatus] || 0) + 1;
    return acc;
  }, {});

  return { rows, counts };
}

async function previewTermFinalize(tenantId, termId) {
  const term = await assertTerm(tenantId, termId);
  const courses = await listCoursesForTerm(tenantId, termId);
  const { rows, counts } = await buildGradeStatusRows(tenantId, term, courses);

  const ready = rows.filter((r) => !['FINALIZED', 'AMENDED'].includes(r.lifecycleStatus));
  const alreadyFinalized = rows.filter((r) => ['FINALIZED', 'AMENDED'].includes(r.lifecycleStatus));
  const missingSnapshots = alreadyFinalized.filter((r) => !r.studentSnapshotCount);

  return {
    term: { _id: term._id, name: term.name, code: term.code, status: term.status },
    counts,
    totalCourses: rows.length,
    toFinalize: ready.length,
    alreadyFinalized: alreadyFinalized.length,
    missingSnapshots: missingSnapshots.length,
    rows,
    readyCourseIds: ready.map((r) => r.courseId),
  };
}

async function finalizeCoursesInTerm({ tenantId, termId, user, courseIds = null }) {
  const preview = await previewTermFinalize(tenantId, termId);
  const targetIds = courseIds?.length
    ? preview.readyCourseIds.filter((id) => courseIds.map(String).includes(String(id)))
    : preview.readyCourseIds;

  const results = [];
  for (const courseId of targetIds) {
    try {
      const result = await gradeLifecycleService.transitionToFinalized(courseId, user);
      await academicAuditService.recordAuditEvent({
        actorId: user._id,
        entityType: 'academic_term',
        entityId: termId,
        action: 'registrar.grades.finalized',
        after: {
          courseId,
          frozenCount: result.frozenCount,
          idempotent: result.idempotent,
        },
        severity: 'critical',
        rootAccountId: tenantId,
        metadata: { termId: String(termId), courseId: String(courseId) },
      });
      results.push({
        courseId,
        ok: true,
        frozenCount: result.frozenCount,
        idempotent: result.idempotent,
      });
    } catch (err) {
      results.push({ courseId, ok: false, message: err.message });
    }
  }

  return {
    termId,
    finalized: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

async function getTermGradesDashboard(tenantId, termId) {
  const preview = await previewTermFinalize(tenantId, termId);
  const courseIds = preview.rows.map((r) => r.courseId);

  const [amendments, policyChanges, openPeriods] = await Promise.all([
    courseIds.length
      ? GradeAmendmentRecord.find({ course: { $in: courseIds } })
          .sort({ createdAt: -1 })
          .limit(25)
          .populate('course', 'title catalog.courseCode')
          .populate('amendedBy', 'firstName lastName email')
          .lean()
      : [],
    GradingPolicyAudit.find(
      tenantId
        ? { $or: [{ rootAccountId: tenantId }, { 'meta.rootAccountId': tenantId }] }
        : {}
    )
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('actor', 'email')
      .lean(),
    InstitutionGradingPeriod.find(
      withTenantFilter({ academicTermId: termId, status: 'open' }, tenantId)
    )
      .sort({ position: 1 })
      .lean(),
  ]);

  const finalizedAtDates = preview.rows
    .map((r) => (r.finalizedAt ? new Date(r.finalizedAt).getTime() : null))
    .filter(Boolean);
  const earliestFinalize = finalizedAtDates.length ? new Date(Math.min(...finalizedAtDates)) : null;

  const policySinceFinalize = earliestFinalize
    ? policyChanges.filter((p) => new Date(p.createdAt) > earliestFinalize)
    : policyChanges;

  const missingSnapshots = preview.rows.filter(
    (r) => ['FINALIZED', 'AMENDED'].includes(r.lifecycleStatus) && !r.studentSnapshotCount
  );

  return {
    ...preview,
    widgets: {
      unfinalized: preview.toFinalize,
      amendmentsThisTerm: amendments.length,
      missingSnapshots: missingSnapshots.length,
      policyChangesSinceFinalize: policySinceFinalize.length,
      openInstitutionPeriods: openPeriods.length,
    },
    amendments,
    policyChangesSinceFinalize: policySinceFinalize,
    openInstitutionPeriods: openPeriods,
    missingSnapshotRows: missingSnapshots,
  };
}

async function listInstitutionPeriods(tenantId, termId) {
  await assertTerm(tenantId, termId);
  return InstitutionGradingPeriod.find(withTenantFilter({ academicTermId: termId }, tenantId))
    .sort({ position: 1 })
    .lean();
}

async function createInstitutionPeriod(tenantId, termId, body, user) {
  await assertTerm(tenantId, termId);
  const period = await InstitutionGradingPeriod.create({
    academicTermId: termId,
    name: String(body.name || '').trim(),
    position: body.position ?? 0,
    startDate: body.startDate || null,
    endDate: body.endDate || null,
    closeDate: body.closeDate || null,
    weight: body.weight ?? null,
    status: body.status === 'closed' ? 'closed' : 'open',
    rootAccountId: tenantId,
    accountId: tenantId,
  });
  return period;
}

async function updateInstitutionPeriod(tenantId, periodId, body) {
  const period = await InstitutionGradingPeriod.findOne(
    withTenantFilter({ _id: periodId }, tenantId)
  );
  if (!period) {
    const err = new Error('Grading period not found');
    err.status = 404;
    throw err;
  }
  for (const key of ['name', 'position', 'startDate', 'endDate', 'closeDate', 'weight', 'status']) {
    if (body[key] !== undefined) period[key] = body[key];
  }
  await period.save();
  return period;
}

async function closeInstitutionPeriod(tenantId, periodId, user) {
  const period = await InstitutionGradingPeriod.findOne(
    withTenantFilter({ _id: periodId }, tenantId)
  );
  if (!period) {
    const err = new Error('Grading period not found');
    err.status = 404;
    throw err;
  }
  period.status = 'closed';
  period.closedAt = new Date();
  period.closedBy = user._id;
  await period.save();

  // Mirror close onto matching course periods in the term (by name/position)
  const courses = await listCoursesForTerm(tenantId, period.academicTermId);
  const courseIds = courses.map((c) => c._id);
  if (courseIds.length) {
    await CourseGradingPeriod.updateMany(
      {
        course: { $in: courseIds },
        $or: [{ name: period.name }, { position: period.position }],
      },
      { $set: { closed: true, closeDate: period.closeDate || new Date() } }
    );
  }

  return period;
}

/**
 * Copy institution grading periods onto courses in the term that lack periods.
 */
async function inheritPeriodsToTermCourses(tenantId, termId) {
  const periods = await listInstitutionPeriods(tenantId, termId);
  if (!periods.length) {
    return { applied: 0, courses: 0, message: 'No institution periods to inherit' };
  }
  const courses = await listCoursesForTerm(tenantId, termId);
  let applied = 0;
  for (const course of courses) {
    const existing = await CourseGradingPeriod.countDocuments({ course: course._id });
    if (existing > 0) continue;
    for (const p of periods) {
      await CourseGradingPeriod.create({
        course: course._id,
        name: p.name,
        position: p.position,
        startDate: p.startDate,
        endDate: p.endDate,
        closeDate: p.closeDate,
        closed: p.status === 'closed',
        weight: p.weight,
        rootAccountId: tenantId,
      });
      applied += 1;
    }
  }
  return { applied, courses: courses.length, periodTemplates: periods.length };
}

module.exports = {
  previewTermFinalize,
  finalizeCoursesInTerm,
  getTermGradesDashboard,
  listInstitutionPeriods,
  createInstitutionPeriod,
  updateInstitutionPeriod,
  closeInstitutionPeriod,
  inheritPeriodsToTermCourses,
  buildGradeStatusRows,
  listCoursesForTerm,
};
