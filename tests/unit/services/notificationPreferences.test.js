const {
  mapNotificationTypeToPreferenceKey,
  isInAppNotificationEnabled,
} = require('../../../services/notification/notificationPreferences');

describe('notificationPreferences', () => {
  it('maps assignment notification types to preference keys', () => {
    expect(mapNotificationTypeToPreferenceKey('assignment_due')).toBe('assignmentsDue');
    expect(mapNotificationTypeToPreferenceKey('assignment_graded')).toBe('assignmentsGraded');
    expect(mapNotificationTypeToPreferenceKey('grade')).toBe('grades');
    expect(mapNotificationTypeToPreferenceKey('message')).toBe('message');
  });

  it('defaults in-app to enabled when preference key is unset', () => {
    expect(isInAppNotificationEnabled(null, 'message')).toBe(true);
    expect(isInAppNotificationEnabled({ inApp: {} }, 'message')).toBe(true);
    expect(isInAppNotificationEnabled({ inApp: { message: true } }, 'message')).toBe(true);
  });

  it('respects explicit in-app false', () => {
    expect(
      isInAppNotificationEnabled({ inApp: { message: false } }, 'message')
    ).toBe(false);
  });
});
