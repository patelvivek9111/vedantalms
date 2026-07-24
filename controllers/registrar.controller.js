const mongoose = require('mongoose');
const Enrollment = require('../models/enrollment.model');
const StudentHold = require('../models/studentHold.model');
const Course = require('../models/course.model');
const CourseSection = require('../models/courseSection.model');
const AcademicTerm = require('../models/academicTerm.model');
const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
const User = require('../models/user.model');
const SisStagingEnrollment = require('../models/sisStagingEnrollment.model');
const SisJob = require('../models/sisJob.model');
const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');
const {
  activateEnrollment,
  deactivateEnrollment,
  concludeEnrollment,
  syncEnrollmentsFromCourseStudents,
  transferEnrollment,
  patchEnrollment,
  promoteFromWaitlist,
} = require('../services/registrar/enrollmentWrite.service');
const { checkEnrollmentRules, canOverrideRules } = require('../services/registrar/enrollmentRules.service');
const {
  buildStudentScopeFilter,
  assertCanAccessStudentApi,
} = require('../services/registrar/studentScope.service');
const { stageEnrollmentImport, applyStagingBatch } = require('../services/sis');
const Program = require('../models/program.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const TranscriptIssueLog = require('../models/transcriptIssueLog.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');

async function resolveStudentRef(tenantId, ref) {
  if (!ref) return null;
  const q = String(ref).trim();
  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    return User.findOne(withTenantFilter({ _id: q, role: 'student' }, tenantId));
  }
  return User.findOne(withTenantFilter({ email: q.toLowerCase(), role: 'student' }, tenantId));
}

async function resolveCourseRef(tenantId, ref) {
  if (!ref) return null;
  const q = String(ref).trim();
  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    return Course.findOne(withTenantFilter({ _id: q }, tenantId));
  }
  const code = q.toUpperCase();
  return Course.findOne(withTenantFilter({ 'catalog.courseCode': code }, tenantId));
}

function parseEnrollmentCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows = [];
  for (const line of lines) {
    // Skip header rows only (not emails that start with "student")
    if (/^(student\s*(id|email)?|email|course)\s*[,;]/i.test(line)) continue;
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 2) continue;
    rows.push({ studentRef: parts[0], courseRef: parts[1] });
  }
  return rows;
}

