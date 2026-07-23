const crypto = require('crypto');
const SisIntegrationConfig = require('../../models/sisIntegrationConfig.model');
const SisSyncBatch = require('../../models/sisSyncBatch.model');
const SisSyncRow = require('../../models/sisSyncRow.model');
const SisJob = require('../../models/sisJob.model');
const GradePassbackRecord = require('../../models/gradePassbackRecord.model');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const CourseOffering = require('../../models/courseOffering.model');
const CourseSection = require('../../models/courseSection.model');
const AcademicTerm = require('../../models/academicTerm.model');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const { activateEnrollment } = require('./enrollmentWrite.service');
const academicAuditService = require('../academicAudit.service');
const {
  stageEnrollmentImport,
  applyStagingBatch,
  resolveStudent,
  resolveCourse,
} = require('../sis');

function newBatchId() {
  return crypto.randomBytes(8).toString('hex');
}

function parseCsvText(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] != null ? cols[i] : '';
    });
    return obj;
  });
  return { headers, rows };
}

function pick(row, keys, fallback = '') {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}

function computeDiff(current, proposed) {
  if (!current) return { created: true, fields: Object.keys(proposed || {}) };
  const fields = {};
  for (const [k, v] of Object.entries(proposed || {})) {
    const cur = current[k];
    if (String(cur ?? '') !== String(v ?? '')) {
      fields[k] = { from: cur ?? null, to: v ?? null };
    }
  }
  return { created: false, fields };
}

async function getOrCreateConfig(tenantId, accountId) {
  let cfg = await SisIntegrationConfig.findOne(withTenantFilter({}, tenantId));
  if (!cfg) {
    cfg = await SisIntegrationConfig.create({
      provider: 'csv',
      rootAccountId: tenantId,
      accountId: accountId || tenantId,
    });
  }
  return cfg.toObject ? cfg.toObject() : cfg;
}

async function updateConfig(tenantId, body, accountId) {
  const cfg = await getOrCreateConfig(tenantId, accountId);
  const doc = await SisIntegrationConfig.findById(cfg._id);
  const fields = [
    'provider',
    'isSourceOfTruth',
    'syncDirection',
    'schedule',
    'fieldMappings',
    'credentialsRef',
    'notes',
    'isActive',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) doc[f] = body[f];
  }
  await doc.save();
  return doc.toObject();
}

async function createBatchAndJob({
  tenantId,
  accountId,
  batchId,
  entityType,
  provider,
  stagedCount,
  createdBy,
  jobType,
  meta = {},
}) {
  await SisSyncBatch.create({
    batchId,
    entityType,
    provider,
    status: 'staged',
    stagedCount,
    createdBy: createdBy || null,
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    meta,
  });
  await SisJob.create({
    jobType: jobType || `${entityType}_import`,
    provider,
    batchId,
    status: 'completed',
    stagedCount,
    createdBy: createdBy || null,
    finishedAt: new Date(),
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    meta,
  });
}

async function stageUsersImport({ tenantId, accountId, rows, csvText, provider = 'csv', createdBy }) {
  const parsed = rows?.length ? rows : parseCsvText(csvText).rows;
  const batchId = newBatchId();
  const docs = [];

  for (const raw of parsed) {
    const sisId = pick(raw, ['sis_id', 'externalstudentid', 'external_student_id', 'sisid']);
    const email = pick(raw, ['email', 'student_email', 'studentemail']).toLowerCase();
    if (!sisId && !email) continue;

    const proposed = {
      sisId,
      email,
      firstName: pick(raw, ['first_name', 'firstname', 'first']),
      lastName: pick(raw, ['last_name', 'lastname', 'last']),
      role: pick(raw, ['role'], 'student').toLowerCase() || 'student',
      studentId: pick(raw, ['student_id', 'studentid', 'admission_number', 'admissionnumber']),
      program: pick(raw, ['program', 'program_code']),
    };

    let currentUser = null;
    if (sisId) {
      currentUser = await User.findOne(
        withTenantFilter({ 'studentProfile.externalIds.sis': sisId }, tenantId)
      ).lean();
    }
    if (!currentUser && email) {
      currentUser = await User.findOne(withTenantFilter({ email }, tenantId)).lean();
    }

    const current = currentUser
      ? {
          sisId: currentUser.studentProfile?.externalIds?.sis || '',
          email: currentUser.email,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          role: currentUser.role,
          studentId: currentUser.studentProfile?.studentId || '',
        }
      : null;

    const diff = computeDiff(current, proposed);
    const hasConflict =
      current &&
      ((sisId && current.sisId && current.sisId !== sisId) ||
        (email && current.email && current.email !== email));

    docs.push({
      batchId,
      entityType: 'user',
      externalKey: sisId || email,
      status: hasConflict ? 'conflict' : 'pending',
      proposed,
      current,
      diff,
      rawPayload: raw,
      resolvedUserId: currentUser?._id || null,
      rootAccountId: tenantId,
      accountId: accountId || tenantId,
    });
  }

  if (!docs.length) return { batchId, staged: 0 };

  await SisSyncRow.insertMany(docs);
  await createBatchAndJob({
    tenantId,
    accountId,
    batchId,
    entityType: 'user',
    provider,
    stagedCount: docs.length,
    createdBy,
    jobType: 'user_import',
  });

  return { batchId, staged: docs.length };
}

