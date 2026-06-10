const {
  fanoutAcademicDomainNotifications,
  resolveCourseStudentIds,
  normalizeObjectIdString,
} = require('./academicNotificationExpansion.service');
const {
  filterToActiveCourseStudentIds,
  isActiveCourseStudent,
} = require('./courseEnrollmentRecipients.service');

function enqueueFanout(payload) {
  const { enqueueAcademicFanout } = require('../notificationFanoutQueue.service');
  return enqueueAcademicFanout(payload);
}

async function loadCourseForNotifications(courseOrId) {
  const Course = require('../../models/course.model');
  const courseId = normalizeObjectIdString(courseOrId);
  if (!courseId) return null;
  if (courseOrId && typeof courseOrId === 'object' && Array.isArray(courseOrId.students)) {
    return courseOrId;
  }
  return Course.findById(courseId).select('title students instructor admins teachingAssistants').lean();
}

function isDiscussionReplyStaffRecipient(recipientId, course) {
  const id = normalizeObjectIdString(recipientId);
  if (!id || !course) return false;
  if (normalizeObjectIdString(course.instructor) === id) return true;
  if ((course.admins || []).some((adminId) => normalizeObjectIdString(adminId) === id)) return true;
  if ((course.teachingAssistants || []).some((taId) => normalizeObjectIdString(taId) === id)) return true;
  return false;
}

async function resolveCourseFromAssignment(assignment) {
  const Module = require('../../models/module.model');
  const GroupSet = require('../../models/GroupSet');
  if (!assignment) return null;

  if (assignment.module) {
    const module =
      assignment.module?.course != null
        ? { course: assignment.module.course }
        : await Module.findById(assignment.module).select('course').lean();
    if (module?.course) {
      return loadCourseForNotifications(module.course);
    }
  }

  if (assignment.groupSet) {
    const groupSet =
      assignment.groupSet?.course != null
        ? assignment.groupSet
        : await GroupSet.findById(assignment.groupSet).select('course').lean();
    if (groupSet?.course) {
      return loadCourseForNotifications(groupSet.course);
    }
  }

  return null;
}

function assignmentLink(courseId, assignmentId) {
  return `/courses/${courseId}/assignments/${assignmentId}`;
}

function discussionLink(courseId, threadId) {
  return `/courses/${courseId}/discussions/${threadId}`;
}

function staffRecipientIds(course) {
  const ids = new Set();
  const instructorId = normalizeObjectIdString(course?.instructor);
  if (instructorId) ids.add(instructorId);
  (course?.admins || []).forEach((id) => {
    const normalized = normalizeObjectIdString(id);
    if (normalized) ids.add(normalized);
  });
  (course?.teachingAssistants || []).forEach((id) => {
    const normalized = normalizeObjectIdString(id);
    if (normalized) ids.add(normalized);
  });
  return [...ids];
}

async function notifyAnnouncementCreated({
  course,
  announcement,
  actor,
  requestId,
}) {
  const resolvedCourse = await loadCourseForNotifications(course);
  if (!resolvedCourse || !announcement) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const announcementId = normalizeObjectIdString(announcement._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);
  const title = announcement.title || 'New announcement';

  return enqueueFanout({
    handler: 'announcement_created',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.ANNOUNCEMENT_CREATED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: announcementId,
    relatedType: 'announcement',
    requestId,
    bounded: true,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      announcementTitle: title,
      link: `/courses/${courseId}/announcements`,
    },
  });
}

async function notifyAssignmentCreated({ assignment, course, actor, requestId }) {
  if (!assignment?.published) return null;
  const resolvedCourse = course || (await resolveCourseFromAssignment(assignment));
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const assignmentId = normalizeObjectIdString(assignment._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'assignment_created',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.ASSIGNMENT_CREATED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: assignmentId,
    relatedType: 'assignment',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      assignmentTitle: assignment.title,
      assignmentId,
      link: assignmentLink(courseId, assignmentId),
    },
  });
}

async function notifyAssignmentUpdated({ assignment, course, actor, requestId }) {
  if (!assignment?.published) return null;
  const resolvedCourse = course || (await resolveCourseFromAssignment(assignment));
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const assignmentId = normalizeObjectIdString(assignment._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'assignment_updated',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.ASSIGNMENT_UPDATED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: assignmentId,
    relatedType: 'assignment',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      assignmentTitle: assignment.title,
      assignmentId,
      link: assignmentLink(courseId, assignmentId),
    },
  });
}

