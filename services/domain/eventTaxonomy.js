/**
 * Canonical domain event keys for academic lifecycle signals.
 * Controllers should prefer these constants over ad-hoc strings.
 */

const DOMAIN_EVENTS = Object.freeze({
  ANNOUNCEMENT_CREATED: 'announcement.created',
  SUBMISSION_CREATED: 'submission.created',
  SUBMISSION_GRADED: 'submission.graded',
  ENROLLMENT_REQUESTED: 'enrollment.requested',
  ENROLLMENT_APPROVED: 'enrollment.approved',
  ENROLLMENT_DENIED: 'enrollment.denied',
  ENROLLMENT_WAITLIST_PROMOTED: 'enrollment.waitlist_promoted',
  INBOX_MESSAGE_SENT: 'inbox.message',
  ASSIGNMENT_DUE_SOON: 'assignment.due_soon',
  ASSIGNMENT_CREATED: 'assignment.created',
  ASSIGNMENT_UPDATED: 'assignment.updated',
  ASSIGNMENT_PUBLISHED: 'assignment.published',
  DISCUSSION_CREATED: 'discussion.created',
  DISCUSSION_REPLY: 'discussion.reply',
  DISCUSSION_GRADED: 'discussion.graded',
  COURSE_PUBLISHED: 'course.published',
  COURSE_UNPUBLISHED: 'course.unpublished',
  GRADES_POSTED: 'grades.posted',
  GRADES_FINALIZED: 'grades.finalized',
  GRADES_AMENDED: 'grades.amended',
  GROUP_MEETING_SCHEDULED: 'group_meeting.scheduled',
  GROUP_MEETING_UPDATED: 'group_meeting.updated',
  GROUP_MEETING_CANCELLED: 'group_meeting.cancelled',
});

/** How a domain event surfaces in product UX. */
const SURFACE_KIND = Object.freeze({
  PLANNER: 'planner',
  NOTIFICATION: 'notification',
  BOTH: 'both',
  NONE: 'none',
});

/** Planner vs notification ownership for delivery decisions. */
const OWNERSHIP = Object.freeze({
  PLANNER: 'planner',
  NOTIFICATION: 'notification',
  INBOX: 'inbox',
});

module.exports = {
  DOMAIN_EVENTS,
  SURFACE_KIND,
  OWNERSHIP,
};
