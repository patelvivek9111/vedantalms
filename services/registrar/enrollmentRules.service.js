const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Enrollment = require('../../models/enrollment.model');
const AcademicTerm = require('../../models/academicTerm.model');
const CourseSection = require('../../models/courseSection.model');
const CourseOffering = require('../../models/courseOffering.model');
const StudentHold = require('../../models/studentHold.model');

const DEFAULT_CHECKS = [
  'account_active',
  'no_financial_hold',
  'no_registrar_hold',
  'within_add_drop_window',
  'prerequisites_met',
  'capacity_available',
  'not_already_enrolled',
  'sis_authoritative',
];

const OVERRIDE_ROLES = ['registrar', 'admin', 'platform_admin'];

/**
 * Canvas-style enrollment rules check.
 * @returns {{ allowed: boolean, violations: object[], warnings: object[], overrideableBy: string[] }}
 */
async function checkEnrollmentRules({
  studentId,
  course,
  source = 'registrar',
  checks = DEFAULT_CHECKS,
  at = new Date(),
  section: sectionInput = null,
  term: termInput = null,
} = {}) {
  const violations = [];
  const warnings = [];
  const checkSet = new Set(checks || DEFAULT_CHECKS);

  if (!course || !studentId) {
    return {
      allowed: false,
      violations: [{ code: 'missing_context', message: 'student and course are required', overrideable: false }],
      warnings: [],
      overrideableBy: [],
    };
  }

  const rootAccountId = course.rootAccountId;
  const student = await User.findById(studentId)
    .select('firstName lastName email role accountStatus rootAccountId')
    .lean();

  if (!student) {
    return {
      allowed: false,
      violations: [{ code: 'student_not_found', message: 'Student not found', overrideable: false }],
      warnings: [],
      overrideableBy: [],
    };
  }

  if (student.rootAccountId && rootAccountId && String(student.rootAccountId) !== String(rootAccountId)) {
    return {
      allowed: false,
      violations: [
        {
          code: 'cross_tenant',
          message: 'Student belongs to a different institution',
          overrideable: false,
        },
      ],
      warnings: [],
      overrideableBy: [],
    };
  }

  let section = sectionInput;
  if (!section && course.sectionId) {
    section = await CourseSection.findById(course.sectionId).lean();
  }

  let term = termInput;
  if (!term && course.academicTermId) {
    term = await AcademicTerm.findById(course.academicTermId).lean();
  }

  if (checkSet.has('account_active')) {
    if (student.accountStatus === 'suspended') {
      violations.push({
        code: 'account_inactive',
        message: 'Student account is suspended',
        overrideable: true,
      });
    }
  }

  if (checkSet.has('no_registrar_hold') || checkSet.has('no_financial_hold')) {
    if (rootAccountId) {
      const hold = await StudentHold.hasBlockingHold(rootAccountId, studentId, {
        registration: true,
      });
      if (hold) {
        const isFinancial = hold.holdType === 'financial';
        const wantFinancial = checkSet.has('no_financial_hold');
        const wantRegistrar = checkSet.has('no_registrar_hold');
        if ((isFinancial && wantFinancial) || (!isFinancial && wantRegistrar) || wantRegistrar) {
          const item = {
            code: isFinancial ? 'financial_hold' : 'registrar_hold',
            message: `Registration hold: ${hold.reason}`,
            holdId: hold._id,
            holdType: hold.holdType,
            overrideable: source !== 'self',
          };
          if (source === 'self') violations.push(item);
          else warnings.push({ ...item, overrideable: true });
        }
      }
    }
  }

  if (checkSet.has('within_add_drop_window') && term) {
    if (!AcademicTerm.isEnrollmentOpen(term, at)) {
      const item = {
        code: 'outside_add_drop_window',
        message: 'Term enrollment window is closed',
        overrideable: true,
      };
      if (source === 'self') violations.push(item);
      else warnings.push(item);
    }
  }

  if (checkSet.has('not_already_enrolled')) {
    const existing = await Enrollment.findOne({
      rootAccountId,
      lmsCourseId: course._id,
      studentId,
      status: { $in: ['active', 'invited'] },
    })
      .select('_id status')
      .lean();
    const onRoster = (course.students || []).some((id) => String(id) === String(studentId));
    if (existing || onRoster) {
      violations.push({
        code: 'already_enrolled',
        message: 'Student is already enrolled in this course',
        enrollmentId: existing?._id,
        overrideable: false,
      });
    }
  }

  if (checkSet.has('capacity_available')) {
    const max =
      section?.maxEnrollment ??
      course.catalog?.maxStudents ??
      null;
    if (max != null && Number(max) > 0) {
      const activeCount = await Enrollment.countDocuments({
        rootAccountId,
        lmsCourseId: course._id,
        status: 'active',
      });
      const rosterCount = Math.max(activeCount, (course.students || []).length);
      if (rosterCount >= Number(max)) {
        const item = {
          code: 'capacity_full',
          message: `Course is at capacity (${rosterCount}/${max})`,
          overrideable: true,
        };
        if (source === 'self') violations.push(item);
        else warnings.push(item);
      }
    }
  }

  if (checkSet.has('prerequisites_met')) {
    let prereqs = [];
    if (course.offeringId) {
      const offering = await CourseOffering.findById(course.offeringId).select('prerequisites').lean();
      prereqs = offering?.prerequisites || [];
    }
    if (!prereqs.length && Array.isArray(course.catalog?.prerequisites)) {
      prereqs = course.catalog.prerequisites
        .filter(Boolean)
        .map((code) => ({ courseCode: String(code).trim().toUpperCase(), minGrade: '' }));
    }
    if (prereqs.length) {
      const codes = prereqs.map((p) => String(p.courseCode || '').toUpperCase()).filter(Boolean);
      const met = await Enrollment.aggregate([
        {
          $match: {
            rootAccountId: new mongoose.Types.ObjectId(String(rootAccountId)),
            studentId: new mongoose.Types.ObjectId(String(studentId)),
            status: { $in: ['active', 'completed'] },
          },
        },
        {
          $lookup: {
            from: 'courses',
            localField: 'lmsCourseId',
            foreignField: '_id',
            as: 'course',
          },
        },
        { $unwind: '$course' },
        {
          $project: {
            code: { $toUpper: { $ifNull: ['$course.catalog.courseCode', ''] } },
          },
        },
        { $match: { code: { $in: codes } } },
      ]);
      const metCodes = new Set(met.map((m) => m.code));
      const missing = codes.filter((c) => !metCodes.has(c));
      if (missing.length) {
        const item = {
          code: 'prerequisites_not_met',
          message: `Missing prerequisites: ${missing.join(', ')}`,
          missing,
          overrideable: true,
        };
        if (source === 'self') violations.push(item);
        else warnings.push(item);
      }
    }
  }

  if (checkSet.has('sis_authoritative')) {
    const method = section?.enrollmentMethod || 'open';
    if (method === 'sis_only' && !['sis', 'registrar', 'admin', 'platform_admin'].includes(source)) {
      violations.push({
        code: 'sis_authoritative',
        message: 'Section is SIS-only; enrollment must come from SIS or registrar override',
        overrideable: true,
      });
    }
    if (method === 'registrar_only' && source === 'self') {
      violations.push({
        code: 'registrar_only',
        message: 'Section allows registrar enrollment only',
        overrideable: false,
      });
    }
    if (method === 'approval' && source === 'self') {
      warnings.push({
        code: 'approval_required',
        message: 'Section requires instructor approval for self-enrollment',
        overrideable: false,
      });
    }
  }

  const hard = violations.filter((v) => !v.overrideable);
  const soft = violations.filter((v) => v.overrideable);
  const allowed = hard.length === 0 && soft.length === 0;

  return {
    allowed,
    violations: [...hard, ...soft],
    warnings,
    overrideableBy: soft.length || warnings.some((w) => w.overrideable) ? OVERRIDE_ROLES : [],
    student: {
      _id: student._id,
      email: student.email,
      firstName: student.firstName,
      lastName: student.lastName,
    },
  };
}

function canOverrideRules(user, result) {
  if (!user || !result) return false;
  if (!OVERRIDE_ROLES.includes(user.role)) return false;
  const blocking = (result.violations || []).filter((v) => !v.overrideable);
  return blocking.length === 0;
}

module.exports = {
  DEFAULT_CHECKS,
  OVERRIDE_ROLES,
  checkEnrollmentRules,
  canOverrideRules,
};
