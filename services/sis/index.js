const crypto = require('crypto');
const SisStagingEnrollment = require('../../models/sisStagingEnrollment.model');
const SisJob = require('../../models/sisJob.model');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const CourseSection = require('../../models/courseSection.model');
const { activateEnrollment } = require('../registrar/enrollmentWrite.service');
const { withTenantFilter } = require('../../utils/tenantContext');

function normalizeRow(provider, row) {
  return {
    provider,
    externalStudentId: String(
      row.externalStudentId || row.studentId || row.emplid || row.sisStudentId || row.sis_student_id || ''
    ),
    externalCourseId: String(
      row.externalCourseId ||
        row.courseId ||
        row.crse_id ||
        row.sisSectionId ||
        row.sis_section_id ||
        ''
    ),
    studentEmail: row.studentEmail || row.email || null,
    courseCode: row.courseCode || row.catalogNbr || row.course_code || null,
    term: row.term || null,
    year: row.year ? Number(row.year) : null,
    academicTermId: row.academicTermId || null,
    lmsCourseId: row.lmsCourseId || null,
    sisSectionId: row.sisSectionId || row.sis_section_id || null,
    rawPayload: row,
  };
}

async function stageEnrollmentImport(provider, rows, { batchId, rootAccountId, createdBy } = {}) {
  if (!rootAccountId) {
    const err = new Error('rootAccountId is required for SIS staging');
    err.status = 400;
    throw err;
  }

  const id = batchId || crypto.randomBytes(8).toString('hex');
  const docs = rows
    .map((r) => normalizeRow(provider, r))
    .map((r) => {
      if (!r.externalStudentId && r.studentEmail) {
        r.externalStudentId = String(r.studentEmail).toLowerCase();
      }
      if (!r.externalCourseId && (r.courseCode || r.sisSectionId)) {
        r.externalCourseId = String(r.sisSectionId || r.courseCode);
      }
      return r;
    })
    .filter((r) => r.externalStudentId && (r.externalCourseId || r.courseCode || r.lmsCourseId));

  if (!docs.length) {
    return { batchId: id, staged: 0 };
  }

  await SisStagingEnrollment.insertMany(
    docs.map((d) => ({
      ...d,
      batchId: id,
      status: 'pending',
      rootAccountId,
      accountId: rootAccountId,
    }))
  );

  await SisJob.create({
    jobType: 'enrollment_import',
    provider,
    batchId: id,
    status: 'completed',
    stagedCount: docs.length,
    createdBy: createdBy || null,
    finishedAt: new Date(),
    rootAccountId,
    accountId: rootAccountId,
  });

  return { batchId: id, staged: docs.length };
}

async function resolveStudent(rootAccountId, row) {
  if (row.resolvedStudentId) {
    return User.findOne(withTenantFilter({ _id: row.resolvedStudentId }, rootAccountId));
  }
  const sisId = row.externalStudentId || row.sisStudentId || row.rawPayload?.sis_student_id;
  if (sisId) {
    const bySis = await User.findOne(
      withTenantFilter({ 'studentProfile.externalIds.sis': String(sisId).trim() }, rootAccountId)
    );
    if (bySis) return bySis;
  }
  if (row.studentEmail) {
    return User.findOne(
      withTenantFilter({ email: String(row.studentEmail).toLowerCase().trim() }, rootAccountId)
    );
  }
  return null;
}

async function resolveCourse(rootAccountId, row) {
  if (row.lmsCourseId) {
    return Course.findOne(withTenantFilter({ _id: row.lmsCourseId }, rootAccountId));
  }
  const sisSectionId =
    row.sisSectionId || row.externalCourseId || row.rawPayload?.sis_section_id;
  if (sisSectionId) {
    const section = await CourseSection.findOne(
      withTenantFilter({ sisSectionId: String(sisSectionId).trim() }, rootAccountId)
    ).lean();
    if (section?.lmsCourseId) {
      return Course.findOne(withTenantFilter({ _id: section.lmsCourseId }, rootAccountId));
    }
  }
  if (row.courseCode) {
    return Course.findOne(
      withTenantFilter(
        { 'catalog.courseCode': String(row.courseCode).trim().toUpperCase() },
        rootAccountId
      )
    );
  }
  return null;
}

/**
 * Apply approved (or pending→approved) staging rows to Enrollment + Course.students.
 */
async function applyStagingBatch(batchId, { rootAccountId, actorId, approvePending = true } = {}) {
  if (!rootAccountId || !batchId) {
    const err = new Error('rootAccountId and batchId are required');
    err.status = 400;
    throw err;
  }

  const filter = withTenantFilter(
    {
      batchId,
      status: approvePending ? { $in: ['pending', 'approved'] } : 'approved',
    },
    rootAccountId
  );

  const rows = await SisStagingEnrollment.find(filter);
  let applied = 0;
  let rejected = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const student = await resolveStudent(rootAccountId, row);
      const course = await resolveCourse(rootAccountId, {
        ...row.toObject?.() || row,
        sisSectionId: row.rawPayload?.sisSectionId || row.rawPayload?.sis_section_id || row.externalCourseId,
      });
      if (!student || !course) {
        row.status = 'rejected';
        row.reviewedBy = actorId;
        row.applyError = !student ? 'Student not found' : 'Course not found';
        await row.save();
        rejected += 1;
        continue;
      }

      row.resolvedStudentId = student._id;
      row.lmsCourseId = course._id;
      await activateEnrollment({
        course,
        studentId: student._id,
        actorId,
        source: 'sis',
        sisEnrollmentId:
          row.rawPayload?.sisEnrollmentId ||
          row.rawPayload?.sis_enrollment_id ||
          `${row.provider}:${row.externalStudentId}:${row.externalCourseId}:${batchId}`,
      });

      row.status = 'applied';
      row.appliedAt = new Date();
      row.reviewedBy = actorId;
      row.applyError = '';
      await row.save();
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

  await SisJob.findOneAndUpdate(
    withTenantFilter({ batchId }, rootAccountId),
    {
      $set: {
        status: errors.length && applied ? 'partial' : errors.length ? 'failed' : 'completed',
        appliedCount: applied,
        rejectedCount: rejected,
        errorCount: errors.length,
        finishedAt: new Date(),
      },
    }
  );

  return { batchId, applied, rejected, errors };
}

const adapters = {
  banner: (rows, opts) => stageEnrollmentImport('banner', rows, opts),
  peoplesoft: (rows, opts) => stageEnrollmentImport('peoplesoft', rows, opts),
  workday: (rows, opts) => stageEnrollmentImport('workday', rows, opts),
  csv: (rows, opts) => stageEnrollmentImport('csv', rows, opts),
  custom_rest: (rows, opts) => stageEnrollmentImport('custom_rest', rows, opts),
  fedena: (rows, opts) => stageEnrollmentImport('fedena', rows, opts),
  mastersoft: (rows, opts) => stageEnrollmentImport('mastersoft', rows, opts),
};

module.exports = {
  adapters,
  stageEnrollmentImport,
  applyStagingBatch,
  resolveStudent,
  resolveCourse,
  SisStagingEnrollment,
};
