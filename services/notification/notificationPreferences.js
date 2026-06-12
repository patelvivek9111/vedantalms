const NotificationPreferences = require('../../models/notificationPreferences.model');

/** Maps notification.type values to preference document keys (inApp / email). */
const TYPE_TO_PREFERENCE_KEY = Object.freeze({
  message: 'messages',
  grade: 'grades',
  announcement: 'announcements',
  assignment_due: 'assignmentsDue',
  assignment_graded: 'assignmentsGraded',
  enrollment: 'enrollments',
  discussion: 'discussions',
  submission: 'submissions',
  system: 'system',
});

function mapNotificationTypeToPreferenceKey(type) {
  if (!type) return type;
  return TYPE_TO_PREFERENCE_KEY[type] ?? type;
}

/**
 * Default true when preferences are missing or key is unset (legacy behavior).
 * Supports legacy singular keys (e.g. message) when plural keys are absent.
 */
/** Assignment due dates are surfaced via To-Do; not user-disableable. */
const ALWAYS_ENABLED_NOTIFICATION_TYPES = new Set(['assignment_due']);

function isInAppNotificationEnabled(preferences, notificationType) {
  if (ALWAYS_ENABLED_NOTIFICATION_TYPES.has(notificationType)) {
    return true;
  }

  const typeKey = mapNotificationTypeToPreferenceKey(notificationType);
  if (!preferences || !preferences.inApp) return true;

  if (preferences.inApp[typeKey] !== undefined) {
    return preferences.inApp[typeKey] !== false;
  }

  // Legacy singular keys from older UI/backend mismatch
  if (notificationType && preferences.inApp[notificationType] !== undefined) {
    return preferences.inApp[notificationType] !== false;
  }

  return true;
}

async function getPreferencesForUser(userObjectId) {
  return NotificationPreferences.findOne({ user: userObjectId }).lean();
}

module.exports = {
  mapNotificationTypeToPreferenceKey,
  isInAppNotificationEnabled,
  getPreferencesForUser,
  TYPE_TO_PREFERENCE_KEY,
};
