const Course = require('../models/course.model');
const User = require('../models/user.model');
const SystemSettings = require('../models/systemSettings.model');
const {
  isEnrolledStudent,
  isCourseGradingStaff,
} = require('../middleware/academicPermissions');
const ferpaAudit = require('./ferpaAudit.service');
const observability = require('./workflowObservability.service');

const INSTITUTIONAL_STAFF_ROLES = new Set([
  'teacher',
  'teaching_assistant',
  'admin',
  'registrar',
  'department_admin',
]);

const ADMIN_ROLES = new Set(['admin']);

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function isPolicyEnforced() {
  return process.env.MESSAGING_POLICY_ENFORCED === 'true';
}

function policyError(message, statusCode, code, details = {}) {
  observability.metric('messaging_policy_denied', { code, statusCode });
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function isAdmin(user) {
  return ADMIN_ROLES.has(user?.role);
}

function isInstitutionalStaff(user) {
  return user?.role && INSTITUTIONAL_STAFF_ROLES.has(user.role);
}

async function getMessagingPolicy() {
  let settingsMessaging = {};
  try {
    const settings = await SystemSettings.getSettings();
    settingsMessaging = settings?.messaging || {};
  } catch {
    // Use env defaults when settings unavailable
  }

  const envMode = process.env.MESSAGING_POLICY;
  const mode = envMode || settingsMessaging.mode || 'course_scoped';

  return {
    mode,
    allowStudentToStudent:
      settingsMessaging.allowStudentToStudent === true ||
      process.env.MESSAGING_ALLOW_STUDENT_TO_STUDENT === 'true',
    allowCrossCourse:
      settingsMessaging.allowCrossCourse === true ||
      process.env.MESSAGING_ALLOW_CROSS_COURSE === 'true',
    maxRecipientsPerMessage: parseInt(
      settingsMessaging.maxRecipientsPerMessage ||
        process.env.MESSAGING_MAX_RECIPIENTS ||
        '50',
      10
    ),
    maxSendIndividuallyBatch: parseInt(
      settingsMessaging.maxSendIndividuallyBatch ||
        process.env.MESSAGING_MAX_SEND_INDIVIDUALLY ||
        '25',
      10
    ),
  };
}

async function loadCourse(courseId) {
  if (!courseId) return null;
  const course = await Course.findById(courseId)
    .select('instructor teachingAssistants students operationalStatus title')
    .lean();
  if (!course) {
    throw policyError('Course not found', 404, 'COURSE_NOT_FOUND');
  }
  if (course.operationalStatus === 'archived') {
    throw policyError('Course is archived', 403, 'COURSE_ARCHIVED', { courseId: normalizeId(course) });
  }
  return course;
}

function assertSenderCourseMembership(sender, course) {
  if (isAdmin(sender)) return;
  if (isCourseGradingStaff(sender, course)) return;
  if (isEnrolledStudent(sender, course)) return;
  throw policyError('You are not a member of this course', 403, 'NOT_COURSE_MEMBER', {
    courseId: normalizeId(course),
    userId: normalizeId(sender),
  });
}

/**
 * Whether sender may message recipient within a course context.
 */
function canMessageWithinCourse(sender, recipient, course, policy) {
  if (isAdmin(sender) || isAdmin(recipient)) return true;

  const senderStaff = isCourseGradingStaff(sender, course);
  const recipientStaff = isCourseGradingStaff(recipient, course);
  const senderStudent = isEnrolledStudent(sender, course);
  const recipientStudent = isEnrolledStudent(recipient, course);

  if (senderStaff && (recipientStaff || recipientStudent)) return true;
  if (senderStudent && recipientStaff) return true;

  if (senderStudent && recipientStudent) {
    if (policy.allowStudentToStudent) return true;
    return false;
  }

  return false;
}

async function recordPolicyDenied(req, sender, code, metadata = {}) {
  return ferpaAudit
    .recordFerpaEvent({
      actorId: sender?._id,
      action: 'messaging_policy_denied',
      entityType: 'conversation',
      entityId: metadata.courseId || 'n/a',
      severity: 'warning',
      ip: req?.ip,
      requestId: req?.requestId || req?.auditCorrelationId,
      metadata: {
        code,
        role: sender?.role,
        ...metadata,
      },
    })
    .catch(() => {});
}

/**
 * Validate new conversation participants (createConversation).
 */
async function assertCanAddParticipants({
  sender,
  participantIds,
  courseId,
  sendIndividually = false,
  req,
}) {
  if (!isPolicyEnforced()) {
    return { policy: { enforced: false }, course: null };
  }

  const policy = await getMessagingPolicy();
  const uniqueIds = [...new Set((participantIds || []).map((id) => String(id)))];

  if (uniqueIds.length > policy.maxRecipientsPerMessage) {
    throw policyError('Too many recipients', 400, 'TOO_MANY_RECIPIENTS', {
      max: policy.maxRecipientsPerMessage,
    });
  }

  if (sendIndividually && uniqueIds.length > policy.maxSendIndividuallyBatch) {
    throw policyError('Too many individual messages in one request', 400, 'SEND_INDIVIDUALLY_LIMIT', {
      max: policy.maxSendIndividuallyBatch,
    });
  }

  const recipients = await User.find({ _id: { $in: uniqueIds } }).select('_id role').lean();
  if (recipients.length !== uniqueIds.length) {
    throw policyError('One or more participants are invalid', 400, 'INVALID_PARTICIPANT');
  }

  if (policy.mode === 'admin_only' && !isAdmin(sender)) {
    await recordPolicyDenied(req, sender, 'MESSAGING_ADMIN_ONLY');
    throw policyError('Institution messaging is restricted to administrators', 403, 'MESSAGING_ADMIN_ONLY');
  }

  const course = courseId ? await loadCourse(courseId) : null;

  if (policy.mode === 'open') {
    return { policy, course };
  }

  // course_scoped (default)
  if (!course) {
    const senderIsStaff = isInstitutionalStaff(sender) || isAdmin(sender);
    const allRecipientsStaff = recipients.every((r) => isInstitutionalStaff(r) || isAdmin(r));
    if (!senderIsStaff || !allRecipientsStaff) {
      await recordPolicyDenied(req, sender, 'COURSE_REQUIRED');
      throw policyError(
        'Course context is required for this message',
        403,
        'COURSE_REQUIRED'
      );
    }
    return { policy, course: null };
  }

  assertSenderCourseMembership(sender, course);

  for (const recipient of recipients) {
    if (!canMessageWithinCourse(sender, recipient, course, policy)) {
      await recordPolicyDenied(req, sender, 'NOT_COURSE_PEER', {
        courseId: normalizeId(course),
        recipientId: normalizeId(recipient),
      });
      if (
        sender.role === 'student' &&
        recipient.role === 'student' &&
        !policy.allowStudentToStudent
      ) {
        throw policyError(
          'Student-to-student messaging is disabled',
          403,
          'STUDENT_DM_DISABLED'
        );
      }
      throw policyError(
        'Recipient is not in your course messaging scope',
        403,
        'NOT_COURSE_PEER'
      );
    }
  }

  return { policy, course };
}

/**
 * Validate sender may post in an existing conversation when policy is enforced.
 */
async function assertSenderMayParticipateInConversation({ sender, conversation, req }) {
  if (!isPolicyEnforced() || !conversation) {
    return;
  }

  const policy = await getMessagingPolicy();
  if (policy.mode === 'admin_only' && !isAdmin(sender)) {
    await recordPolicyDenied(req, sender, 'MESSAGING_ADMIN_ONLY');
    throw policyError('Institution messaging is restricted to administrators', 403, 'MESSAGING_ADMIN_ONLY');
  }

  const courseId = conversation.course ? normalizeId(conversation.course) : null;
  if (!courseId) {
    if (policy.mode === 'course_scoped' && sender.role === 'student') {
      // Students may reply in legacy non-course threads they already belong to
      return;
    }
    return;
  }

  const course = await loadCourse(courseId);
  assertSenderCourseMembership(sender, course);
}

module.exports = {
  isPolicyEnforced,
  getMessagingPolicy,
  canMessageWithinCourse,
  assertCanAddParticipants,
  assertSenderMayParticipateInConversation,
  loadCourse,
  isInstitutionalStaff,
};