async function stageSectionsImport({ tenantId, accountId, rows, csvText, provider = 'csv', createdBy }) {
  const parsed = rows?.length ? rows : parseCsvText(csvText).rows;
  const batchId = newBatchId();
  const docs = [];

  for (const raw of parsed) {
    const sisSectionId = pick(raw, ['sis_section_id', 'sissectionid', 'external_course_id', 'externalcourseid']);
    const courseCode = pick(raw, ['course_code', 'coursecode', 'catalog_nbr']).toUpperCase();
    if (!sisSectionId && !courseCode) continue;

    const proposed = {
      sisSectionId,
      courseCode,
      termCode: pick(raw, ['term_code', 'termcode', 'sis_term_code', 'sistermcode']),
      section: pick(raw, ['section', 'section_number', 'sectionnumber'], '1'),
      instructorEmail: pick(raw, ['instructor_email', 'instructoremail']).toLowerCase(),
      maxEnrollment: Number(pick(raw, ['max_enrollment', 'maxenrollment'], '0')) || null,
      title: pick(raw, ['title', 'course_title'], courseCode || sisSectionId),
    };

    let section = null;
    if (sisSectionId) {
      section = await CourseSection.findOne(
        withTenantFilter({ sisSectionId }, tenantId)
      ).lean();
    }

    const current = section
      ? {
          sisSectionId: section.sisSectionId,
          section: section.sectionNumber,
          maxEnrollment: section.maxEnrollment,
          lmsCourseId: section.lmsCourseId ? String(section.lmsCourseId) : null,
        }
      : null;

    docs.push({
      batchId,
      entityType: 'section',
      externalKey: sisSectionId || `${courseCode}:${proposed.section}`,
      status: 'pending',
      proposed,
      current,
      diff: computeDiff(current, proposed),
      rawPayload: raw,
      resolvedSectionId: section?._id || null,
      resolvedCourseId: section?.lmsCourseId || null,
      rootAccountId: tenantId,
      accountId: accountId || tenantId,
    });
  }

  if (!docs.length) return { batchId, staged: 0 };

  await SisSyncRow.insertMany(docs);
  await createBatchAndJob({
    tenantId,
    accountId,
    batchId,
    entityType: 'section',
    provider,
    stagedCount: docs.length,
    createdBy,
    jobType: 'section_import',
  });

  return { batchId, staged: docs.length };
}

