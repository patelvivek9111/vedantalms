const Course = require('../models/course.model');
const {
  canViewCourseGrades,
  canAccessStudentRecord,
  canEditRawSubmission,
  requiresAdminOverrideLog,
  isEnrolledStudent,
  REGISTRAR_ROLES,
} = require('./academicPermissions');
const ferpaAudit = require('../services/ferpaAudit.service');

async function deny(req, res, reason, details = {}) {
  await ferpaAudit.recordAccessDenied(req, { reason, ...details }).catch(() => {});
  return res.status(403).json({ success: false, message: reason });
}

/** Ensure caller may access gradebook for courseId param. */
function requireCourseGradeAccess(options = {}) {
  return async (req, res, next) => {
    try {
      const courseId = req.params.courseId || req.params.id;
      const course =
        req.course ||
        (await Course.findById(courseId)
          .select('instructor students teachingAssistants')
          .lean());
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
      req.course = course;

      if (!canViewCourseGrades(req.user, course)) {
        if (req.user?.role === 'student' && options.allowSelfOnly) {
          return next();
        }
        await ferpaAudit.recordFerpaEvent({
          actorId: req.user._id,
          action: 'ferpa_cross_course_attempt',
          entityType: 'course',
          entityId: String(courseId),
          ip: req.ip,
          requestId: req.requestId,
          metadata: { role: req.user.role },
        }).catch(() => {});
        return deny(req, res, 'Not authorized to view grades for this course', {
          entityType: 'course',
          entityId: courseId,
        });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}

/** Student self-access only on student grade routes. */
function requireSelfStudentAccess(req, res, next) {
  const targetId = req.params.studentId || req.query.studentId;
  if (targetId && !canAccessStudentRecord(req.user, targetId)) {
    ferpaAudit
      .recordFerpaEvent({
        actorId: req.user._id,
        action: 'ferpa_cross_student_attempt',
        entityType: 'student',
        entityId: String(targetId),
        ip: req.ip,
        requestId: req.requestId,
        metadata: { role: req.user.role },
      })
      .catch(() => {});
    return deny(req, res, 'Not authorized to access this student record', {
      entityType: 'student',
      entityId: targetId,
    });
  }
  if (req.user.role === 'student' && targetId && String(req.user._id) !== String(targetId)) {
    return deny(req, res, 'Students may only access their own records');
  }
  return next();
}

/** Block registrar from raw submission mutation paths. */
async function assertSubmissionEditAllowed(req, course) {
  if (!canEditRawSubmission(req.user, course)) {
    await ferpaAudit.recordFerpaEvent({
      actorId: req.user._id,
      action: 'ferpa_privilege_escalation',
      entityType: 'submission',
      entityId: req.params.submissionId || req.params.id || 'n/a',
      ip: req.ip,
      requestId: req.requestId,
      metadata: { role: req.user.role, blocked: 'submission_edit' },
    }).catch(() => {});
    const err = new Error('Registrar accounts cannot edit raw submissions directly');
    err.statusCode = 403;
    throw err;
  }
  if (requiresAdminOverrideLog(req.user)) {
    await ferpaAudit.recordAdminOverride(req, {
      entityType: 'submission',
      entityId: req.params.submissionId || req.params.id,
      action: req.method,
      path: req.path,
    }).catch(() => {});
  }
}

module.exports = {
  requireCourseGradeAccess,
  requireSelfStudentAccess,
  assertSubmissionEditAllowed,
  deny,
  isEnrolledStudent,
  REGISTRAR_ROLES,
};
