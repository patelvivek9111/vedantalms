const AcademicTerm = require('../../models/academicTerm.model');
const CourseOffering = require('../../models/courseOffering.model');
const CourseSection = require('../../models/courseSection.model');
const Course = require('../../models/course.model');
const { withTenantFilter } = require('../../utils/tenantContext');

/**
 * Find or create an AcademicTerm from legacy Course.semester fields.
 */
async function resolveOrCreateTermFromSemester({
  rootAccountId,
  accountId,
  semester,
  academicYearLabel,
  startDate,
  endDate,
}) {
  if (!rootAccountId || !semester?.term) return null;

  const year = semester.year || new Date().getFullYear();
  const code = `${String(semester.term).toUpperCase().replace(/\s+/g, '')}${year}`.slice(0, 64);

  let term = await AcademicTerm.findOne(
    withTenantFilter(
      {
        $or: [
          { code },
          { legacyTermLabel: semester.term, legacyYear: year },
        ],
      },
      rootAccountId
    )
  );

  if (!term) {
    const now = new Date();
    const status =
      startDate && endDate
        ? now < new Date(startDate)
          ? 'upcoming'
          : now > new Date(endDate)
            ? 'closed'
            : 'active'
        : 'active';

    term = await AcademicTerm.create({
      name: `${semester.term} ${year}`,
      code,
      termType: 'semester',
      legacyTermLabel: semester.term,
      legacyYear: year,
      startDate: startDate || null,
      endDate: endDate || null,
      enrollmentOpenDate: startDate || null,
      enrollmentCloseDate: endDate || null,
      status,
      academicYearLabel: academicYearLabel || `${year}`,
      rootAccountId,
      accountId: accountId || rootAccountId,
      isDefault: false,
    });
  }

  return term;
}

async function getActiveTerms(rootAccountId) {
  return AcademicTerm.find(
    withTenantFilter({ status: { $in: ['upcoming', 'active', 'grading'] } }, rootAccountId)
  )
    .sort({ startDate: 1, name: 1 })
    .lean();
}

/**
 * Ensure CourseOffering + CourseSection exist for an LMS Course (idempotent).
 */
async function ensureOfferingAndSectionForCourse(course, { sectionNumber = '001' } = {}) {
  if (!course?._id || !course.rootAccountId) return null;

  const rootAccountId = course.rootAccountId;
  const accountId = course.accountId || rootAccountId;
  const courseCode =
    (course.catalog?.courseCode && String(course.catalog.courseCode).trim()) ||
    `CRS-${String(course._id).slice(-6).toUpperCase()}`;

  let offering = await CourseOffering.findOne(
    withTenantFilter({ courseCode: courseCode.toUpperCase() }, rootAccountId)
  );
  if (!offering) {
    offering = await CourseOffering.create({
      courseCode: courseCode.toUpperCase(),
      title: course.title,
      description: course.description || '',
      credits: course.catalog?.creditHours || 0,
      subjectCode: course.catalog?.subject || '',
      isActive: true,
      blueprintCourseId: course._id,
      rootAccountId,
      accountId,
    });
  }

  let term = null;
  if (course.academicTermId) {
    term = await AcademicTerm.findById(course.academicTermId);
  }
  if (!term) {
    term = await resolveOrCreateTermFromSemester({
      rootAccountId,
      accountId,
      semester: course.semester,
      academicYearLabel: course.academicYearLabel,
      startDate: course.catalog?.startDate,
      endDate: course.catalog?.endDate,
    });
  }

  if (!term) return { offering, section: null, term: null };

  let section = await CourseSection.findOne({
    lmsCourseId: course._id,
    rootAccountId,
  });

  if (!section) {
    section = await CourseSection.create({
      offeringId: offering._id,
      academicTermId: term._id,
      sectionNumber,
      instructorId: course.instructor,
      teachingAssistantIds: course.teachingAssistants || [],
      maxEnrollment: course.catalog?.maxStudents ?? null,
      // Default open self-enroll; only force approval when explicitly configured.
      enrollmentMethod:
        course.catalog?.enrollmentMethod ||
        (course.catalog?.requireEnrollmentApproval ? 'approval' : 'open'),
      status: course.published ? 'published' : 'planned',
      lmsCourseId: course._id,
      rootAccountId,
      accountId,
    });
  }

  await Course.updateOne(
    { _id: course._id },
    {
      $set: {
        academicTermId: term._id,
        offeringId: offering._id,
        sectionId: section._id,
        sectionNumber: section.sectionNumber || sectionNumber,
      },
    }
  );

  return { offering, section, term };
}

async function assertTermEnrollmentOpen(academicTermId) {
  if (!academicTermId) return { ok: true };
  const term = await AcademicTerm.findById(academicTermId).lean();
  if (!term) return { ok: true };
  if (!AcademicTerm.isEnrollmentOpen(term)) {
    return {
      ok: false,
      message: `Enrollment is closed for term ${term.name}`,
      term,
    };
  }
  return { ok: true, term };
}

/**
 * Sub-account catalog visibility: accountId is this account or any descendant.
 * For Phase 3, if accountId equals root, return all under root; else filter exact accountId
 * plus children (one-level parent walk via Account tree).
 */
async function accountSubtreeFilter(rootAccountId, accountId) {
  if (!accountId || String(accountId) === String(rootAccountId)) {
    return withTenantFilter({}, rootAccountId);
  }
  const Account = require('../../models/account.model');
  const ids = new Set([String(accountId)]);
  let frontier = [accountId];
  while (frontier.length) {
    const children = await Account.find({
      rootAccountId,
      parentAccountId: { $in: frontier },
      workflowState: { $ne: 'deleted' },
    })
      .select('_id')
      .lean();
    frontier = [];
    for (const c of children) {
      const id = String(c._id);
      if (!ids.has(id)) {
        ids.add(id);
        frontier.push(c._id);
      }
    }
  }
  return withTenantFilter(
    { accountId: { $in: [...ids] } },
    rootAccountId
  );
}

module.exports = {
  resolveOrCreateTermFromSemester,
  getActiveTerms,
  ensureOfferingAndSectionForCourse,
  assertTermEnrollmentOpen,
  accountSubtreeFilter,
};