async function stageEnrollmentsImport({ tenantId, accountId, rows, csvText, provider = 'csv', createdBy }) {
  const parsed = rows?.length ? rows : parseCsvText(csvText).rows;
  const normalized = parsed.map((raw) => {
    const sisStudentId = pick(raw, ['sis_student_id', 'sisstudentid', 'external_student_id', 'externalstudentid']);
    const sisSectionId = pick(raw, ['sis_section_id', 'sissectionid', 'external_course_id', 'externalcourseid']);
    const email = pick(raw, ['email', 'student_email', 'studentemail']).toLowerCase();
    const courseCode = pick(raw, ['course_code', 'coursecode']).toUpperCase();
    return {
      externalStudentId: sisStudentId || email || 'unknown',
      externalCourseId: sisSectionId || courseCode || 'unknown',
      studentEmail: email || undefined,
      courseCode: courseCode || undefined,
      sisSectionId,
      sisStudentId,
      sisEnrollmentId: pick(raw, ['sis_enrollment_id', 'sisenrollmentid']),
      role: pick(raw, ['role'], 'student'),
      status: pick(raw, ['status'], 'active'),
      ...raw,
    };
  });

  // Stage into legacy enrollment staging (apply path) + sync rows for inbox diff
  const legacy = await stageEnrollmentImport(provider, normalized, {
    rootAccountId: tenantId,
    createdBy,
  });

  const batchId = legacy.batchId;
  const syncDocs = [];
  for (const row of normalized) {
    if (!row.externalStudentId || row.externalStudentId === 'unknown') continue;
    const student = await resolveStudent(tenantId, {
      studentEmail: row.studentEmail,
      externalStudentId: row.sisStudentId || row.externalStudentId,
    });
    const course = await resolveCourse(tenantId, {
      courseCode: row.courseCode,
      sisSectionId: row.sisSectionId || row.externalCourseId,
      lmsCourseId: row.lmsCourseId,
    });

    const proposed = {
      sisStudentId: row.sisStudentId || row.externalStudentId,
      sisSectionId: row.sisSectionId || row.externalCourseId,
      email: row.studentEmail || '',
      courseCode: row.courseCode || '',
      role: row.role || 'student',
      status: row.status || 'active',
    };
    const current =
      student || course
        ? {
            studentId: student?._id ? String(student._id) : null,
            courseId: course?._id ? String(course._id) : null,
            studentEmail: student?.email || null,
            courseCode: course?.catalog?.courseCode || null,
          }
        : null;

    syncDocs.push({
      batchId,
      entityType: 'enrollment',
      externalKey: `${proposed.sisStudentId}:${proposed.sisSectionId}`,
      status: !student || !course ? 'conflict' : 'pending',
      proposed,
      current,
      diff: computeDiff(current, proposed),
      rawPayload: row,
      resolvedUserId: student?._id || null,
      resolvedCourseId: course?._id || null,
      rootAccountId: tenantId,
      accountId: accountId || tenantId,
    });
  }

  if (syncDocs.length) {
    await SisSyncRow.insertMany(syncDocs);
    await SisSyncBatch.findOneAndUpdate(
      withTenantFilter({ batchId }, tenantId),
      {
        $setOnInsert: {
          batchId,
          entityType: 'enrollment',
          provider,
          status: 'staged',
          stagedCount: syncDocs.length,
          createdBy: createdBy || null,
          rootAccountId: tenantId,
          accountId: accountId || tenantId,
        },
      },
      { upsert: true }
    );
  }

  return { batchId, staged: legacy.staged, syncRows: syncDocs.length };
}

async function listSyncRows(tenantId, { batchId, status, entityType, limit = 200 } = {}) {
  const filter = withTenantFilter({}, tenantId);
  if (batchId) filter.batchId = batchId;
  if (status) filter.status = status;
  if (entityType) filter.entityType = entityType;
  return SisSyncRow.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 500))
    .lean();
}

async function listBatches(tenantId, { limit = 50 } = {}) {
  return SisSyncBatch.find(withTenantFilter({}, tenantId))
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();
}

async function patchSyncRow(tenantId, rowId, { status, overrideReason }, actor) {
  const row = await SisSyncRow.findOne(withTenantFilter({ _id: rowId }, tenantId));
  if (!row) {
    const err = new Error('Staging row not found');
    err.status = 404;
    throw err;
  }
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    const err = new Error('status must be approved, rejected, or pending');
    err.status = 400;
    throw err;
  }

  const before = { status: row.status };
  if (row.status === 'conflict' && status === 'approved') {
    if (!overrideReason || !String(overrideReason).trim()) {
      const err = new Error('overrideReason is required to approve a conflict row');
      err.status = 400;
      err.code = 'OVERRIDE_REASON_REQUIRED';
      throw err;
    }
    row.overrideReason = String(overrideReason).trim();
    await academicAuditService.recordAuditEvent({
      actorId: actor._id || actor,
      entityType: 'sis_sync_row',
      entityId: row._id,
      action: 'registrar.sis.conflict_overridden',
      before,
      after: { status: 'approved', overrideReason: row.overrideReason },
      severity: 'critical',
      rootAccountId: tenantId,
      metadata: { batchId: row.batchId, entityType: row.entityType, externalKey: row.externalKey },
    });
  }

  row.status = status;
  row.reviewedBy = actor._id || actor;
  if (overrideReason) row.overrideReason = String(overrideReason).trim();
  await row.save();
  return row.toObject();
}