async function notifyAssignmentPublished({ assignment, course, actor, requestId }) {
  const resolvedCourse = course || (await resolveCourseFromAssignment(assignment));
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const assignmentId = normalizeObjectIdString(assignment._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'assignment_published',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.ASSIGNMENT_PUBLISHED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: assignmentId,
    relatedType: 'assignment',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      assignmentTitle: assignment.title,
      assignmentId,
      link: assignmentLink(courseId, assignmentId),
    },
  });
}

async function notifyDiscussionCreated({ thread, course, actor, requestId }) {
  const discussionWorkflow = require('../discussionWorkflow.service');
  const discussionAccess = require('../discussionAccess.service');
  if (!discussionWorkflow.isDiscussionPublished(thread)) return null;

  const resolvedCourse = course || (await loadCourseForNotifications(thread?.course));
  if (!resolvedCourse || !thread) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const threadId = normalizeObjectIdString(thread._id);
  const studentIds = await discussionAccess.resolveDiscussionStudentRecipientIds(
    thread,
    resolvedCourse
  );

  return enqueueFanout({
    handler: 'discussion_created',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.DISCUSSION_CREATED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: threadId,
    relatedType: 'discussion',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      threadTitle: thread.title,
      link: discussionLink(courseId, threadId),
    },
  });
}

async function resolveDiscussionReplyRecipients({ thread, course, actor }) {
  const discussionAccess = require('../discussionAccess.service');
  const User = require('../../models/user.model');
  const resolvedCourse = course || (await loadCourseForNotifications(thread?.course));
  if (!resolvedCourse) return [];

  const actorId = normalizeObjectIdString(actor?._id || actor);
  const actorUser =
    actor?.role != null ? actor : await User.findById(actorId).select('role').lean();

  if (discussionAccess.isCourseStaff(actorUser, resolvedCourse)) {
    return discussionAccess.resolveDiscussionStudentRecipientIds(thread, resolvedCourse);
  }

  return discussionAccess.resolveCourseStaffRecipientIds(resolvedCourse);
}

async function notifyDiscussionReplyPosted({ thread, course, actor, requestId, replyId }) {
  const discussionWorkflow = require('../discussionWorkflow.service');
  if (!thread) return null;
  if (!discussionWorkflow.isDiscussionPublished(thread)) return null;

  const resolvedCourse = course || (await loadCourseForNotifications(thread.course));
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const threadId = normalizeObjectIdString(thread._id);
  const recipientIds = await resolveDiscussionReplyRecipients({ thread, course: resolvedCourse, actor });
  const actorName = actor?.firstName ? `${actor.firstName} ${actor.lastName}` : 'Someone';
  const replySuffix = replyId ? `reply:${normalizeObjectIdString(replyId)}` : null;

  return enqueueFanout({
    handler: 'discussion_reply',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.DISCUSSION_REPLY,
    recipientIds,
    actorId: actor?._id || actor,
    relatedId: threadId,
    relatedType: 'discussion',
    requestId,
    bounded: false,
    context: {
      courseId,
      threadTitle: thread.title,
      actorName,
      link: discussionLink(courseId, threadId),
      staffRecipientIds: staffRecipientIds(resolvedCourse),
      replySuffix,
    },
  });
}

