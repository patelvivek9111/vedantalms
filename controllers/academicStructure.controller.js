const AcademicTerm = require('../models/academicTerm.model');
const CourseOffering = require('../models/courseOffering.model');
const CourseSection = require('../models/courseSection.model');
const CrossListGroup = require('../models/crossListGroup.model');
const Course = require('../models/course.model');
const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');
const {
  resolveOrCreateTermFromSemester,
  ensureOfferingAndSectionForCourse,
  accountSubtreeFilter,
} = require('../services/tenancy/academicStructure.service');

const TERM_MANAGERS = new Set(['admin', 'registrar', 'department_admin', 'platform_admin']);

function canManageTerms(user) {
  return user && TERM_MANAGERS.has(user.role);
}

function canManageOfferings(user) {
  return user && ['admin', 'registrar', 'department_admin', 'teacher', 'platform_admin'].includes(user.role);
}

// ——— Academic Terms ———

exports.listTerms = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const status = req.query.status;
    const filter = withTenantFilter({}, tenantId);
    if (status && status !== 'all') filter.status = status;

    const terms = await AcademicTerm.find(filter).sort({ startDate: 1, name: 1 }).lean();
    return res.json({ success: true, count: terms.length, data: terms });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTerm = async (req, res) => {
  try {
    if (!canManageTerms(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage terms' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const {
      name,
      code,
      termType,
      legacyTermLabel,
      legacyYear,
      startDate,
      endDate,
      enrollmentOpenDate,
      enrollmentCloseDate,
      gradingPeriodCloseDate,
      finalizeDeadline,
      status,
      sisTermCode,
      academicYearLabel,
      isDefault,
      accountId,
    } = req.body || {};

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'name and code are required' });
    }

    if (isDefault) {
      await AcademicTerm.updateMany(
        withTenantFilter({ isDefault: true }, tenantId),
        { $set: { isDefault: false } }
      );
    }

    const term = await AcademicTerm.create({
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      termType: termType || 'semester',
      legacyTermLabel: legacyTermLabel || '',
      legacyYear: legacyYear ?? null,
      startDate: startDate || null,
      endDate: endDate || null,
      enrollmentOpenDate: enrollmentOpenDate || startDate || null,
      enrollmentCloseDate: enrollmentCloseDate || endDate || null,
      gradingPeriodCloseDate: gradingPeriodCloseDate || null,
      finalizeDeadline: finalizeDeadline || null,
      status: status || 'upcoming',
      sisTermCode: sisTermCode || '',
      academicYearLabel: academicYearLabel || '',
      isDefault: Boolean(isDefault),
      rootAccountId: tenantId,
      accountId: accountId || tenantId,
    });

    return res.status(201).json({ success: true, data: term });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Term code already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTerm = async (req, res) => {
  try {
    if (!canManageTerms(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage terms' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const term = await AcademicTerm.findOne(withTenantFilter({ _id: req.params.id }, tenantId));
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });

    const allowed = [
      'name',
      'termType',
      'legacyTermLabel',
      'legacyYear',
      'startDate',
      'endDate',
      'enrollmentOpenDate',
      'enrollmentCloseDate',
      'gradingPeriodCloseDate',
      'finalizeDeadline',
      'status',
      'sisTermCode',
      'academicYearLabel',
      'isDefault',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) term[key] = req.body[key];
    }
    if (req.body.isDefault === true) {
      await AcademicTerm.updateMany(
        withTenantFilter({ isDefault: true, _id: { $ne: term._id } }, tenantId),
        { $set: { isDefault: false } }
      );
    }
    await term.save();
    return res.json({ success: true, data: term });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTerm = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const term = await AcademicTerm.findOne(withTenantFilter({ _id: req.params.id }, tenantId)).lean();
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });
    return res.json({ success: true, data: term });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— Course Offerings ———