async function applyUserRow(tenantId, row, actorId) {
  const p = row.proposed || {};
  const email = String(p.email || '').toLowerCase().trim();
  const sisId = String(p.sisId || '').trim();
  if (!email && !sisId) throw new Error('User row missing email and sis_id');

  let user =
    (sisId &&
      (await User.findOne(withTenantFilter({ 'studentProfile.externalIds.sis': sisId }, tenantId)))) ||
    (email && (await User.findOne(withTenantFilter({ email }, tenantId))));

  const role = ['student', 'teacher', 'admin', 'registrar', 'department_admin'].includes(p.role)
    ? p.role
    : 'student';

  if (!user) {
    if (!email) throw new Error('Cannot create user without email');
    user = await User.create({
      firstName: p.firstName || 'SIS',
      lastName: p.lastName || 'User',
      email,
      password: `Sis${crypto.randomBytes(6).toString('hex')}!`,
      role,
      rootAccountId: tenantId,
      accountId: tenantId,
      studentProfile: {
        studentId: p.studentId || '',
        externalIds: { sis: sisId || '' },
      },
    });
  } else {
    user.firstName = p.firstName || user.firstName;
    user.lastName = p.lastName || user.lastName;
    if (email) user.email = email;
    if (!user.studentProfile) user.studentProfile = {};
    if (p.studentId) user.studentProfile.studentId = p.studentId;
    if (!user.studentProfile.externalIds) user.studentProfile.externalIds = {};
    if (sisId) user.studentProfile.externalIds.sis = sisId;
    user.markModified('studentProfile');
    await user.save();
  }

  row.resolvedUserId = user._id;
  row.status = 'applied';
  row.appliedAt = new Date();
  row.reviewedBy = actorId;
  row.applyError = '';
  await row.save();
  return user;
}

