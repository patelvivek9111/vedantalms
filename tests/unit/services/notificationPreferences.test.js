const {
  mapNotificationTypeToPreferenceKey,
  isInAppNotificationEnabled,
} = require('../../../services/notification/notificationPreferences');

describe('notificationPreferences', () => {
  it('maps notification types to stored preference keys', () => {
    expect(mapNotificationTypeToPreferenceKey('assignment_due')).toBe('assignmentsDue');
    expect(mapNotificationTypeToPreferenceKey('assignment_graded')).toBe('assignmentsGraded');
    expect(mapNotificationTypeToPreferenceKey('grade')).toBe('grades');
    expect(mapNotificationTypeToPreferenceKey('message')).toBe('messages');
    expect(mapNotificationTypeToPreferenceKey('announcement')).toBe('announcements');
    expect(mapNotificationTypeToPreferenceKey('enrollment')).toBe('enrollments');
    expect(mapNotificationTypeToPreferenceKey('discussion')).toBe('discussions');
    expect(mapNotificationTypeToPreferenceKey('submission')).toBe('submissions');
    expect(mapNotificationTypeToPreferenceKey('system')).toBe('system');
  });

  it('defaults in-app to enabled when preference key is unset', () => {
    expect(isInAppNotificationEnabled(null, 'message')).toBe(true);
    expect(isInAppNotificationEnabled({ inApp: {} }, 'message')).toBe(true);
    expect(isInAppNotificationEnabled({ inApp: { messages: true } }, 'message')).toBe(true);
  });

  it('respects explicit in-app false on mapped keys', () => {
    expect(
      isInAppNotificationEnabled({ inApp: { messages: false } }, 'message')
    ).toBe(false);
    expect(
      isInAppNotificationEnabled({ inApp: { announcements: false } }, 'announcement')
    ).toBe(false);
  });

  it('supports legacy singular preference keys', () => {
    expect(
      isInAppNotificationEnabled({ inApp: { message: false } }, 'message')
    ).toBe(false);
  });

  it('always allows assignment due notifications (To-Do owned, not disableable)', () => {
    expect(
      isInAppNotificationEnabled({ inApp: { assignmentsDue: false } }, 'assignment_due')
    ).toBe(true);
  });
});
