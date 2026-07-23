const CourseSection = require('../../models/courseSection.model');
const CourseOffering = require('../../models/courseOffering.model');
const CrossListGroup = require('../../models/crossListGroup.model');
const Course = require('../../models/course.model');
const Enrollment = require('../../models/enrollment.model');
const User = require('../../models/user.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const { accountSubtreeFilter, ensureOfferingAndSectionForCourse } = require('../tenancy/academicStructure.service');
const academicAuditService = require('../academicAudit.service');

/**
 * Scope filter for department_admin (account subtree) or optional accountId query.
 */
async function resolveDeptScopeFilter(tenantId, user, accountIdQuery) {
  if (accountIdQuery) {
    return accountSubtreeFilter(tenantId, accountIdQuery);
  }
  if (
    user?.role === 'department_admin' &&
    user.accountId &&
    tenantId &&
    String(user.accountId) !== String(tenantId)
  ) {
    return accountSubtreeFilter(tenantId, user.accountId);
  }
  return withTenantFilter({}, tenantId);
}

async function listSectionsScoped({
  tenantId,
  user,
  termId,
  offeringId,
  status,
  accountId,
  search,
  limit = 500,
}) {
  const filter = await resolveDeptScopeFilter(tenantId, user, accountId);
  if (termId) filter.academicTermId = termId;
  if (offeringId) filter.offeringId = offeringId;
  if (status && status !== 'all') filter.status = status;

  let sections = await CourseSection.find(filter)
    .populate('offeringId', 'courseCode title credits accountId')
    .populate('academicTermId', 'name code status')
    .populate('instructorId', 'firstName lastName email')
    .populate('lmsCourseId', 'title published students')
    .sort({ sectionNumber: 1 })
    .limit(Math.min(Number(limit) || 500, 1000))
    .lean();

  if (search) {
    const q = String(search).toLowerCase();
    sections = sections.filter((s) => {
      const code = s.offeringId?.courseCode || '';
      const title = s.offeringId?.title || s.lmsCourseId?.title || '';
      return (
        String(s.sectionNumber).toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q) ||
        String(s.sisSectionId || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }

  return sections;
}

async function patchSection(tenantId, sectionId, body, actor) {
  const section = await CourseSection.findOne(withTenantFilter({ _id: sectionId }, tenantId));
  if (!section) {
    const err = new Error('Section not found');
    err.status = 404;
    throw err;
  }

  const before = {
    status: section.status,
    enrollmentMethod: section.enrollmentMethod,
    maxEnrollment: section.maxEnrollment,
  };

  const fields = [
    'sectionNumber',
    'instructorId',
    'teachingAssistantIds',
    'meetingPattern',
    'maxEnrollment',
    'minEnrollment',
    'enrollmentMethod',
    'status',
    'concludeDate',
    'sisSectionId',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) section[f] = body[f];
  }

  if (body.publish === true) section.status = 'published';
  if (body.conclude === true) {
    section.status = 'concluded';
    section.concludeDate = body.concludeDate ? new Date(body.concludeDate) : new Date();
  }
  if (body.cancel === true) section.status = 'cancelled';

  await section.save();

  if (section.lmsCourseId && (body.publish === true || body.status === 'published')) {
    await Course.updateOne(
      withTenantFilter({ _id: section.lmsCourseId }, tenantId),
      { $set: { published: true } }
    );
  }
  if (section.lmsCourseId && (body.conclude === true || body.status === 'concluded')) {
    await Course.updateOne(
      withTenantFilter({ _id: section.lmsCourseId }, tenantId),
      { $set: { published: false } }
    );
  }

  await academicAuditService
    .recordAuditEvent({
      actorId: actor?._id || actor,
      entityType: 'course_section',
      entityId: section._id,
      action: 'registrar.section.updated',
      before,
      after: {
        status: section.status,
        enrollmentMethod: section.enrollmentMethod,
        maxEnrollment: section.maxEnrollment,
      },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { sectionId: String(section._id) },
    })
    .catch(() => {});

  return section.toObject();
}

async function exportSectionRosterCsv(tenantId, sectionId) {
  const section = await CourseSection.findOne(withTenantFilter({ _id: sectionId }, tenantId))
    .populate('offeringId', 'courseCode title')
    .lean();
  if (!section) {
    const err = new Error('Section not found');
    err.status = 404;
    throw err;
  }

  const enrollments = await Enrollment.find(
    withTenantFilter(
      {
        sectionId: section._id,
        status: { $in: ['active', 'completed', 'invited'] },
      },
      tenantId
    )
  )
    .populate('studentId', 'firstName lastName email studentProfile')
    .lean();

  // Fallback: course roster when no section-scoped enrollments
  let rows = enrollments;
  if (!rows.length && section.lmsCourseId) {
    const course = await Course.findById(section.lmsCourseId).select('students').lean();
    const students = course?.students?.length
      ? await User.find({ _id: { $in: course.students } })
          .select('firstName lastName email studentProfile')
          .lean()
      : [];
    rows = students.map((s) => ({
      studentId: s,
      status: 'active',
      role: 'student',
    }));
  }

  const headers = [
    'section_number',
    'course_code',
    'email',
    'first_name',
    'last_name',
    'sis_id',
    'status',
    'role',
  ];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    const s = r.studentId || {};
    lines.push(
      [
        section.sectionNumber,
        section.offeringId?.courseCode || '',
        s.email || '',
        s.firstName || '',
        s.lastName || '',
        s.studentProfile?.externalIds?.sis || '',
        r.status || 'active',
        r.role || 'student',
      ]
        .map(escape)
        .join(',')
    );
  }
  return {
    csvText: lines.join('\n'),
    count: rows.length,
    section,
  };
}

/**
 * Product default: shared gradebook / shared content (sharedGradebook: true).
 * Shared: all member sections point lmsCourseId → primary's content course.
 * Split: leave each section's lmsCourseId; group is organizational only.
 */
async function createCrossListGroup({
  tenantId,
  accountId,
  name,
  sectionIds,
  primarySectionId,
  sharedGradebook = true,
  sharedContentCourseId = null,
  actorId,
}) {
  if (!name || !Array.isArray(sectionIds) || sectionIds.length < 2) {
    const err = new Error('name and at least two sectionIds are required');
    err.status = 400;
    throw err;
  }

  const sections = await CourseSection.find(
    withTenantFilter({ _id: { $in: sectionIds } }, tenantId)
  );
  if (sections.length !== sectionIds.length) {
    const err = new Error('One or more sections not found');
    err.status = 400;
    throw err;
  }

  const primaryId = primarySectionId || sectionIds[0];
  const primary = sections.find((s) => String(s._id) === String(primaryId)) || sections[0];
  const contentCourseId =
    sharedContentCourseId || primary.lmsCourseId || sections.find((s) => s.lmsCourseId)?.lmsCourseId || null;

  const group = await CrossListGroup.create({
    name: String(name).trim(),
    sectionIds,
    primarySectionId: primary._id,
    sharedGradebook: sharedGradebook !== false,
    sharedContentCourseId: contentCourseId,
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
  });

  for (const section of sections) {
    section.crossListGroupId = group._id;
    section.primarySectionId = primary._id;
    if (group.sharedGradebook && contentCourseId) {
      section.lmsCourseId = contentCourseId;
    }
    await section.save();
  }

  if (group.sharedGradebook && contentCourseId) {
    await Course.updateMany(
      withTenantFilter({ sectionId: { $in: sectionIds } }, tenantId),
      {
        $set: {
          // Keep each course doc; teaching content root is shared via section.lmsCourseId
        },
      }
    );
    // Point member courses' teaching link: update Course.section links stay; content used is section.lmsCourseId
    for (const section of sections) {
      if (section._id.equals(primary._id)) continue;
      // Optional: leave Course docs; roster reads Enrollment.sectionId
    }
  }

  await academicAuditService
    .recordAuditEvent({
      actorId,
      entityType: 'cross_list_group',
      entityId: group._id,
      action: 'registrar.crosslist.created',
      after: {
        name: group.name,
        sharedGradebook: group.sharedGradebook,
        sectionCount: sectionIds.length,
        sharedContentCourseId: contentCourseId ? String(contentCourseId) : null,
      },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { groupId: String(group._id) },
    })
    .catch(() => {});

  return group.toObject();
}

async function listCrossLists(tenantId, { limit = 100 } = {}) {
  return CrossListGroup.find(withTenantFilter({}, tenantId))
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 200))
    .populate('primarySectionId', 'sectionNumber lmsCourseId')
    .lean();
}