async function applySectionRow(tenantId, row, actorId) {
  const p = row.proposed || {};
  const courseCode = String(p.courseCode || '').toUpperCase().trim();
  const sisSectionId = String(p.sisSectionId || '').trim();
  if (!courseCode && !sisSectionId) throw new Error('Section row missing course_code and sis_section_id');

  let term = null;
  if (p.termCode) {
    term = await AcademicTerm.findOne(
      withTenantFilter(
        {
          $or: [{ sisTermCode: p.termCode }, { code: p.termCode.toUpperCase() }],
        },
        tenantId
      )
    );
  }
  if (!term) {
    term = await AcademicTerm.findOne(withTenantFilter({ isDefault: true }, tenantId));
  }
  if (!term) {
    term = await AcademicTerm.create({
      name: p.termCode || 'SIS Term',
      code: String(p.termCode || `SIS-${Date.now()}`).toUpperCase().slice(0, 32),
      status: 'active',
      sisTermCode: p.termCode || '',
      rootAccountId: tenantId,
      accountId: tenantId,
    });
  }

  let offering = courseCode
    ? await CourseOffering.findOne(withTenantFilter({ courseCode }, tenantId))
    : null;
  if (!offering) {
    offering = await CourseOffering.create({
      courseCode: courseCode || `SIS-${sisSectionId}`.slice(0, 64).toUpperCase(),
      title: p.title || courseCode || sisSectionId,
      isActive: true,
      rootAccountId: tenantId,
      accountId: tenantId,
    });
  }

  let instructor = null;
  if (p.instructorEmail) {
    instructor = await User.findOne(
      withTenantFilter({ email: String(p.instructorEmail).toLowerCase() }, tenantId)
    );
  }

  let section = sisSectionId
    ? await CourseSection.findOne(withTenantFilter({ sisSectionId }, tenantId))
    : null;

  let course = section?.lmsCourseId
    ? await Course.findById(section.lmsCourseId)
    : courseCode
      ? await Course.findOne(
          withTenantFilter({ 'catalog.courseCode': courseCode }, tenantId)
        )
      : null;

  if (!course) {
    if (!instructor) {
      instructor = await User.findOne(withTenantFilter({ role: 'teacher' }, tenantId));
    }
    if (!instructor) {
      instructor = await User.findOne(withTenantFilter({ role: 'admin' }, tenantId));
    }
    if (!instructor) throw new Error('No instructor available to create section course');

    course = await Course.create({
      title: p.title || courseCode || sisSectionId,
      description: `SIS imported section ${sisSectionId || courseCode}`,
      instructor: instructor._id,
      published: true,
      academicTermId: term._id,
      rootAccountId: tenantId,
      accountId: tenantId,
      semester: {
        term: term.legacyTermLabel || term.code || 'Fall',
        year: term.legacyYear || new Date().getFullYear(),
      },
      catalog: {
        courseCode: courseCode || `SIS${String(sisSectionId).slice(-6).toUpperCase()}`,
        maxStudents: p.maxEnrollment || 40,
      },
      students: [],
    });
  }

  if (!section) {
    section = await CourseSection.create({
      offeringId: offering._id,
      academicTermId: term._id,
      sectionNumber: String(p.section || '1').slice(0, 32),
      instructorId: instructor?._id || course.instructor,
      maxEnrollment: p.maxEnrollment || null,
      enrollmentMethod: 'sis_only',
      status: 'published',
      sisSectionId: sisSectionId || '',
      lmsCourseId: course._id,
      rootAccountId: tenantId,
      accountId: tenantId,
    });
  } else {
    if (sisSectionId) section.sisSectionId = sisSectionId;
    if (p.maxEnrollment != null) section.maxEnrollment = p.maxEnrollment;
    section.lmsCourseId = course._id;
    await section.save();
  }

  await Course.updateOne(
    { _id: course._id },
    {
      $set: {
        academicTermId: term._id,
        offeringId: offering._id,
        sectionId: section._id,
        sectionNumber: section.sectionNumber,
      },
    }
  );

  row.resolvedSectionId = section._id;
  row.resolvedCourseId = course._id;
  row.status = 'applied';
  row.appliedAt = new Date();
  row.reviewedBy = actorId;
  row.applyError = '';
  await row.save();
  return { section, course };
}

