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
  crossListGroupId,
  lmsCourseId,
  includeStats = false,
  limit = 500,
}) {
  const filter = await resolveDeptScopeFilter(tenantId, user, accountId);
  if (termId) filter.academicTermId = termId;
  if (offeringId) filter.offeringId = offeringId;
  if (status && status !== 'all') filter.status = status;
  if (crossListGroupId) filter.crossListGroupId = crossListGroupId;
  if (lmsCourseId) filter.lmsCourseId = lmsCourseId;

  let sections = await CourseSection.find(filter)
    .populate('offeringId', 'courseCode title credits accountId')
    .populate('academicTermId', 'name code status')
    .populate('instructorId', 'firstName lastName email')
    .populate('lmsCourseId', 'title published students waitlist')
    .populate('previousLmsCourseId', 'title')
    .populate('crossListGroupId', 'name sharedGradebook sharedContentCourseId')
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

  const sectionIds = sections.map((s) => s._id);
  let enrolledBySection = new Map();
  if (includeStats && sectionIds.length) {
    const counts = await Enrollment.aggregate([
      {
        $match: {
          sectionId: { $in: sectionIds },
          status: { $in: ['active', 'invited'] },
        },
      },
      { $group: { _id: '$sectionId', count: { $sum: 1 } } },
    ]);
    enrolledBySection = new Map(counts.map((c) => [String(c._id), c.count]));
  }

  return sections.map((s) => {
    const group = s.crossListGroupId;
    const contentLinked = Boolean(s.lmsCourseId);
    const contentPublished = Boolean(s.lmsCourseId?.published);
    const crossListMode = group
      ? group.sharedGradebook === false
        ? 'split'
        : 'shared'
      : null;
    const enrolledCount = includeStats
      ? enrolledBySection.get(String(s._id)) || 0
      : undefined;
    const waitlistCount = includeStats
      ? Array.isArray(s.lmsCourseId?.waitlist)
        ? s.lmsCourseId.waitlist.length
        : 0
      : undefined;
    const publishMismatch =
      s.status === 'published' && contentLinked && !contentPublished
        ? 'section_published_content_draft'
        : s.status !== 'published' && contentPublished
          ? 'content_published_section_not'
          : null;

    return {
      ...s,
      contentLinked,
      contentPublished,
      crossListMode,
      enrolledCount,
      waitlistCount,
      publishMismatch,
      openCourseUrl: contentLinked ? `/courses/${s.lmsCourseId._id}` : null,
      openGradebookUrl: contentLinked ? `/courses/${s.lmsCourseId._id}/gradebook` : null,
      archiveCourseUrl: s.previousLmsCourseId
        ? `/courses/${s.previousLmsCourseId._id || s.previousLmsCourseId}`
        : null,
    };
  });
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
 * Preview content remount impact when creating/updating a shared cross-list.
 * Remount never merges grades — secondary courses become archives.
 */
async function previewCrossListRemount(tenantId, { sectionIds, primarySectionId, sharedGradebook = true } = {}) {
  if (sharedGradebook === false) {
    return {
      sharedGradebook: false,
      willRemount: [],
      orphans: [],
      requiresConfirm: false,
      targetCourseId: null,
      note: 'Split mode keeps each section lmsCourseId; no remount.',
    };
  }
  if (!Array.isArray(sectionIds) || sectionIds.length < 2) {
    const err = new Error('At least two sectionIds are required');
    err.status = 400;
    throw err;
  }

  const sections = await CourseSection.find(
    withTenantFilter({ _id: { $in: sectionIds } }, tenantId)
  ).lean();
  if (sections.length !== sectionIds.length) {
    const err = new Error('One or more sections not found');
    err.status = 400;
    throw err;
  }

  const primaryId = primarySectionId || sectionIds[0];
  const primary = sections.find((s) => String(s._id) === String(primaryId)) || sections[0];
  const targetCourseId =
    primary.lmsCourseId || sections.find((s) => s.lmsCourseId)?.lmsCourseId || null;

  const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
  const willRemount = [];
  for (const s of sections) {
    if (!s.lmsCourseId) continue;
    if (targetCourseId && String(s.lmsCourseId) === String(targetCourseId)) continue;
    const course = await Course.findById(s.lmsCourseId).select('title students').lean();
    const snapshotCount = await StudentCourseGradeSnapshot.countDocuments({
      course: s.lmsCourseId,
    });
    const studentCount = (course?.students || []).length;
    willRemount.push({
      sectionId: String(s._id),
      sectionNumber: s.sectionNumber,
      fromCourseId: String(s.lmsCourseId),
      toCourseId: targetCourseId ? String(targetCourseId) : null,
      title: course?.title || '',
      studentCount,
      snapshotCount,
      hasHistoricalData: studentCount > 0 || snapshotCount > 0,
    });
  }

  const orphans = willRemount.filter((w) => w.hasHistoricalData);
  return {
    sharedGradebook: true,
    targetCourseId: targetCourseId ? String(targetCourseId) : null,
    willRemount,
    orphans,
    requiresConfirm: orphans.length > 0,
    note:
      'Shared remount points member sections at the primary content course. Historical gradebooks are not merged — export archives first.',
  };
}

async function enqueueGradebookArchives(courseIds, actor, tenantId) {
  const jobQueueService = require('../jobQueue.service');
  const jobs = [];
  const seen = new Set();
  for (const courseId of courseIds) {
    const id = String(courseId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const { job } = await jobQueueService.enqueueJob(
      'export.gradebook',
      { courseId: id },
      actor,
      { rootAccountId: tenantId }
    );
    jobs.push({ courseId: id, jobId: job._id, status: job.status });
  }
  return jobs;
}

/**
 * Product default: shared gradebook / shared content (sharedGradebook: true).
 * Shared: all member sections point lmsCourseId → primary's content course.
 * Split: leave each section's lmsCourseId; group is organizational only.
 * Remount requires confirmRemount or exportArchivesFirst when historical data exists.
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
  actor = null,
  confirmRemount = false,
  exportArchivesFirst = false,
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
    sharedContentCourseId ||
    primary.lmsCourseId ||
    sections.find((s) => s.lmsCourseId)?.lmsCourseId ||
    null;

  const preview =
    sharedGradebook !== false && contentCourseId
      ? await previewCrossListRemount(tenantId, {
          sectionIds,
          primarySectionId: primary._id,
          sharedGradebook: true,
        })
      : { requiresConfirm: false, orphans: [], willRemount: [] };

  if (preview.requiresConfirm && !confirmRemount && !exportArchivesFirst) {
    const err = new Error(
      'Shared cross-list would remount content courses without merging grades. Pass confirmRemount=true or exportArchivesFirst=true after reviewing preview.'
    );
    err.status = 400;
    err.code = 'REMOUNT_CONFIRM_REQUIRED';
    err.data = preview;
    throw err;
  }

  let archiveJobs = [];
  if (exportArchivesFirst && preview.orphans?.length) {
    archiveJobs = await enqueueGradebookArchives(
      preview.orphans.map((o) => o.fromCourseId),
      actor || { _id: actorId },
      tenantId
    );
  }

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
      if (section.lmsCourseId && String(section.lmsCourseId) !== String(contentCourseId)) {
        section.previousLmsCourseId = section.lmsCourseId;
      }
      section.lmsCourseId = contentCourseId;
    }
    await section.save();
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
        remountCount: preview.willRemount?.length || 0,
        archiveJobs,
      },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { groupId: String(group._id), archiveJobs },
    })
    .catch(() => {});

  return { ...group.toObject(), remountPreview: preview, archiveJobs };
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
    .populate('lmsCourseId', 'title published')
    .populate('previousLmsCourseId', 'title')
    .lean();
  return {
    ...group,
    mode: group.sharedGradebook === false ? 'split' : 'shared',
    sections: sections.map((s) => ({
      ...s,
      openCourseUrl: s.lmsCourseId ? `/courses/${s.lmsCourseId._id}` : null,
      openGradebookUrl: s.lmsCourseId ? `/courses/${s.lmsCourseId._id}/gradebook` : null,
      archiveCourseUrl: s.previousLmsCourseId
        ? `/courses/${s.previousLmsCourseId._id}`
        : null,
    })),
  };
}

async function updateCrossList(tenantId, id, body, actorId, actor = null) {
  const group = await CrossListGroup.findOne(withTenantFilter({ _id: id }, tenantId));
  if (!group) {
    const err = new Error('Cross-list not found');
    err.status = 404;
    throw err;
  }

  const becomingShared =
    body.sharedGradebook !== undefined &&
    Boolean(body.sharedGradebook) &&
    group.sharedGradebook === false;

  if (body.name !== undefined) group.name = String(body.name).trim();
  if (body.sharedGradebook !== undefined) group.sharedGradebook = Boolean(body.sharedGradebook);
  if (body.primarySectionId) group.primarySectionId = body.primarySectionId;
  if (body.sharedContentCourseId !== undefined) {
    group.sharedContentCourseId = body.sharedContentCourseId;
  }

  let preview = { requiresConfirm: false, orphans: [], willRemount: [] };
  let archiveJobs = [];

  if (group.sharedGradebook) {
    const primary =
      (await CourseSection.findById(group.primarySectionId).lean()) ||
      (await CourseSection.findById(group.sectionIds[0]).lean());
    if (!group.sharedContentCourseId && primary?.lmsCourseId) {
      group.sharedContentCourseId = primary.lmsCourseId;
    }

    if (becomingShared || body.confirmRemount || body.exportArchivesFirst) {
      preview = await previewCrossListRemount(tenantId, {
        sectionIds: group.sectionIds,
        primarySectionId: group.primarySectionId,
        sharedGradebook: true,
      });
      if (preview.requiresConfirm && !body.confirmRemount && !body.exportArchivesFirst) {
        const err = new Error(
          'Flipping to shared gradebook remounts content without merging. Pass confirmRemount or exportArchivesFirst.'
        );
        err.status = 400;
        err.code = 'REMOUNT_CONFIRM_REQUIRED';
        err.data = preview;
        throw err;
      }
      if (body.exportArchivesFirst && preview.orphans?.length) {
        archiveJobs = await enqueueGradebookArchives(
          preview.orphans.map((o) => o.fromCourseId),
          actor || { _id: actorId },
          tenantId
        );
      }
    }
  }

  await group.save();

  if (group.sharedGradebook && group.sharedContentCourseId) {
    const members = await CourseSection.find(
      withTenantFilter({ _id: { $in: group.sectionIds } }, tenantId)
    );
    for (const section of members) {
      if (
        section.lmsCourseId &&
        String(section.lmsCourseId) !== String(group.sharedContentCourseId)
      ) {
        section.previousLmsCourseId = section.lmsCourseId;
      }
      section.lmsCourseId = group.sharedContentCourseId;
      section.primarySectionId = group.primarySectionId;
      section.crossListGroupId = group._id;
      await section.save();
    }
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
        archiveJobs,
      },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { archiveJobs },
    })
    .catch(() => {});

  return { ...group.toObject(), remountPreview: preview, archiveJobs };
}

/**
 * Sibling sections in a split cross-list (distinct gradebooks) for teaching UX.
 */
async function listCrossListSiblings(tenantId, courseId) {
  const section = await CourseSection.findOne(
    withTenantFilter({ lmsCourseId: courseId }, tenantId)
  ).lean();
  if (!section?.crossListGroupId) {
    return { mode: null, siblings: [], sectionId: null };
  }
  const group = await CrossListGroup.findOne(
    withTenantFilter({ _id: section.crossListGroupId }, tenantId)
  ).lean();
  if (!group) return { mode: null, siblings: [], sectionId: String(section._id) };
  if (group.sharedGradebook !== false) {
    return {
      mode: 'shared',
      siblings: [],
      sectionId: String(section._id),
      note: 'Shared gradebook — all sections use one content course.',
    };
  }

  const siblingIds = (group.sectionIds || []).filter(
    (id) => String(id) !== String(section._id)
  );
  const siblings = await CourseSection.find(
    withTenantFilter(
      {
        _id: { $in: siblingIds },
        lmsCourseId: { $ne: null },
      },
      tenantId
    )
  )
    .populate('lmsCourseId', 'title published')
    .populate('offeringId', 'courseCode title')
    .lean();

  return {
    mode: 'split',
    sectionId: String(section._id),
    groupId: String(group._id),
    groupName: group.name,
    siblings: siblings.map((s) => ({
      sectionId: String(s._id),
      sectionNumber: s.sectionNumber,
      courseId: s.lmsCourseId?._id ? String(s.lmsCourseId._id) : null,
      courseTitle: s.lmsCourseId?.title || '',
      offeringCode: s.offeringId?.courseCode || '',
      openCourseUrl: s.lmsCourseId ? `/courses/${s.lmsCourseId._id}` : null,
      openGradebookUrl: s.lmsCourseId ? `/courses/${s.lmsCourseId._id}/gradebook` : null,
    })),
  };
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

/**
 * Link an existing LMS Course to a section, or create a minimal content course from the offering.
 */
async function linkOrCreateContentCourse(tenantId, sectionId, { courseId = null, create = false, actor } = {}) {
  const section = await CourseSection.findOne(withTenantFilter({ _id: sectionId }, tenantId)).populate(
    'offeringId'
  );
  if (!section) {
    const err = new Error('Section not found');
    err.status = 404;
    throw err;
  }

  if (section.lmsCourseId && !courseId && !create) {
    const existing = await Course.findById(section.lmsCourseId)
      .select('title catalog sectionNumber academicTermId')
      .lean();
    return {
      section: section.toObject(),
      course: existing,
      created: false,
      alreadyLinked: true,
    };
  }

  let course = null;
  let created = false;

  if (courseId) {
    course = await Course.findOne(withTenantFilter({ _id: courseId }, tenantId));
    if (!course) {
      const err = new Error('Course not found in tenant');
      err.status = 404;
      throw err;
    }
  } else if (create || !courseId) {
    const offering = section.offeringId;
    const title =
      (offering && offering.title) ||
      `Section ${section.sectionNumber || ''}`.trim() ||
      'Untitled section course';
    course = await Course.create({
      title,
      description:
        (offering && offering.description) ||
        'Content course created by registrar to link an academic section for grade finalize.',
      instructor: section.instructorId || actor?._id || actor,
      rootAccountId: tenantId,
      accountId: section.accountId || tenantId,
      academicTermId: section.academicTermId,
      sectionId: section._id,
      offeringId: offering?._id || section.offeringId || null,
      sectionNumber: section.sectionNumber || '',
      catalog: {
        courseCode: offering?.courseCode || '',
        creditHours: offering?.credits ?? 0,
      },
      published: false,
      students: [],
    });
    created = true;
  }

  section.lmsCourseId = course._id;
  await section.save();

  course.sectionId = section._id;
  course.academicTermId = course.academicTermId || section.academicTermId;
  course.offeringId = course.offeringId || section.offeringId;
  if (!course.sectionNumber && section.sectionNumber) course.sectionNumber = section.sectionNumber;
  if (section.offeringId?.courseCode && !course.catalog?.courseCode) {
    course.catalog = {
      ...(course.catalog?.toObject?.() || course.catalog || {}),
      courseCode: section.offeringId.courseCode,
    };
  }
  await course.save();

  await academicAuditService
    .recordAuditEvent({
      actorId: actor?._id || actor,
      entityType: 'course_section',
      entityId: section._id,
      action: created ? 'registrar.section.content_course_created' : 'registrar.section.content_course_linked',
      after: { sectionId: section._id, courseId: course._id, created },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: {
        sectionId: String(section._id),
        courseId: String(course._id),
        created,
      },
    })
    .catch(() => {});

  return {
    section: section.toObject(),
    course: course.toObject?.() || course,
    created,
    alreadyLinked: false,
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
  previewCrossListRemount,
  listCrossListSiblings,
  backfillMissingStructure,
  structureGapReport,
  linkOrCreateContentCourse,
};