async function getCrossList(tenantId, id) {
  const group = await CrossListGroup.findOne(withTenantFilter({ _id: id }, tenantId)).lean();
  if (!group) {
    const err = new Error('Cross-list not found');
    err.status = 404;
    throw err;
  }
  const sections = await CourseSection.find(
    withTenantFilter({ _id: { $in: group.sectionIds } }, tenantId)
  )
    .populate('offeringId', 'courseCode title')
    .populate('lmsCourseId', 'title')
    .lean();
  return { ...group, sections };
}

async function updateCrossList(tenantId, id, body, actorId) {
  const group = await CrossListGroup.findOne(withTenantFilter({ _id: id }, tenantId));
  if (!group) {
    const err = new Error('Cross-list not found');
    err.status = 404;
    throw err;
  }
  if (body.name !== undefined) group.name = String(body.name).trim();
  if (body.sharedGradebook !== undefined) group.sharedGradebook = Boolean(body.sharedGradebook);
  if (body.primarySectionId) group.primarySectionId = body.primarySectionId;
  if (body.sharedContentCourseId !== undefined) {
    group.sharedContentCourseId = body.sharedContentCourseId;
  }
  await group.save();

  if (group.sharedGradebook && group.sharedContentCourseId) {
    await CourseSection.updateMany(
      withTenantFilter({ _id: { $in: group.sectionIds } }, tenantId),
      {
        $set: {
          lmsCourseId: group.sharedContentCourseId,
          primarySectionId: group.primarySectionId,
          crossListGroupId: group._id,
        },
      }
    );
  }

  await academicAuditService
    .recordAuditEvent({
      actorId,
      entityType: 'cross_list_group',
      entityId: group._id,
      action: 'registrar.crosslist.updated',
      after: {
        sharedGradebook: group.sharedGradebook,
        sharedContentCourseId: group.sharedContentCourseId
          ? String(group.sharedContentCourseId)
          : null,
      },
      severity: 'info',
      rootAccountId: tenantId,
    })
    .catch(() => {});

  return group.toObject();
}