async function notifyDiscussionGraded({ thread, studentId, grade, course, actor, requestId }) {
  const discussionGradeVisibility = require('../discussionGradeVisibility.service');
  if (!thread || !studentId) return null;

  const gradeRow = discussionGradeVisibility.findStudentGrade(thread, studentId);
  const visibility = discussionGradeVisibility.resolveDiscussionGradeVisibility(thread, gradeRow);
  if (!visibility.scoreVisible) return null;

  const resolvedCourse = course || (await loadCourseForNotifications(thread.course));
  const courseId = resolvedCourse ? normalizeObjectIdString(resolvedCourse._id) : null;
  const threadId = normalizeObjectIdString(thread._id);
  const { createNotificationFromDomainEvent } = require('../domain/createNotificationFromDomainEvent');
  const { isAcademicNotificationExpansionEnabled, buildAcademicEventWindow } = require('./academicNotificationExpansion.service');
  const { DOMAIN_EVENTS } = require('../domain/eventTaxonomy');

  if (!isAcademicNotificationExpansionEnabled()) return null;
  if (resolvedCourse && !(await isActiveCourseStudent(studentId, resolvedCourse))) return null;

  return createNotificationFromDomainEvent(DOMAIN_EVENTS.DISCUSSION_GRADED, {
    userId: studentId,
    recipientRole: 'student',
    title: 'Discussion Graded',
    message: `Your discussion "${thread.title}" has been graded${grade != null ? `: ${grade} points` : ''}.`,
    link: courseId ? discussionLink(courseId, threadId) : null,
    relatedId: threadId,
    relatedType: 'discussion',
    priority: 'high',
    actorId: actor?._id || actor,
    courseId,
    requestId,
    eventWindow: buildAcademicEventWindow({
      domainEvent: DOMAIN_EVENTS.DISCUSSION_GRADED,
      relatedId: threadId,
      recipientId: studentId,
      actorId: actor?._id || actor,
    }),
  });
}

async function notifyCoursePublished({ course, actor, requestId }) {
  const resolvedCourse = await loadCourseForNotifications(course);
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'course_published',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.COURSE_PUBLISHED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: courseId,
    relatedType: 'course',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      link: `/courses/${courseId}`,
    },
  });
}

async function notifyCourseUnpublished({ course, actor, requestId }) {
  const resolvedCourse = await loadCourseForNotifications(course);
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'course_unpublished',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.COURSE_UNPUBLISHED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: courseId,
    relatedType: 'course',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      link: `/courses/${courseId}`,
    },
  });
}

async function notifyGradesPosted({ course, actor, requestId }) {
  const resolvedCourse = await loadCourseForNotifications(course);
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'grades_posted',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.GRADES_POSTED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: courseId,
    relatedType: 'course',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      link: `/courses/${courseId}/grades`,
    },
  });
}

async function notifyGradesFinalized({ course, actor, requestId }) {
  const resolvedCourse = await loadCourseForNotifications(course);
  if (!resolvedCourse) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const studentIds = await resolveCourseStudentIds(resolvedCourse);

  return enqueueFanout({
    handler: 'grades_finalized',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.GRADES_FINALIZED,
    recipientIds: studentIds,
    actorId: actor?._id || actor,
    relatedId: courseId,
    relatedType: 'course',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      link: `/courses/${courseId}/grades`,
    },
  });
}

async function notifyGradesAmended({
  course,
  studentIds,
  actor,
  requestId,
  reason,
  amendmentSequence = null,
}) {
  const resolvedCourse = await loadCourseForNotifications(course);
  if (!resolvedCourse || !studentIds?.length) return null;
  const courseId = normalizeObjectIdString(resolvedCourse._id);
  const activeStudentIds = await filterToActiveCourseStudentIds(studentIds, resolvedCourse);
  if (!activeStudentIds.length) return null;
  const trimmedReason = reason ? String(reason).trim() : '';
  const eventWindowSuffix =
    amendmentSequence != null ? `amended:${amendmentSequence}` : 'amended';

  return enqueueFanout({
    handler: 'grades_amended',
    domainEvent: require('../domain/eventTaxonomy').DOMAIN_EVENTS.GRADES_AMENDED,
    recipientIds: activeStudentIds,
    actorId: actor?._id || actor,
    relatedId: courseId,
    relatedType: 'course',
    requestId,
    bounded: false,
    context: {
      courseId,
      courseTitle: resolvedCourse.title,
      link: `/courses/${courseId}/grades`,
      reason: trimmedReason,
      eventWindowSuffix,
    },
  });
}

module.exports = {
  notifyAnnouncementCreated,
  notifyAssignmentCreated,
  notifyAssignmentUpdated,
  notifyAssignmentPublished,
  notifyDiscussionCreated,
  notifyDiscussionReplyPosted,
  notifyDiscussionGraded,
  notifyCoursePublished,
  notifyCourseUnpublished,
  notifyGradesPosted,
  notifyGradesFinalized,
  notifyGradesAmended,
  resolveCourseFromAssignment,
};
