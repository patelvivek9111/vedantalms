const NotificationPreferences = require('../../models/notificationPreferences.model');

function mapNotificationTypeToPreferenceKey(type) {
  if (type === 'assignment_due') return 'assignmentsDue';
  if (type === 'assignment_graded') return 'assignmentsGraded';
  if (type === 'grade') return 'grades';
  return type;
}

/**
 * Default true when preferences are missing or key is unset (legacy behavior).
 */
function isInAppNotificationEnabled(preferences, notificationType) {
  const typeKey = mapNotificationTypeToPreferenceKey(notificationType);
  if (!preferences || !preferences.inApp) return true;
  if (preferences.inApp[typeKey] === undefined) return true;
  return preferences.inApp[typeKey] !== false;
}

async function getPreferencesForUser(userObjectId) {
  return NotificationPreferences.findOne({ user: userObjectId }).lean();
}

module.exports = {
  mapNotificationTypeToPreferenceKey,
  isInAppNotificationEnabled,
  getPreferencesForUser,
};
