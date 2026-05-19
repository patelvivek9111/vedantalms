/**
 * Capability-based academic permissions (registrar workflows).
 * Roles: student, teaching_assistant, teacher, department_admin, registrar, admin
 */

const CAPABILITIES = {
  GRADE_DRAFT: 'grade_draft',
  POST_GRADES: 'post_grades',
  FINALIZE_GRADES: 'finalize_grades',
  AMEND_GRADES: 'amend_grades',
  RECOMPUTE_GRADES: 'recompute_grades',
  VIEW_LIFECYCLE: 'view_lifecycle',
  MANAGE_INSTITUTION_POLICY: 'manage_institution_policy',
};

const ROLE_CAPABILITIES = {
  student: [],
  teaching_assistant: [CAPABILITIES.GRADE_DRAFT, CAPABILITIES.VIEW_LIFECYCLE],
  teacher: [
    CAPABILITIES.GRADE_DRAFT,
    CAPABILITIES.POST_GRADES,
    CAPABILITIES.VIEW_LIFECYCLE,
  ],
  department_admin: [
    CAPABILITIES.GRADE_DRAFT,
    CAPABILITIES.POST_GRADES,
    CAPABILITIES.FINALIZE_GRADES,
    CAPABILITIES.AMEND_GRADES,
    CAPABILITIES.RECOMPUTE_GRADES,
    CAPABILITIES.VIEW_LIFECYCLE,
  ],
  registrar: [
    CAPABILITIES.GRADE_DRAFT,
    CAPABILITIES.POST_GRADES,
    CAPABILITIES.FINALIZE_GRADES,
    CAPABILITIES.AMEND_GRADES,
    CAPABILITIES.RECOMPUTE_GRADES,
    CAPABILITIES.VIEW_LIFECYCLE,
    CAPABILITIES.MANAGE_INSTITUTION_POLICY,
  ],
  admin: [
    CAPABILITIES.GRADE_DRAFT,
    CAPABILITIES.POST_GRADES,
    CAPABILITIES.FINALIZE_GRADES,
    CAPABILITIES.AMEND_GRADES,
    CAPABILITIES.RECOMPUTE_GRADES,
    CAPABILITIES.VIEW_LIFECYCLE,
    CAPABILITIES.MANAGE_INSTITUTION_POLICY,
  ],
};

const REGISTRAR_ROLES = new Set(['admin', 'registrar', 'department_admin']);
const ADMIN_ROLES = new Set(['admin']);

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function isEnrolledStudent(user, course) {
  if (!user || user.role !== 'student' || !course?.students?.length) return false;
  const sid = normalizeId(user);
  return course.students.some((s) => normalizeId(s) === sid);
}

/** Student may only access own academic records. */
function canAccessStudentRecord(user, targetStudentId) {
  if (!user) return false;
  if (ADMIN_ROLES.has(user.role) || REGISTRAR_ROLES.has(user.role)) return true;
  return normalizeId(user) === normalizeId(targetStudentId);
}

/** View grades for a course (instructor, TA on course, registrar staff). */
function canViewCourseGrades(user, course) {
  if (!user || !course) return false;
  if (REGISTRAR_ROLES.has(user.role)) return true;
  if (user.role === 'student') return isEnrolledStudent(user, course);
  return isCourseGradingStaff(user, course);
}

/**
 * Registrar may finalize/amend/recompute but must not edit raw submission rows directly.
 */
function canEditRawSubmission(user, course) {
  if (!user || !course) return false;
  if (user.role === 'registrar') return false;
  if (REGISTRAR_ROLES.has(user.role) && user.role !== 'registrar') {
    return isCourseGradingStaff(user, course);
  }
  if (user.role === 'admin') return true;
  return canGradeDraft(user, course);
}

function requiresAdminOverrideLog(user) {
  return user?.role === 'admin';
}

function hasCapability(user, capability) {
  if (!user?.role) return false;
  const caps = ROLE_CAPABILITIES[user.role] || [];
  return caps.includes(capability);
}

function isCourseInstructor(user, course) {
  if (!user || !course?.instructor) return false;
  return course.instructor.toString() === user._id.toString();
}

function isCourseTeachingAssistant(user, course) {
  if (!user || user.role !== 'teaching_assistant') return false;
  const tas = course.teachingAssistants || [];
  return tas.some((id) => String(id) === String(user._id));
}

/**
 * Staff who may perform course-scoped grading actions (draft/post).
 */
function isCourseGradingStaff(user, course) {
  if (!user || !course) return false;
  if (REGISTRAR_ROLES.has(user.role)) return true;
  if (user.role === 'teacher' && isCourseInstructor(user, course)) return true;
  if (isCourseTeachingAssistant(user, course)) return true;
  return false;
}

function canGradeDraft(user, course) {
  return hasCapability(user, CAPABILITIES.GRADE_DRAFT) && isCourseGradingStaff(user, course);
}

function canPostGrades(user, course) {
  if (!hasCapability(user, CAPABILITIES.POST_GRADES)) return false;
  if (REGISTRAR_ROLES.has(user.role)) return true;
  return isCourseInstructor(user, course);
}

function canFinalizeGrades(user) {
  return hasCapability(user, CAPABILITIES.FINALIZE_GRADES);
}

function canAmendGrades(user) {
  return hasCapability(user, CAPABILITIES.AMEND_GRADES);
}

function canRecomputeGrades(user) {
  return hasCapability(user, CAPABILITIES.RECOMPUTE_GRADES);
}

function requireCapability(capability, options = {}) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!hasCapability(req.user, capability)) {
      return res.status(403).json({
        success: false,
        message: `Missing permission: ${capability}`,
      });
    }
    if (options.courseParam && req.course) {
      const course = req.course;
      if (capability === CAPABILITIES.GRADE_DRAFT && !canGradeDraft(req.user, course)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this course' });
      }
      if (capability === CAPABILITIES.POST_GRADES && !canPostGrades(req.user, course)) {
        return res.status(403).json({ success: false, message: 'Not authorized to post grades' });
      }
    }
    return next();
  };
}

/**
 * Load course onto req.course for course-scoped routes.
 */
async function loadCourse(req, res, next) {
  try {
    const Course = require('../models/course.model');
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    req.course = course;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  REGISTRAR_ROLES,
  ADMIN_ROLES,
  hasCapability,
  isCourseInstructor,
  isCourseTeachingAssistant,
  isCourseGradingStaff,
  isEnrolledStudent,
  canAccessStudentRecord,
  canViewCourseGrades,
  canEditRawSubmission,
  requiresAdminOverrideLog,
  canGradeDraft,
  canPostGrades,
  canFinalizeGrades,
  canAmendGrades,
  canRecomputeGrades,
  requireCapability,
  loadCourse,
};