async function applySyncBatch(batchId, { tenantId, actorId, approvePending = true } = {}) {
  const batch = await SisSyncBatch.findOne(withTenantFilter({ batchId }, tenantId));
  const filter = withTenantFilter(
    {
      batchId,
      status: approvePending
        ? { $in: ['pending', 'approved', 'conflict'] }
        : { $in: ['approved'] },
    },
    tenantId
  );

  // Conflicts need explicit approve + override — skip unless already approved
  const rows = await SisSyncRow.find(filter);
  let applied = 0;
  let rejected = 0;
  const errors = [];

  for (const row of rows) {
    if (row.status === 'conflict') {
      rejected += 1;
      row.applyError = 'Conflict requires override approval';
      await row.save();
      errors.push({ id: row._id, message: row.applyError });
      continue;
    }
    try {
      if (row.entityType === 'user') {
        await applyUserRow(tenantId, row, actorId);
      } else if (row.entityType === 'section') {
        await applySectionRow(tenantId, row, actorId);
      } else if (row.entityType === 'enrollment') {
        // Apply via legacy enrollment staging for dual-write consistency
        continue;
      }
      applied += 1;
    } catch (err) {
      rejected += 1;
      row.status = 'rejected';
      row.applyError = err.message;
      row.reviewedBy = actorId;
      await row.save();
      errors.push({ id: row._id, message: err.message });
    }
  }

  let enrollmentResult = null;
  const entityType = batch?.entityType || rows[0]?.entityType;
  const SisStagingEnrollment = require('../../models/sisStagingEnrollment.model');
  const legacyCount = await SisStagingEnrollment.countDocuments(
    withTenantFilter({ batchId }, tenantId)
  );
  if (entityType === 'enrollment' || legacyCount > 0) {
    enrollmentResult = await applyStagingBatch(batchId, {
      rootAccountId: tenantId,
      actorId,
      approvePending,
    });
    // Mirror applied status onto sync rows that were pending/approved
    const syncRows = await SisSyncRow.find(
      withTenantFilter({ batchId, entityType: 'enrollment', status: { $in: ['pending', 'approved'] } }, tenantId)
    );
    for (const sr of syncRows) {
      sr.status = 'applied';
      sr.appliedAt = new Date();
      sr.reviewedBy = actorId;
      await sr.save();
    }
    if (enrollmentResult) {
      applied = enrollmentResult.applied;
      rejected = enrollmentResult.rejected;
    }
  }

  if (batch) {
    batch.status = errors.length && applied ? 'partial' : errors.length && !applied ? 'failed' : 'completed';
    batch.appliedCount = applied;
    batch.rejectedCount = rejected;
    batch.errorCount = errors.length;
    batch.finishedAt = new Date();
    await batch.save();
  }

  await academicAuditService
    .recordAuditEvent({
      actorId,
      entityType: 'sis_sync_batch',
      entityId: batch?._id || batchId,
      action: 'registrar.sis.batch_applied',
      after: { batchId, applied, rejected, entityType },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { batchId, applied, rejected },
    })
    .catch(() => {});

  try {
    const institutionalNotification = require('../institutionalNotification.service');
    if (rejected > 0 && actorId) {
      await institutionalNotification.notifyUser(actorId, 'sis_sync_errors', {
        message: `SIS batch ${batchId}: ${applied} applied, ${rejected} failed`,
        link: '/registrar/sis',
        metadata: { batchId, applied, rejected },
      });
    }
  } catch {
    /* non-blocking */
  }

  return {
    batchId,
    entityType,
    applied,
    rejected,
    errors,
    enrollmentResult,
  };
}

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

async function buildGradesExport(tenantId, { term, year, academicTermId } = {}) {
  const courseFilter = withTenantFilter({ published: true }, tenantId);
  if (academicTermId) {
    courseFilter.academicTermId = academicTermId;
  } else if (term && year) {
    courseFilter['semester.term'] = term;
    courseFilter['semester.year'] = Number(year);
  }

  const courses = await Course.find(courseFilter)
    .select('_id catalog sectionId rootAccountId semester')
    .lean();
  const courseIds = courses.map((c) => c._id);
  const sectionIds = courses.map((c) => c.sectionId).filter(Boolean);

  const sections = sectionIds.length
    ? await CourseSection.find(withTenantFilter({ _id: { $in: sectionIds } }, tenantId))
        .select('_id sisSectionId lmsCourseId')
        .lean()
    : await CourseSection.find(
        withTenantFilter({ lmsCourseId: { $in: courseIds } }, tenantId)
      )
        .select('_id sisSectionId lmsCourseId')
        .lean();

  const sectionByCourse = new Map();
  for (const s of sections) {
    if (s.lmsCourseId) sectionByCourse.set(String(s.lmsCourseId), s);
  }

  const snapFilter = {
    course: { $in: courseIds },
    frozen: true,
    isCurrent: true,
    lifecycleStatus: { $in: ['FINALIZED', 'AMENDED'] },
  };
  if (term) snapFilter.term = term;
  if (year) snapFilter.year = Number(year);

  const snaps = courseIds.length
    ? await StudentCourseGradeSnapshot.find(snapFilter).lean()
    : [];

  const studentIds = [...new Set(snaps.map((s) => String(s.student)))];
  const students = studentIds.length
    ? await User.find({ _id: { $in: studentIds } })
        .select('email studentProfile')
        .lean()
    : [];
  const studentById = new Map(students.map((u) => [String(u._id), u]));

  const gradePointsMap = {
    'A+': 10,
    A: 9,
    'A-': 8,
    'B+': 7,
    B: 6,
    'B-': 5.5,
    'C+': 5,
    C: 4.5,
    'C-': 4,
    D: 3,
    F: 0,
  };

  const rows = snaps.map((snap) => {
    const student = studentById.get(String(snap.student));
    const section = sectionByCourse.get(String(snap.course));
    return {
      sis_student_id: student?.studentProfile?.externalIds?.sis || '',
      sis_section_id: section?.sisSectionId || '',
      email: student?.email || '',
      final_grade: snap.letterGrade,
      final_percent: snap.finalPercent,
      grade_points: gradePointsMap[snap.letterGrade] ?? '',
      status: snap.lifecycleStatus,
      snapshot_hash: snap.gradingPolicyHash || '',
      course_id: String(snap.course),
      student_id: String(snap.student),
    };
  });

  const headers = [
    'sis_student_id',
    'sis_section_id',
    'email',
    'final_grade',
    'final_percent',
    'grade_points',
    'status',
    'snapshot_hash',
  ];
  const csvText = toCsv(rows, headers);

  return { rows, csvText, term, year: year ? Number(year) : null, count: rows.length };
}