exports.listOfferings = async (req, res) => {
  try {
    const { buildAccountScopeFilter } = require('../services/registrar/studentScope.service');
    const { filter } = await buildAccountScopeFilter(req, {});
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { courseCode: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    const offerings = await CourseOffering.find(filter).sort({ courseCode: 1 }).lean();
    return res.json({ success: true, count: offerings.length, data: offerings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createOffering = async (req, res) => {
  try {
    if (!canManageOfferings(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const { courseCode, title, description, credits, level, subjectCode, prerequisites, accountId } =
      req.body || {};
    if (!courseCode || !title) {
      return res.status(400).json({ success: false, message: 'courseCode and title are required' });
    }
    const offering = await CourseOffering.create({
      courseCode: String(courseCode).trim().toUpperCase(),
      title: String(title).trim(),
      description: description || '',
      credits: credits ?? 0,
      level: level || 'other',
      subjectCode: subjectCode || '',
      prerequisites: prerequisites || [],
      rootAccountId: tenantId,
      accountId: accountId || req.accountId || tenantId,
    });
    return res.status(201).json({ success: true, data: offering });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Course code already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateOffering = async (req, res) => {
  try {
    if (!canManageOfferings(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const offering = await CourseOffering.findOne(withTenantFilter({ _id: req.params.id }, tenantId));
    if (!offering) return res.status(404).json({ success: false, message: 'Offering not found' });
    const allowed = [
      'title',
      'description',
      'credits',
      'level',
      'subjectCode',
      'prerequisites',
      'isActive',
      'blueprintCourseId',
      'accountId',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) offering[key] = req.body[key];
    }
    await offering.save();
    return res.json({ success: true, data: offering });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— Sections ———

exports.listSections = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const sections = await sectionOffice.listSectionsScoped({
      tenantId,
      user: req.user,
      termId: req.query.termId,
      offeringId: req.query.offeringId,
      status: req.query.status,
      accountId: req.query.accountId,
      search: req.query.search,
      crossListGroupId: req.query.crossListGroupId,
      lmsCourseId: req.query.lmsCourseId,
      includeStats: req.query.includeStats === '1' || req.query.includeStats === 'true',
      limit: req.query.limit,
    });
    return res.json({ success: true, count: sections.length, data: sections });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.patchSection = async (req, res) => {
  try {
    if (!canManageOfferings(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.patchSection(tenantId, req.params.id, req.body || {}, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createSection = async (req, res) => {
  try {
    if (!canManageOfferings(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const {
      offeringId,
      academicTermId,
      sectionNumber,
      instructorId,
      teachingAssistantIds,
      meetingPattern,
      maxEnrollment,
      enrollmentMethod,
      status,
      lmsCourseId,
      accountId,
    } = req.body || {};

    if (!offeringId || !academicTermId || !sectionNumber) {
      return res.status(400).json({
        success: false,
        message: 'offeringId, academicTermId, and sectionNumber are required',
      });
    }

    const [offering, term] = await Promise.all([
      CourseOffering.findOne(withTenantFilter({ _id: offeringId }, tenantId)),
      AcademicTerm.findOne(withTenantFilter({ _id: academicTermId }, tenantId)),
    ]);
    if (!offering || !term) {
      return res.status(404).json({ success: false, message: 'Offering or term not found' });
    }

    let resolvedEnrollmentMethod = enrollmentMethod;
    if (!resolvedEnrollmentMethod) {
      try {
        const academicCalendarService = require('../services/academicCalendar.service');
        const academic = await academicCalendarService.getAcademicSettings();
        resolvedEnrollmentMethod = academic.defaultEnrollmentMethod || 'open';
      } catch {
        resolvedEnrollmentMethod = 'open';
      }
    }

    const section = await CourseSection.create({
      offeringId,
      academicTermId,
      sectionNumber: String(sectionNumber).trim(),
      instructorId: instructorId || req.user._id,
      teachingAssistantIds: teachingAssistantIds || [],
      meetingPattern: meetingPattern || '',
      maxEnrollment: maxEnrollment ?? null,
      enrollmentMethod: resolvedEnrollmentMethod,
      status: status || 'planned',
      lmsCourseId: lmsCourseId || null,
      rootAccountId: tenantId,
      accountId: accountId || offering.accountId || tenantId,
    });

    if (lmsCourseId) {
      await Course.updateOne(
        withTenantFilter({ _id: lmsCourseId }, tenantId),
        {
          $set: {
            academicTermId,
            offeringId,
            sectionId: section._id,
            sectionNumber: section.sectionNumber,
            semester: {
              term: term.legacyTermLabel || term.name,
              year: term.legacyYear || new Date(term.startDate || Date.now()).getFullYear(),
            },
            academicYearLabel: term.academicYearLabel || null,
          },
        }
      );
    }

    return res.status(201).json({ success: true, data: section });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Section already exists for this term' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.linkCourseToStructure = async (req, res) => {
  try {
    if (!canManageOfferings(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const course = await Course.findOne(withTenantFilter({ _id: req.params.courseId }, tenantId));
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const result = await ensureOfferingAndSectionForCourse(course, {
      sectionNumber: req.body.sectionNumber || course.sectionNumber || '001',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCrossList = async (req, res) => {
  try {
    if (!canManageTerms(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const {
      name,
      sectionIds,
      sharedGradebook,
      primarySectionId,
      sharedContentCourseId,
      confirmRemount,
      exportArchivesFirst,
    } = req.body || {};
    const data = await sectionOffice.createCrossListGroup({
      tenantId,
      accountId: req.user.accountId,
      name,
      sectionIds,
      primarySectionId,
      sharedGradebook,
      sharedContentCourseId,
      actorId: req.user._id,
      actor: req.user,
      confirmRemount: Boolean(confirmRemount),
      exportArchivesFirst: Boolean(exportArchivesFirst),
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
      data: err.data,
    });
  }
};

exports.previewCrossListRemount = async (req, res) => {
  try {
    if (!canManageTerms(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.previewCrossListRemount(tenantId, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listCrossListSiblings = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.listCrossListSiblings(tenantId, req.params.courseId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listCrossLists = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.listCrossLists(tenantId, { limit: req.query.limit });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCrossList = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.getCrossList(tenantId, req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.updateCrossList = async (req, res) => {
  try {
    if (!canManageTerms(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const tenantId = rootAccountIdFromRequest(req);
    const sectionOffice = require('../services/registrar/sectionOffice.service');
    const data = await sectionOffice.updateCrossList(
      tenantId,
      req.params.id,
      req.body || {},
      req.user._id,
      req.user
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
      data: err.data,
    });
  }
};

exports.resolveOrCreateTermFromSemester = resolveOrCreateTermFromSemester;