/**
 * M3 polish: ensure published courses have offering + section; report gaps.
 */
async function backfillMissingStructure(tenantId, { limit = 200 } = {}) {
  const courses = await Course.find(
    withTenantFilter(
      {
        published: true,
        $or: [{ offeringId: null }, { offeringId: { $exists: false } }, { sectionId: null }, { sectionId: { $exists: false } }],
      },
      tenantId
    )
  )
    .limit(limit)
    .exec();

  const results = [];
  for (const course of courses) {
    try {
      const linked = await ensureOfferingAndSectionForCourse(course);
      results.push({
        courseId: String(course._id),
        ok: true,
        offeringId: linked.offering?._id,
        sectionId: linked.section?._id,
      });
    } catch (err) {
      results.push({ courseId: String(course._id), ok: false, message: err.message });
    }
  }
  return {
    scanned: courses.length,
    fixed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

async function structureGapReport(tenantId) {
  const missing = await Course.countDocuments(
    withTenantFilter(
      {
        published: true,
        $or: [{ offeringId: null }, { offeringId: { $exists: false } }, { sectionId: null }, { sectionId: { $exists: false } }],
      },
      tenantId
    )
  );
  const totalPublished = await Course.countDocuments(
    withTenantFilter({ published: true }, tenantId)
  );
  const sections = await CourseSection.countDocuments(withTenantFilter({}, tenantId));
  const offerings = await CourseOffering.countDocuments(withTenantFilter({}, tenantId));
  const crossLists = await CrossListGroup.countDocuments(withTenantFilter({}, tenantId));
  return {
    totalPublished,
    missingStructure: missing,
    sections,
    offerings,
    crossLists,
    contentRootNote:
      'Content root is Course via section.lmsCourseId; cross-lists with sharedGradebook share primary content course.',
  };
}

module.exports = {
  resolveDeptScopeFilter,
  listSectionsScoped,
  patchSection,
  exportSectionRosterCsv,
  createCrossListGroup,
  listCrossLists,
  getCrossList,
  updateCrossList,
  backfillMissingStructure,
  structureGapReport,
};
