const { createNotification, resolveUserObjectId } = require('./notificationCreate.service');
const { normalizeNotificationPayload } = require('./notificationPayload');
const {
  mapNotificationTypeToPreferenceKey,
  isInAppNotificationEnabled,
  getPreferencesForUser,
} = require('./notificationPreferences');
const {
  isNotificationDedupeEnabled,
  buildDedupeKey,
  resolveDedupeKey,
} = require('./notificationDedupe.service');
const {
  listNotificationsForUser,
  getUnreadCountForUser,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
  deleteNotificationForUser,
  serializeNotification,
} = require('./notificationRead.service');
const {
  isRetentionDefaultsEnabled,
  resolveDefaultExpiresAt,
  getRetentionPolicySummary,
} = require('./notificationRetention.service');
const {
  notifyNotificationInvalidated,
  isEnabled: isNotificationRealtimeEnabled,
} = require('./notificationRealtime.service');

const {
  isAcademicNotificationExpansionEnabled,
  isPlannerMissingAssignmentsEnabled,
  normalizeObjectIdString,
  buildAcademicEventWindow,
  excludeActorFromRecipients,
  uniqueRecipientIds,
  resolveCourseStudentIds,
  fanoutAcademicDomainNotifications,
} = require('./academicNotificationExpansion.service');

module.exports = {
  createNotification,
  resolveUserObjectId,
  normalizeNotificationPayload,
  mapNotificationTypeToPreferenceKey,
  isInAppNotificationEnabled,
  getPreferencesForUser,
  isNotificationDedupeEnabled,
  buildDedupeKey,
  resolveDedupeKey,
  listNotificationsForUser,
  getUnreadCountForUser,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
  deleteNotificationForUser,
  serializeNotification,
  isRetentionDefaultsEnabled,
  resolveDefaultExpiresAt,
  getRetentionPolicySummary,
  notifyNotificationInvalidated,
  isNotificationRealtimeEnabled: isNotificationRealtimeEnabled,
  isAcademicNotificationExpansionEnabled,
  isPlannerMissingAssignmentsEnabled,
  normalizeObjectIdString,
  buildAcademicEventWindow,
  excludeActorFromRecipients,
  uniqueRecipientIds,
  resolveCourseStudentIds,
  fanoutAcademicDomainNotifications,
  ...require('./academicNotificationProducers.service'),
};