exports.listTermEnrollments = async (req, res) => {
  try {
    const { buildAccountScopeFilter } = require('../services/registrar/studentScope.service');
    const { filter, tenantId } = await buildAccountScopeFilter(req, {
      academicTermId: req.params.termId,
    });
    const status = req.query.status;
    if (status && status !== 'all') filter.status = status;

    // Dept scope is on Enrollment.accountId; also restrict to courses in subtree if needed
    const rows = await Enrollment.find(filter)
      .populate('studentId', 'firstName lastName email role')
      .populate('lmsCourseId', 'title catalog.courseCode accountId')
      .populate('sectionId', 'sectionNumber status accountId')
      .sort({ updatedAt: -1 })
      .limit(Math.min(1000, parseInt(req.query.limit, 10) || 500))
      .lean();

    let data = rows;
    if (
      req.user?.role === 'department_admin' &&
      req.user.accountId &&
      tenantId &&
      String(req.user.accountId) !== String(tenantId)
    ) {
      const { accountSubtreeFilter } = require('../services/tenancy/academicStructure.service');
      const subtree = await accountSubtreeFilter(tenantId, req.user.accountId);
      const allowed = new Set((subtree.accountId?.$in || []).map(String));
      if (allowed.size) {
        data = rows.filter((r) => {
          const aid =
            r.accountId ||
            r.sectionId?.accountId ||
            r.lmsCourseId?.accountId ||
            r.studentId?.accountId;
          return aid && allowed.has(String(aid));
        });
      }
    }

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSectionRoster = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const section = await CourseSection.findOne(
      withTenantFilter({ _id: req.params.sectionId }, tenantId)
    ).lean();
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    let enrollments = await Enrollment.find(
      withTenantFilter(
        {
          $or: [{ sectionId: section._id }, { lmsCourseId: section.lmsCourseId }],
          status: { $in: ['active', 'invited', 'completed'] },
        },
        tenantId
      )
    )
      .populate('studentId', 'firstName lastName email')
      .lean();

    if (!enrollments.length && section.lmsCourseId) {
      const course = await Course.findById(section.lmsCourseId)
        .populate('students', 'firstName lastName email')
        .lean();
      enrollments = (course?.students || []).map((s) => ({
        studentId: s,
        status: 'active',
        lmsCourseId: course._id,
        source: 'course_roster_fallback',
      }));
    }

    return res.json({
      success: true,
      data: { section, enrollments, count: enrollments.length },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkEnroll = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const {
      courseId,
      studentIds,
      enrollmentType,
      override = false,
      overrideReason = '',
      csv,
      rows: bodyRows,
    } = req.body || {};

    let pairs = [];
    if (csv || (Array.isArray(bodyRows) && bodyRows.length)) {
      const raw = csv ? parseEnrollmentCsv(csv) : bodyRows;
      for (const row of raw) {
        const student = await resolveStudentRef(tenantId, row.studentRef || row.studentId || row.email);
        const course = await resolveCourseRef(tenantId, row.courseRef || row.courseId || row.courseCode);
        pairs.push({
          studentId: student?._id,
          course,
          studentRef: row.studentRef || row.studentId || row.email,
          courseRef: row.courseRef || row.courseId || row.courseCode,
          resolveError: !student ? 'Student not found' : !course ? 'Course not found' : null,
        });
      }
    } else {
      if (!courseId || !Array.isArray(studentIds) || !studentIds.length) {
        return res.status(400).json({
          success: false,
          message: 'courseId and studentIds[] are required (or csv / rows)',
        });
      }
      const course = await Course.findOne(withTenantFilter({ _id: courseId }, tenantId));
      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      pairs = studentIds.map((studentId) => ({ studentId, course, studentRef: studentId, courseRef: courseId }));
    }

    if (override && !String(overrideReason || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'overrideReason is required when override=true',
      });
    }

    const results = [];
    for (const pair of pairs) {
      if (pair.resolveError) {
        results.push({
          studentId: pair.studentId || pair.studentRef,
          courseId: pair.course?._id || pair.courseRef,
          ok: false,
          message: pair.resolveError,
        });
        continue;
      }
      try {
        const rules = await checkEnrollmentRules({
          studentId: pair.studentId,
          course: pair.course,
          source: 'registrar',
        });
        const blocked = !rules.allowed;
        if (blocked) {
          const hard = rules.violations.filter((v) => !v.overrideable);
          const already = rules.violations.some((v) => v.code === 'already_enrolled');
          if (already) {
            results.push({
              studentId: pair.studentId,
              courseId: pair.course._id,
              ok: true,
              skipped: true,
              message: 'Already enrolled',
              rules,
            });
            continue;
          }
          if (hard.length || !override || !canOverrideRules(req.user, rules)) {
            results.push({
              studentId: pair.studentId,
              courseId: pair.course._id,
              ok: false,
              message: rules.violations.map((v) => v.message).join('; ') || 'Rules blocked enrollment',
              rules,
            });
            continue;
          }
        }

        const enrollment = await activateEnrollment({
          course: pair.course,
          studentId: pair.studentId,
          actorId: req.user._id,
          source: 'registrar',
          enrollmentType: enrollmentType || 'regular',
        });
        results.push({
          studentId: pair.studentId,
          courseId: pair.course._id,
          ok: true,
          enrollmentId: enrollment._id,
          overridden: Boolean(override && blocked),
          overrideReason: override ? overrideReason : undefined,
          rules,
        });
      } catch (err) {
        results.push({
          studentId: pair.studentId,
          courseId: pair.course?._id,
          ok: false,
          message: err.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        enrolled: results.filter((r) => r.ok && !r.skipped).length,
        skipped: results.filter((r) => r.skipped).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.previewEnrollments = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { courseId, studentIds, csv, rows: bodyRows } = req.body || {};

    let pairs = [];
    if (csv || (Array.isArray(bodyRows) && bodyRows.length)) {
      const raw = csv ? parseEnrollmentCsv(csv) : bodyRows;
      for (const row of raw) {
        const student = await resolveStudentRef(tenantId, row.studentRef || row.studentId || row.email);
        const course = await resolveCourseRef(tenantId, row.courseRef || row.courseId || row.courseCode);
        pairs.push({
          studentId: student?._id,
          course,
          studentRef: row.studentRef || row.studentId || row.email,
          courseRef: row.courseRef || row.courseId || row.courseCode,
          resolveError: !student ? 'Student not found' : !course ? 'Course not found' : null,
        });
      }
    } else {
      if (!courseId || !Array.isArray(studentIds) || !studentIds.length) {
        return res.status(400).json({
          success: false,
          message: 'courseId and studentIds[] are required (or csv / rows)',
        });
      }
      const course = await Course.findOne(withTenantFilter({ _id: courseId }, tenantId));
      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      pairs = studentIds.map((studentId) => ({ studentId, course, studentRef: studentId, courseRef: courseId }));
    }

    const results = [];
    for (const pair of pairs) {
      if (pair.resolveError) {
        results.push({
          studentRef: pair.studentRef,
          courseRef: pair.courseRef,
          allowed: false,
          violations: [{ code: 'resolve_error', message: pair.resolveError, overrideable: false }],
          warnings: [],
        });
        continue;
      }
      const rules = await checkEnrollmentRules({
        studentId: pair.studentId,
        course: pair.course,
        source: 'registrar',
      });
      results.push({
        studentId: pair.studentId,
        courseId: pair.course._id,
        student: rules.student,
        allowed: rules.allowed,
        violations: rules.violations,
        warnings: rules.warnings,
        overrideableBy: rules.overrideableBy,
      });
    }

    return res.json({
      success: true,
      data: {
        total: results.length,
        allowed: results.filter((r) => r.allowed).length,
        blocked: results.filter((r) => !r.allowed).length,
        results,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.transferEnrollmentHandler = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const enrollmentId = req.params.id || req.body.enrollmentId;
    const { toCourseId, reason } = req.body || {};
    if (!enrollmentId || !toCourseId) {
      return res.status(400).json({ success: false, message: 'enrollmentId and toCourseId are required' });
    }
    const result = await transferEnrollment({
      enrollmentId,
      toCourseId,
      actorId: req.user._id,
      reason: reason || 'Registrar section transfer',
      rootAccountId: tenantId,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.patchEnrollmentHandler = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { status, enrollmentType, role, reason } = req.body || {};
    const enrollment = await patchEnrollment({
      enrollmentId: req.params.id,
      actorId: req.user._id,
      reason,
      status,
      enrollmentType,
      role,
      rootAccountId: tenantId,
    });
    return res.json({ success: true, data: enrollment });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.promoteWaitlist = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const courseId = req.params.courseId || req.body.courseId;
    const { studentId } = req.body || {};
    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required' });
    }
    const course = await Course.findOne(withTenantFilter({ _id: courseId }, tenantId));
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const result = await promoteFromWaitlist({
      course,
      studentId: studentId || null,
      actorId: req.user._id,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listCourseWaitlist = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const course = await Course.findOne(withTenantFilter({ _id: req.params.courseId }, tenantId))
      .populate('waitlist.student', 'firstName lastName email')
      .select('title waitlist catalog.courseCode')
      .lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    return res.json({
      success: true,
      data: {
        courseId: course._id,
        title: course.title,
        waitlist: course.waitlist || [],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listStudentEnrollments = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const { filter: studentFilter, tenantId } = await buildStudentScopeFilter(req, {
      _id: req.params.id,
    });
    const student = await User.findOne(studentFilter).select('_id').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const filter = withTenantFilter({ studentId: req.params.id }, tenantId);
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.termId) filter.academicTermId = req.query.termId;

    const rows = await Enrollment.find(filter)
      .populate('lmsCourseId', 'title catalog.courseCode')
      .populate('academicTermId', 'name code')
      .populate('sectionId', 'sectionNumber')
      .sort({ updatedAt: -1 })
      .limit(Math.min(200, parseInt(req.query.limit, 10) || 100))
      .lean();

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.dropEnrollment = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { courseId, studentId, status, reason } = req.body || {};
    if (!courseId || !studentId) {
      return res.status(400).json({ success: false, message: 'courseId and studentId are required' });
    }
    const course = await Course.findOne(withTenantFilter({ _id: courseId }, tenantId));
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const enrollment = await deactivateEnrollment({
      course,
      studentId,
      actorId: req.user._id,
      status: status || 'dropped',
      reason: reason || 'Registrar drop',
    });

    return res.json({ success: true, data: enrollment });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.concludeTermEnrollments = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { termId } = req.params;
    const active = await Enrollment.find(
      withTenantFilter({ academicTermId: termId, status: 'active' }, tenantId)
    );
    let count = 0;
    for (const row of active) {
      await concludeEnrollment({
        course: row.lmsCourseId,
        studentId: row.studentId,
        actorId: req.user._id,
      });
      count += 1;
    }
    return res.json({ success: true, data: { concluded: count } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.syncCourseRoster = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const course = await Course.findOne(withTenantFilter({ _id: req.params.courseId }, tenantId));
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const rows = await syncEnrollmentsFromCourseStudents(course);
    return res.json({ success: true, data: { synced: rows.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— Holds ———

exports.listHolds = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const filter = withTenantFilter({}, tenantId);
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.active !== 'false') filter.isActive = true;
    const holds = await StudentHold.find(filter)
      .populate('studentId', 'firstName lastName email')
      .populate('placedBy', 'firstName lastName')
      .sort({ placedAt: -1 })
      .limit(500)
      .lean();
    return res.json({ success: true, count: holds.length, data: holds });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.placeHold = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const {
      studentId,
      holdType,
      reason,
      blocksRegistration,
      blocksTranscript,
      blocksGrades,
      source,
    } = req.body || {};
    if (!studentId || !holdType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'studentId, holdType, and reason are required',
      });
    }
    const student = await User.findOne(withTenantFilter({ _id: studentId }, tenantId));
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const hold = await StudentHold.create({
      studentId,
      holdType,
      reason: String(reason).trim(),
      source: source || 'manual',
      placedBy: req.user._id,
      blocksRegistration: blocksRegistration !== false,
      blocksTranscript: Boolean(blocksTranscript),
      blocksGrades: Boolean(blocksGrades),
      rootAccountId: tenantId,
      accountId: tenantId,
    });
    return res.status(201).json({ success: true, data: hold });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.releaseHold = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const hold = await StudentHold.findOne(withTenantFilter({ _id: req.params.id }, tenantId));
    if (!hold) return res.status(404).json({ success: false, message: 'Hold not found' });
    hold.isActive = false;
    hold.releasedAt = new Date();
    hold.releasedBy = req.user._id;
    await hold.save();
    return res.json({ success: true, data: hold });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— SIS ———

const sisOffice = require('../services/registrar/sisOffice.service');

exports.stageSisImport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { provider = 'csv', rows, csvText, kind } = req.body || {};
    const entity = kind || req.query.kind || 'enrollment';

    if (entity === 'users' || entity === 'user') {
      const result = await sisOffice.stageUsersImport({
        tenantId,
        accountId: req.user.accountId,
        rows,
        csvText,
        provider,
        createdBy: req.user._id,
      });
      return res.status(201).json({ success: true, data: result });
    }
    if (entity === 'sections' || entity === 'section') {
      const result = await sisOffice.stageSectionsImport({
        tenantId,
        accountId: req.user.accountId,
        rows,
        csvText,
        provider,
        createdBy: req.user._id,
      });
      return res.status(201).json({ success: true, data: result });
    }

    if (csvText || (Array.isArray(rows) && rows.length && (rows[0].sis_student_id || rows[0].sis_section_id))) {
      const result = await sisOffice.stageEnrollmentsImport({
        tenantId,
        accountId: req.user.accountId,
        rows,
        csvText,
        provider,
        createdBy: req.user._id,
      });
      return res.status(201).json({ success: true, data: result });
    }

    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: 'rows[] or csvText required' });
    }
    const result = await stageEnrollmentImport(provider, rows, {
      rootAccountId: tenantId,
      createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.importSisKind = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const kind = req.params.kind;
    req.body = { ...(req.body || {}), kind };
    return exports.stageSisImport(req, res);
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listSisStaging = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    if (req.query.inbox === '1' || req.query.entityType) {
      const rows = await sisOffice.listSyncRows(tenantId, {
        batchId: req.query.batchId,
        status: req.query.status,
        entityType: req.query.entityType,
        limit: req.query.limit,
      });
      return res.json({ success: true, count: rows.length, data: rows });
    }
    const filter = withTenantFilter({}, tenantId);
    if (req.query.batchId) filter.batchId = req.query.batchId;
    if (req.query.status) filter.status = req.query.status;
    const rows = await SisStagingEnrollment.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.patchSisStagingRow = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await sisOffice.patchSyncRow(
      tenantId,
      req.params.id,
      {
        status: req.body?.status,
        overrideReason: req.body?.overrideReason,
      },
      req.user
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

exports.applySisBatch = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { batchId, approvePending, async: asyncFlag } = req.body || {};
    if (!batchId) {
      return res.status(400).json({ success: false, message: 'batchId is required' });
    }

    const useAsync = asyncFlag === true;
    if (useAsync) {
      const jobQueueService = require('../services/jobQueue.service');
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'sis.import_apply',
        {
          batchId,
          approvePending: approvePending !== false,
          rootAccountId: tenantId,
        },
        req.user,
        { rootAccountId: tenantId }
      );
      return res.status(isAsync ? 202 : 200).json({
        success: true,
        data: { jobId: job._id, status: job.status, async: isAsync, result: job.result },
      });
    }

    const result = await sisOffice.applySyncBatch(batchId, {
      tenantId,
      actorId: req.user._id,
      approvePending: approvePending !== false,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listSisJobs = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const jobs = await SisJob.find(withTenantFilter({}, tenantId))
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, count: jobs.length, data: jobs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listSisBatches = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await sisOffice.listBatches(tenantId, { limit: req.query.limit });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSisConfig = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await sisOffice.getOrCreateConfig(tenantId, req.user.accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSisConfig = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await sisOffice.updateConfig(tenantId, req.body || {}, req.user.accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.exportSisGrades = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const term = req.query.term || req.body?.term;
    const year = req.query.year || req.body?.year;
    const academicTermId = req.query.termId || req.body?.termId;
    const asyncFlag = req.query.async === 'true' || req.body?.async === true;

    if (!term && !year && !academicTermId) {
      return res.status(400).json({
        success: false,
        message: 'term+year or termId required',
      });
    }

    if (asyncFlag) {
      const jobQueueService = require('../services/jobQueue.service');
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'sis.grade_export',
        {
          term,
          year: year ? Number(year) : undefined,
          academicTermId,
          notes: req.body?.notes,
          rootAccountId: tenantId,
        },
        req.user,
        { rootAccountId: tenantId }
      );
      return res.status(isAsync ? 202 : 200).json({
        success: true,
        data: { jobId: job._id, status: job.status, async: isAsync, result: job.result },
      });
    }

    const data = await sisOffice.exportGradesPassback({
      tenantId,
      accountId: req.user.accountId,
      term,
      year: year ? Number(year) : undefined,
      academicTermId,
      exportedBy: req.user._id,
      notes: req.body?.notes,
    });

    if (req.query.format === 'csv' || req.headers.accept?.includes('text/csv')) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="grades-${term || 'term'}-${year || ''}.csv"`
      );
      return res.send(data.csvText);
    }

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listGradePassbacks = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await sisOffice.listPassbackRecords(tenantId, { limit: req.query.limit });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.enrollmentSummaryReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const match = withTenantFilter({}, tenantId);
    if (req.query.termId) match.academicTermId = req.query.termId;

    const summary = await Enrollment.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return res.json({
      success: true,
      data: {
        byStatus: summary,
        total: summary.reduce((n, r) => n + r.count, 0),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— R1 Office: dashboard, student search, grade status ———

exports.getDashboard = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const match = withTenantFilter({}, tenantId);
    const termId = req.query.termId;

    const enrollmentMatch = { ...match };
    if (termId) enrollmentMatch.academicTermId = termId;

    const [byStatus, activeHolds, sisErrorCount, activeTerms, courses] = await Promise.all([
      Enrollment.aggregate([
        { $match: enrollmentMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      StudentHold.countDocuments(withTenantFilter({ isActive: true }, tenantId)),
      SisStagingEnrollment.countDocuments(
        withTenantFilter(
          {
            $or: [{ status: 'rejected' }, { applyError: { $exists: true, $nin: [null, ''] } }],
          },
          tenantId
        )
      ),
      AcademicTerm.countDocuments(withTenantFilter({ status: { $in: ['active', 'grading'] } }, tenantId)),
      Course.find(
        withTenantFilter(termId ? { academicTermId: termId } : { academicTermId: { $ne: null } }, tenantId)
      )
        .select('_id academicTermId title')
        .lean(),
    ]);

    const courseIds = courses.map((c) => c._id);
    const lifecycles = courseIds.length
      ? await CourseGradeLifecycle.find(withTenantFilter({ course: { $in: courseIds } }, tenantId))
          .select('course status')
          .lean()
      : [];
    const lifeByCourse = new Map(lifecycles.map((l) => [String(l.course), l.status]));
    let finalized = 0;
    let unfinalized = 0;
    for (const c of courses) {
      const st = lifeByCourse.get(String(c._id));
      if (st === 'FINALIZED' || st === 'AMENDED') finalized += 1;
      else unfinalized += 1;
    }

    return res.json({
      success: true,
      data: {
        enrollments: {
          byStatus,
          total: byStatus.reduce((n, r) => n + r.count, 0),
        },
        activeHolds,
        sisErrors: sisErrorCount,
        activeTerms,
        gradeStatus: {
          coursesLinked: courses.length,
          finalized,
          unfinalized,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchStudents = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const { filter } = await buildStudentScopeFilter(req);
    const q = String(req.query.q || req.query.search || '').trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, message: 'q must be at least 2 characters' });
    }

    const or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { 'studentProfile.admissionNumber': { $regex: q, $options: 'i' } },
      { 'studentProfile.studentId': { $regex: q, $options: 'i' } },
      { 'studentProfile.externalIds.sis': { $regex: q, $options: 'i' } },
    ];
    if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
      or.push({ _id: q });
    }
    filter.$or = or;

    const students = await User.find(filter)
      .select('firstName lastName email role accountStatus createdAt studentProfile accountId')
      .populate('studentProfile.programId', 'code name level')
      .sort({ lastName: 1, firstName: 1 })
      .limit(Math.min(50, parseInt(req.query.limit, 10) || 25))
      .lean();

    return res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** Full student 360° payload (replaces R1 stub). */
exports.getStudentStub = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const { filter, tenantId } = await buildStudentScopeFilter(req, { _id: req.params.id });

    const student = await User.findOne(filter)
      .select('firstName lastName email role accountStatus createdAt studentProfile accountId rootAccountId')
      .populate('studentProfile.programId', 'code name level durationTerms requiredCredits')
      .lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const [enrollments, holds, grades, transcripts, auditEvents] = await Promise.all([
      Enrollment.find(withTenantFilter({ studentId: student._id }, tenantId))
        .populate('lmsCourseId', 'title catalog.courseCode')
        .populate('academicTermId', 'name code')
        .populate('sectionId', 'sectionNumber')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean(),
      StudentHold.find(withTenantFilter({ studentId: student._id }, tenantId))
        .populate('placedBy', 'firstName lastName email')
        .populate('releasedBy', 'firstName lastName email')
        .sort({ placedAt: -1 })
        .limit(100)
        .lean(),
      StudentCourseGradeSnapshot.find(withTenantFilter({ student: student._id }, tenantId))
        .populate('course', 'title catalog.courseCode rootAccountId')
        .sort({ year: -1, term: 1, createdAt: -1 })
        .limit(100)
        .lean(),
      TranscriptIssueLog.find(withTenantFilter({ student: student._id }, tenantId))
        .populate('issuedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      SystemAuditEvent.find({
        ...(tenantId ? { rootAccountId: tenantId } : {}),
        $or: [
          { entityType: 'User', entityId: String(student._id) },
          { entityType: 'student', entityId: String(student._id) },
          { 'metadata.studentId': String(student._id) },
        ],
      })
        .populate('actor', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const gradeRows = grades || [];

    const courseIds = [
      ...enrollments.map((e) => e.lmsCourseId?._id || e.lmsCourseId),
      ...gradeRows.map((g) => g.course?._id || g.course),
    ].filter(Boolean);

    const amendments = courseIds.length
      ? await GradeAmendmentRecord.find({ course: { $in: courseIds } })
          .populate('course', 'title catalog.courseCode')
          .populate('amendedBy', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
      : [];

    const enrollmentAudit = [];
    for (const e of enrollments) {
      for (const h of e.statusHistory || []) {
        enrollmentAudit.push({
          source: 'enrollment',
          at: h.at,
          status: h.status,
          reason: h.reason,
          enrollmentId: e._id,
          course: e.lmsCourseId,
        });
      }
    }
    enrollmentAudit.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

    return res.json({
      success: true,
      data: {
        student,
        enrollments,
        holds,
        grades: gradeRows,
        transcripts,
        audit: {
          system: auditEvents,
          enrollmentHistory: enrollmentAudit.slice(0, 50),
          amendments,
        },
        documents: student.studentProfile?.documents || [],
        note: 'Bonafide / TC certificates: queue via /registrar/transcripts (request types bonafide, migration_tc).',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStudentProfile = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const { filter, tenantId } = await buildStudentScopeFilter(req, { _id: req.params.id });
    const student = await User.findOne(filter);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const body = req.body || {};
    const profile = student.studentProfile || {};
    const allowed = [
      'studentId',
      'admissionNumber',
      'programId',
      'batch',
      'currentYear',
      'division',
      'dateOfBirth',
      'guardianName',
      'guardianPhone',
      'address',
      'externalIds',
      'documents',
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'address' && body.address && typeof body.address === 'object') {
          profile.address = { ...(profile.address?.toObject?.() || profile.address || {}), ...body.address };
        } else if (key === 'externalIds' && body.externalIds && typeof body.externalIds === 'object') {
          profile.externalIds = {
            ...(profile.externalIds?.toObject?.() || profile.externalIds || {}),
            ...body.externalIds,
          };
        } else if (key === 'programId') {
          profile.programId = body.programId || null;
          if (body.programId) {
            const prog = await Program.findOne(withTenantFilter({ _id: body.programId }, tenantId));
            if (!prog) {
              return res.status(400).json({ success: false, message: 'Program not found' });
            }
          }
        } else {
          profile[key] = body[key];
        }
      }
    }
    student.studentProfile = profile;
    await student.save();

    try {
      await SystemAuditEvent.create({
        actor: req.user._id,
        entityType: 'User',
        entityId: String(student._id),
        action: 'registrar.student.profile_updated',
        after: student.studentProfile,
        rootAccountId: tenantId,
        metadata: { studentId: String(student._id) },
        ip: req.ip,
      });
    } catch (auditErr) {
      console.warn('Student profile audit failed:', auditErr.message);
    }

    const populated = await User.findById(student._id)
      .select('firstName lastName email role accountStatus studentProfile accountId')
      .populate('studentProfile.programId', 'code name level')
      .lean();

    return res.json({ success: true, data: populated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— Programs ———

exports.listPrograms = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const tenantId = rootAccountIdFromRequest(req);
    const filter = withTenantFilter({}, tenantId);
    if (req.query.active === 'false' || req.query.active === 'all') {
      // include inactive
    } else {
      filter.isActive = true;
    }
    if (
      req.user.role === 'department_admin' &&
      req.user.accountId &&
      String(req.user.accountId) !== String(tenantId)
    ) {
      const { accountSubtreeFilter } = require('../services/tenancy/academicStructure.service');
      const subtree = await accountSubtreeFilter(tenantId, req.user.accountId);
      Object.assign(filter, subtree);
      // Programs may be at root or in subtree — also allow null subAccountId for shared programs? keep subtree only
    }
    const programs = await Program.find(filter).sort({ code: 1 }).lean();
    return res.json({ success: true, count: programs.length, data: programs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProgram = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const tenantId = rootAccountIdFromRequest(req);
    const { code, name, level, durationTerms, requiredCredits, subAccountId, description } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'code and name are required' });
    }
    const program = await Program.create({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      level: level || 'other',
      durationTerms: durationTerms ?? 0,
      requiredCredits: requiredCredits ?? 0,
      subAccountId: subAccountId || req.user.accountId || tenantId,
      description: description || '',
      rootAccountId: tenantId,
      accountId: subAccountId || req.user.accountId || tenantId,
    });
    return res.status(201).json({ success: true, data: program });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Program code already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProgram = async (req, res) => {
  try {
    if (!assertCanAccessStudentApi(req, res)) return;
    const tenantId = rootAccountIdFromRequest(req);
    const program = await Program.findOne(withTenantFilter({ _id: req.params.id }, tenantId));
    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    const allowed = [
      'name',
      'level',
      'durationTerms',
      'requiredCredits',
      'subAccountId',
      'description',
      'isActive',
      'gradingScaleId',
    ];
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) program[key] = req.body[key];
    }
    await program.save();
    return res.json({ success: true, data: program });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTermGradeStatus = async (req, res) => {
  try {
    const { buildAccountScopeFilter } = require('../services/registrar/studentScope.service');
    const { filter: courseFilter, tenantId } = await buildAccountScopeFilter(req, {
      academicTermId: req.params.termId,
    });
    const term = await AcademicTerm.findOne(withTenantFilter({ _id: req.params.termId }, tenantId)).lean();
    if (!term) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }

    const courses = await Course.find(courseFilter)
      .select('title catalog academicTermId sectionId sectionNumber semester')
      .lean();
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
        lifecycleStatus: life?.status || 'NONE',
        finalizedAt: life?.finalizedAt || null,
        studentSnapshotCount: life?.studentSnapshotCount || 0,
        term: life?.term || term.legacyTermLabel || term.code,
        year: life?.year || term.legacyYear || null,
      };
    });

    const counts = rows.reduce(
      (acc, r) => {
        acc[r.lifecycleStatus] = (acc[r.lifecycleStatus] || 0) + 1;
        return acc;
      },
      /** @type {Record<string, number>} */ ({})
    );

    return res.json({
      success: true,
      data: {
        term: { _id: term._id, name: term.name, code: term.code, status: term.status },
        counts,
        rows,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— R4 term-wide grade governance ———

const termGradeGovernance = require('../services/registrar/termGradeGovernance.service');

exports.previewTermFinalize = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await termGradeGovernance.previewTermFinalize(tenantId, req.params.termId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.applyTermFinalize = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { async: asyncFlag, courseIds } = req.body || {};
    const preview = await termGradeGovernance.previewTermFinalize(tenantId, req.params.termId);
    const targets = Array.isArray(courseIds) && courseIds.length
      ? preview.readyCourseIds.filter((id) => courseIds.map(String).includes(String(id)))
      : preview.readyCourseIds;

    const jobQueueService = require('../services/jobQueue.service');
    const useAsync =
      asyncFlag === true ||
      (asyncFlag !== false && targets.length > 1);

    if (useAsync && targets.length) {
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'grades.term_finalize',
        {
          termId: String(req.params.termId),
          userId: String(req.user._id),
          courseIds: targets,
          rootAccountId: tenantId,
        },
        req.user,
        { rootAccountId: tenantId }
      );
      return res.status(isAsync ? 202 : 200).json({
        success: true,
        data: {
          jobId: job._id,
          status: job.status,
          async: isAsync,
          toFinalize: targets.length,
          result: job.result,
        },
      });
    }

    const data = await termGradeGovernance.finalizeCoursesInTerm({
      tenantId,
      termId: req.params.termId,
      user: req.user,
      courseIds: targets,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getTermGradesDashboard = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await termGradeGovernance.getTermGradesDashboard(tenantId, req.params.termId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listInstitutionGradingPeriods = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await termGradeGovernance.listInstitutionPeriods(tenantId, req.params.termId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createInstitutionGradingPeriod = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    if (!req.body?.name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const data = await termGradeGovernance.createInstitutionPeriod(
      tenantId,
      req.params.termId,
      req.body,
      req.user
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.updateInstitutionGradingPeriod = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await termGradeGovernance.updateInstitutionPeriod(
      tenantId,
      req.params.id,
      req.body || {}
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.closeInstitutionGradingPeriod = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await termGradeGovernance.closeInstitutionPeriod(
      tenantId,
      req.params.id,
      req.user
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.inheritGradingPeriods = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await termGradeGovernance.inheritPeriodsToTermCourses(
      tenantId,
      req.params.termId
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getTermFinalizeJob = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const AsyncJob = require('../models/asyncJob.model');
    const job = await AsyncJob.findOne(
      withTenantFilter(
        {
          _id: req.params.jobId,
          type: { $in: ['grades.term_finalize', 'transcript.bulk_issue', 'sis.import_apply', 'sis.grade_export'] },
        },
        tenantId
      )
    ).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, data: job });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const transcriptOffice = require('../services/registrar/transcriptOffice.service');

exports.listTranscriptTemplates = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await transcriptOffice.listTemplates(tenantId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createTranscriptTemplate = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await transcriptOffice.createTemplate(tenantId, req.body || {}, req.user.accountId);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.updateTranscriptTemplate = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await transcriptOffice.updateTemplate(tenantId, req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listTranscriptRequests = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await transcriptOffice.listRequests(tenantId, {
      status: req.query.status,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createTranscriptRequest = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { studentId, term, year } = req.body || {};
    if (!studentId || !term || !year) {
      return res.status(400).json({ success: false, message: 'studentId, term, and year are required' });
    }
    const data = await transcriptOffice.createRequest(tenantId, req.body, req.user.accountId);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.patchTranscriptRequest = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await transcriptOffice.patchRequest(tenantId, req.params.id, req.body || {}, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.fulfillTranscriptRequest = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const data = await transcriptOffice.fulfillRequest(tenantId, req.params.id, req.user, {
      ip: req.ip,
    });
    if (data.certificate) {
      return res.status(201).json({
        success: true,
        data: {
          certificate: true,
          type: data.type,
          locale: data.locale,
          pdfBase64: data.pdfBase64,
          studentName: data.studentName,
          requestId: data.requestId,
          issueLog: data.log,
        },
      });
    }
    return res.status(201).json({
      success: true,
      data: {
        issueLog: data.log,
        transcriptHash: data.transcriptHash,
        verifyUrl: data.verifyUrl,
        courseCount: data.payload?.courses?.length || 0,
        gpaSummary: data.gpaSummary,
        pdfBase64: data.pdfBase64,
        templateId: data.templateId,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

exports.issueOfficialTranscriptOffice = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { studentId, term, year, notes, templateId, requestId } = req.body || {};
    if (!studentId || !term || !year) {
      return res.status(400).json({ success: false, message: 'studentId, term, and year are required' });
    }
    const data = await transcriptOffice.issueWithPdf({
      tenantId,
      studentId,
      term,
      year: Number(year),
      issuedBy: req.user,
      notes,
      ip: req.ip,
      templateId,
      requestId,
    });
    return res.status(201).json({
      success: true,
      data: {
        issueLog: data.log,
        transcriptHash: data.transcriptHash,
        verifyUrl: data.verifyUrl,
        courseCount: data.payload.courses.length,
        gpaSummary: data.gpaSummary,
        pdfBase64: data.pdfBase64,
        templateId: data.templateId,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
      ineligible: err.ineligible,
    });
  }
};

exports.previewBulkTranscriptIssue = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { term, year, studentIds } = req.body || {};
    if (!term || !year) {
      return res.status(400).json({ success: false, message: 'term and year are required' });
    }
    const data = await transcriptOffice.previewBulkIssue(tenantId, {
      term,
      year: Number(year),
      studentIds,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.applyBulkTranscriptIssue = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { term, year, studentIds, notes, templateId, async: asyncFlag } = req.body || {};
    if (!term || !year) {
      return res.status(400).json({ success: false, message: 'term and year are required' });
    }

    const preview = await transcriptOffice.previewBulkIssue(tenantId, {
      term,
      year: Number(year),
      studentIds,
    });
    const targets = preview.readyStudentIds;
    if (!targets.length) {
      return res.status(400).json({
        success: false,
        message: 'No students ready for official issuance',
        data: preview,
      });
    }

    const useAsync =
      asyncFlag === true || (asyncFlag !== false && targets.length > 1);
    if (useAsync) {
      const jobQueueService = require('../services/jobQueue.service');
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'transcript.bulk_issue',
        {
          term,
          year: Number(year),
          studentIds: targets,
          notes,
          templateId,
          ip: req.ip,
          rootAccountId: tenantId,
        },
        req.user,
        { rootAccountId: tenantId }
      );
      return res.status(isAsync ? 202 : 200).json({
        success: true,
        data: {
          jobId: job._id,
          status: job.status,
          async: isAsync,
          toIssue: targets.length,
          result: job.result,
        },
      });
    }

    const data = await transcriptOffice.bulkIssueSync({
      tenantId,
      term,
      year: Number(year),
      studentIds: targets,
      issuedBy: req.user,
      notes,
      ip: req.ip,
      templateId,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.exportSectionRoster = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.exportSectionRosterCsv(tenantId, req.params.sectionId);
    if (req.query.format === 'json') {
      return res.json({ success: true, data: { count: data.count, section: data.section } });
    }
    res.setHeader('Content-Type', 'text/csv');
    const filename = `roster-${data.section.sectionNumber || 'section'}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(data.csvText);
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.structureGapReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.structureGapReport(tenantId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.backfillStructure = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.backfillMissingStructure(tenantId, {
      limit: req.body?.limit || req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
