export type InAppPreferenceKey =
  | 'assignmentsGraded'
  | 'grades'
  | 'messages'
  | 'announcements'
  | 'enrollments'
  | 'submissions'
  | 'system';

export type NotificationToggleRole = 'student' | 'teacher' | 'admin';

export type InAppNotificationToggle = {
  id: string;
  keys: InAppPreferenceKey[];
  label: string;
  description: string;
  roles?: NotificationToggleRole[];
};

/** In-app notification toggles shown in account settings (email/push hidden until implemented). */
export const IN_APP_NOTIFICATION_TOGGLES: InAppNotificationToggle[] = [
  {
    id: 'grades',
    keys: ['assignmentsGraded', 'grades'],
    label: 'Grades',
    description: 'When assignments or other work has been graded',
  },
  {
    id: 'messages',
    keys: ['messages'],
    label: 'Messages',
    description: 'New inbox messages',
  },
  {
    id: 'announcements',
    keys: ['announcements'],
    label: 'Announcements & meetings',
    description: 'Course announcements and meeting updates',
  },
  {
    id: 'enrollments',
    keys: ['enrollments'],
    label: 'Enrollment updates',
    description: 'Approved, denied, or waitlist changes',
  },
  {
    id: 'submissions',
    keys: ['submissions'],
    label: 'New submissions',
    description: 'When a student submits work',
    roles: ['teacher', 'admin'],
  },
  {
    id: 'system',
    keys: ['system'],
    label: 'System alerts',
    description: 'Maintenance and account notices',
  },
];

export function getVisibleInAppToggles(role?: string | null): InAppNotificationToggle[] {
  const normalized = role || 'student';
  return IN_APP_NOTIFICATION_TOGGLES.filter(
    (toggle) => !toggle.roles || toggle.roles.includes(normalized as NotificationToggleRole)
  );
}

export function isToggleEnabled(
  inApp: Record<string, boolean | undefined> | undefined,
  keys: InAppPreferenceKey[]
): boolean {
  return keys.every((key) => inApp?.[key] !== false);
}
