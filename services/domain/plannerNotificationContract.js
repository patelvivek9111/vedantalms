const { DOMAIN_EVENTS, SURFACE_KIND, OWNERSHIP } = require('./eventTaxonomy');

/**
 * Transitional contract map: domain event → planner vs notification ownership.
 * Does not change external HTTP APIs; guides adapters and future projections.
 *
 * @typedef {object} EventContract
 * @property {string} domainEvent
 * @property {string} surfaceKind
 * @property {string} primaryOwner
 * @property {boolean} deliversNotification
 * @property {boolean} deliversPlannerEntry
 * @property {string|null} notificationType
 * @property {string|null} plannerTodoType
 * @property {string[]} plannerOwnerRoles
 * @property {string} description
 */

/** @type {Record<string, EventContract>} */
const EVENT_CONTRACTS = Object.freeze({
  [DOMAIN_EVENTS.ANNOUNCEMENT_CREATED]: {
    domainEvent: DOMAIN_EVENTS.ANNOUNCEMENT_CREATED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'announcement',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Informational course announcement; no actionable planner row.',
  },
  [DOMAIN_EVENTS.SUBMISSION_CREATED]: {
    domainEvent: DOMAIN_EVENTS.SUBMISSION_CREATED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'submission',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Teacher alert for new submission; student workload uses derived due/ungraded feeds.',
  },
  [DOMAIN_EVENTS.SUBMISSION_GRADED]: {
    domainEvent: DOMAIN_EVENTS.SUBMISSION_GRADED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'assignment_graded',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Student grade release; suppress duplicate grade/submission planner noise.',
  },
  [DOMAIN_EVENTS.ENROLLMENT_REQUESTED]: {
    domainEvent: DOMAIN_EVENTS.ENROLLMENT_REQUESTED,
    surfaceKind: SURFACE_KIND.PLANNER,
    primaryOwner: OWNERSHIP.PLANNER,
    deliversNotification: false,
    deliversPlannerEntry: true,
    notificationType: null,
    plannerTodoType: 'enrollment_request',
    plannerOwnerRoles: ['teacher', 'admin'],
    description: 'Instructor actionable enrollment queue; notifications suppressed for instructors.',
  },
  [DOMAIN_EVENTS.ENROLLMENT_APPROVED]: {
    domainEvent: DOMAIN_EVENTS.ENROLLMENT_APPROVED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'enrollment',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Student informational enrollment outcome.',
  },
  [DOMAIN_EVENTS.ENROLLMENT_DENIED]: {
    domainEvent: DOMAIN_EVENTS.ENROLLMENT_DENIED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'enrollment',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Student informational enrollment outcome.',
  },
  [DOMAIN_EVENTS.ENROLLMENT_WAITLIST_PROMOTED]: {
    domainEvent: DOMAIN_EVENTS.ENROLLMENT_WAITLIST_PROMOTED,
    surfaceKind: SURFACE_KIND.BOTH,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: true,
    notificationType: 'enrollment',
    plannerTodoType: 'waitlist_promotion',
    plannerOwnerRoles: ['student'],
    description: 'Student promotion from waitlist; optional planner row for student follow-up.',
  },
  [DOMAIN_EVENTS.INBOX_MESSAGE_SENT]: {
    domainEvent: DOMAIN_EVENTS.INBOX_MESSAGE_SENT,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.INBOX,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'message',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Inbox has primary realtime UX; notification is secondary fallback.',
  },
  [DOMAIN_EVENTS.ASSIGNMENT_DUE_SOON]: {
    domainEvent: DOMAIN_EVENTS.ASSIGNMENT_DUE_SOON,
    surfaceKind: SURFACE_KIND.BOTH,
    primaryOwner: OWNERSHIP.PLANNER,
    deliversNotification: true,
    deliversPlannerEntry: true,
    notificationType: 'assignment_due',
    plannerTodoType: null,
    plannerOwnerRoles: ['student'],
    description: 'Derived due workload; prefer planner for action, notification for awareness.',
  },
  [DOMAIN_EVENTS.DISCUSSION_REPLY]: {
    domainEvent: DOMAIN_EVENTS.DISCUSSION_REPLY,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'discussion',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Discussion activity alert.',
  },
  [DOMAIN_EVENTS.GROUP_MEETING_SCHEDULED]: {
    domainEvent: DOMAIN_EVENTS.GROUP_MEETING_SCHEDULED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'announcement',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Group meeting fanout uses announcement notification type today.',
  },
  [DOMAIN_EVENTS.GROUP_MEETING_UPDATED]: {
    domainEvent: DOMAIN_EVENTS.GROUP_MEETING_UPDATED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'announcement',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Group meeting update fanout.',
  },
  [DOMAIN_EVENTS.GROUP_MEETING_CANCELLED]: {
    domainEvent: DOMAIN_EVENTS.GROUP_MEETING_CANCELLED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'announcement',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Group meeting cancellation fanout.',
  },
  [DOMAIN_EVENTS.ASSIGNMENT_CREATED]: {
    domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'assignment_due',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'New assignment available to enrolled students.',
  },
  [DOMAIN_EVENTS.ASSIGNMENT_UPDATED]: {
    domainEvent: DOMAIN_EVENTS.ASSIGNMENT_UPDATED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'assignment_due',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Assignment details changed for enrolled students.',
  },
  [DOMAIN_EVENTS.ASSIGNMENT_PUBLISHED]: {
    domainEvent: DOMAIN_EVENTS.ASSIGNMENT_PUBLISHED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'assignment_due',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Assignment published for enrolled students.',
  },
  [DOMAIN_EVENTS.DISCUSSION_CREATED]: {
    domainEvent: DOMAIN_EVENTS.DISCUSSION_CREATED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'discussion',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'New discussion thread in course.',
  },
  [DOMAIN_EVENTS.DISCUSSION_GRADED]: {
    domainEvent: DOMAIN_EVENTS.DISCUSSION_GRADED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'grade',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Discussion grade released to student.',
  },
  [DOMAIN_EVENTS.COURSE_PUBLISHED]: {
    domainEvent: DOMAIN_EVENTS.COURSE_PUBLISHED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'announcement',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Course published for enrolled students.',
  },
  [DOMAIN_EVENTS.COURSE_UNPUBLISHED]: {
    domainEvent: DOMAIN_EVENTS.COURSE_UNPUBLISHED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'announcement',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Course unpublished for enrolled students.',
  },
  [DOMAIN_EVENTS.GRADES_POSTED]: {
    domainEvent: DOMAIN_EVENTS.GRADES_POSTED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'grade',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Course grades posted for students.',
  },
  [DOMAIN_EVENTS.GRADES_FINALIZED]: {
    domainEvent: DOMAIN_EVENTS.GRADES_FINALIZED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'grade',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Course grades finalized for students.',
  },
  [DOMAIN_EVENTS.GRADES_AMENDED]: {
    domainEvent: DOMAIN_EVENTS.GRADES_AMENDED,
    surfaceKind: SURFACE_KIND.NOTIFICATION,
    primaryOwner: OWNERSHIP.NOTIFICATION,
    deliversNotification: true,
    deliversPlannerEntry: false,
    notificationType: 'grade',
    plannerTodoType: null,
    plannerOwnerRoles: [],
    description: 'Grade amendment applied for affected students.',
  },
});

function getEventContract(domainEvent) {
  if (!domainEvent) return null;
  return EVENT_CONTRACTS[domainEvent] || null;
}

function listEventContracts() {
  return Object.values(EVENT_CONTRACTS);
}

function isKnownDomainEvent(domainEvent) {
  return Boolean(getEventContract(domainEvent));
}

module.exports = {
  EVENT_CONTRACTS,
  getEventContract,
  listEventContracts,
  isKnownDomainEvent,
};