async function exportGradesPassback({
  tenantId,
  accountId,
  term,
  year,
  academicTermId,
  exportedBy,
  notes,
  markSent = false,
}) {
  const built = await buildGradesExport(tenantId, { term, year, academicTermId });
  const batchId = newBatchId();

  const record = await GradePassbackRecord.create({
    term: term || 'unknown',
    year: Number(year) || new Date().getFullYear(),
    academicTermId: academicTermId || null,
    provider: 'csv',
    channel: 'csv',
    status: markSent ? 'sent' : 'exported',
    rowCount: built.count,
    csvText: built.csvText,
    rows: built.rows,
    batchId,
    exportedBy: exportedBy || null,
    notes: notes || '',
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
  });

  await SisJob.create({
    jobType: 'grade_export',
    provider: 'csv',
    batchId,
    status: 'completed',
    stagedCount: built.count,
    appliedCount: built.count,
    createdBy: exportedBy || null,
    finishedAt: new Date(),
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    meta: { term, year, recordId: String(record._id) },
  });

  await SisSyncBatch.create({
    batchId,
    entityType: 'grade_export',
    provider: 'csv',
    status: 'completed',
    stagedCount: built.count,
    appliedCount: built.count,
    createdBy: exportedBy || null,
    finishedAt: new Date(),
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    meta: { term, year },
  });

  await academicAuditService
    .recordAuditEvent({
      actorId: exportedBy,
      entityType: 'grade_passback',
      entityId: record._id,
      action: 'registrar.sis.grades_exported',
      after: { term, year: Number(year), rowCount: built.count },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { batchId, term, year: Number(year) },
    })
    .catch(() => {});

  let ltiStub = null;
  try {
    const ltiAgs = require('../lti/ltiAgs.service');
    ltiStub = await ltiAgs.submitScoresStub({
      tenantId,
      accountId: accountId || tenantId,
      term,
      year,
      rows: built.rows,
      exportedBy,
      dryRun: true,
    });
  } catch {
    /* optional */
  }

  let customRest = null;
  try {
    const cfg = await getOrCreateConfig(tenantId, accountId);
    if (cfg.provider === 'custom_rest') {
      const { pushCustomRest } = require('../sis/adapters/customRest');
      customRest = await pushCustomRest({
        config: cfg,
        payload: {
          entityType: 'grades',
          term,
          year: Number(year),
          rows: built.rows,
        },
        dryRun: true,
      });
    }
  } catch {
    /* optional */
  }

  return {
    record: record.toObject(),
    csvText: built.csvText,
    count: built.count,
    batchId,
    ltiStub,
    customRest,
  };
}

async function listPassbackRecords(tenantId, { limit = 50 } = {}) {
  return GradePassbackRecord.find(withTenantFilter({}, tenantId))
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .select('-csvText -rows')
    .lean();
}

module.exports = {
  parseCsvText,
  getOrCreateConfig,
  updateConfig,
  stageUsersImport,
  stageSectionsImport,
  stageEnrollmentsImport,
  listSyncRows,
  listBatches,
  patchSyncRow,
  applySyncBatch,
  buildGradesExport,
  exportGradesPassback,
  listPassbackRecords,
};
