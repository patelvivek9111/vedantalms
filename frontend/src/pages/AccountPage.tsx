import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, uploadProfilePicture, getUserPreferences, updateUserPreferences, getLoginActivity, getImageUrl } from '../services/api';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const sections = [
  { key: 'profile', label: 'Profile' },
  { key: 'settings', label: 'Settings' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'activity', label: 'Recent Login Activity' },
];

function ProfileSection() {
  const { user, setUser } = useAuth() as any; // setUser is not in type, but available in context
  const [editMode, setEditMode] = React.useState(false);
  const [firstName, setFirstName] = React.useState(user?.firstName || '');
  const [lastName, setLastName] = React.useState(user?.lastName || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [bio, setBio] = React.useState(user?.bio || '');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);



  React.useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setBio(user?.bio || '');
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateUserProfile({ firstName, lastName, bio });
      if (res.data && res.data.user) {
        setUser(res.data.user);
      }
      setEditMode(false);
    } catch (err: any) {
      // Show detailed error message if available
      if (err.response && err.response.data && err.response.data.message) {
        console.error('Profile update error:', err.response.data);
        alert('Failed to update profile: ' + err.response.data.message);
      } else if (err.message) {
        console.error('Profile update error:', err);
        alert('Failed to update profile: ' + err.message);
      } else {
        console.error('Profile update error:', err);
        alert('Failed to update profile: Unknown error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setEditMode(false);
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const res = await uploadProfilePicture(file);
      if (res.data && res.data.user) {
        setUser(res.data.user);
      }
    } catch (err) {
      alert('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Profile</h2>
              <div className="flex items-center gap-6 mb-6">
          {/* Profile picture */}
          <div className="relative w-20 h-20">
            {user && user.profilePicture ? (
              <img
                src={
                  user.profilePicture.startsWith('http')
                    ? user.profilePicture
                    : getImageUrl(user.profilePicture)
                }
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                onError={(e) => {
                  // Hide the failed image and show fallback
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {/* Fallback avatar - always present but hidden when image loads */}
            <div 
              className={`w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-3xl text-gray-400 dark:text-gray-300 ${user && user.profilePicture ? 'hidden' : ''}`}
              style={{ display: user && user.profilePicture ? 'none' : 'flex' }}
            >
              <span>{user && user.firstName && user.lastName ? `${user.firstName[0]}${user.lastName[0]}` : ''}</span>
            </div>

          <label className="absolute bottom-0 right-0 bg-white dark:bg-gray-800 rounded-full p-1 shadow cursor-pointer border border-gray-300 dark:border-gray-600" title="Change profile picture">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfilePictureChange}
              disabled={uploading}
            />
            <span className="text-xs">{uploading ? '...' : '✏️'}</span>
          </label>
        </div>
        <div>
          <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{user?.firstName} {user?.lastName}</div>
          <div className="text-gray-600 dark:text-gray-400">{user?.email}</div>
          <div className="text-gray-500 dark:text-gray-500 text-sm mt-1">{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</div>
        </div>
      </div>
      {editMode ? (
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
              <input id="firstName" name="firstName" type="text" autoComplete="given-name" className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="flex-1">
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
              <input id="lastName" name="lastName" type="text" autoComplete="family-name" className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed" value={email} onChange={e => setEmail(e.target.value)} disabled />
          </div>
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
            <textarea id="bio" name="bio" autoComplete="off" className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" onClick={handleCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <div className="text-gray-900 dark:text-gray-100">
          <div className="mb-2">
            <span className="font-medium">Name:</span> {user?.firstName} {user?.lastName}
          </div>
          <div className="mb-2">
            <span className="font-medium">Email:</span> {user?.email}
          </div>
          <div className="mb-2">
            <span className="font-medium">Bio:</span> {user?.bio ? user.bio : <span className="text-gray-500 dark:text-gray-400">(not set)</span>}
          </div>
          <button className="mt-4 px-4 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors" onClick={() => setEditMode(true)}>Edit Profile</button>
        </div>
      )}
    </div>
  );
}

function SettingsSection() {
  const [prefs, setPrefs] = React.useState({ language: 'en', timeZone: 'UTC', theme: 'light' });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    setLoading(true);
    getUserPreferences()
      .then(res => {
        if (res.data && res.data.preferences) {
          setPrefs(res.data.preferences);
        }
      })
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    // Skip the first render to avoid setState during render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (prefs.theme && prefs.theme !== theme) {
      setTheme(prefs.theme as 'light' | 'dark');
    }
  }, [prefs.theme, theme, setTheme]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPrefs(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'theme') setTheme(value as 'light' | 'dark');
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateUserPreferences(prefs);
      setSuccess(true);
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-gray-900 dark:text-gray-100">
      <h2 className="text-xl font-semibold mb-2">Settings</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Manage your password, language, time zone, and theme preferences.</p>
      {/* Password Change Scaffold */}
      <div className="mb-8">
        <h3 className="font-semibold mb-1 text-gray-900 dark:text-gray-100">Change Password</h3>
        <form className="flex flex-col gap-2 max-w-md">
          <input type="password" className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed" placeholder="Current Password" disabled />
          <input type="password" className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed" placeholder="New Password" disabled />
          <input type="password" className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed" placeholder="Confirm New Password" disabled />
          <button type="button" className="bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-4 py-2 mt-2 cursor-not-allowed" disabled>Change Password (Coming Soon)</button>
        </form>
      </div>
      {/* Preferences Form */}
      <form className="flex flex-col gap-4 max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow-sm" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Language</label>
          <select name="language" value={prefs.language} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            {/* Add more languages as needed */}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Time Zone</label>
          <select name="timeZone" value={prefs.timeZone} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            {/* Add more time zones as needed */}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="theme" value="light" checked={prefs.theme === 'light'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500" /> 
            <span className="text-gray-700 dark:text-gray-300">Light</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="theme" value="dark" checked={prefs.theme === 'dark'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500" /> 
            <span className="text-gray-700 dark:text-gray-300">Dark</span>
          </label>
        </div>
        {error && <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
        {success && <div className="text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded">Preferences saved!</div>}
        <button type="submit" className="bg-blue-600 dark:bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving || loading}>{saving ? 'Saving...' : 'Save Preferences'}</button>
      </form>
    </div>
  );
}

function NotificationsSection() {
  const [preferences, setPreferences] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/preferences');
      if (response.data.success) {
        setPreferences(response.data.data);
      }
    } catch (err) {
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (category: string, key: string, value: boolean) => {
    if (!preferences) return;
    
    const updated = {
      ...preferences,
      [category]: {
        ...preferences[category],
        [key]: value
      }
    };
    
    setPreferences(updated);
    
    try {
      setSaving(true);
      setError(null);
      await api.put('/notifications/preferences', updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save preferences');
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  const handleQuietHoursToggle = async (enabled: boolean) => {
    if (!preferences) return;
    
    const updated = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        enabled
      }
    };
    
    setPreferences(updated);
    
    try {
      setSaving(true);
      await api.put('/notifications/preferences', updated);
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleQuietHoursChange = async (field: string, value: string) => {
    if (!preferences) return;
    
    const updated = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    };
    
    setPreferences(updated);
    
    try {
      setSaving(true);
      await api.put('/notifications/preferences', updated);
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-gray-500 dark:text-gray-400">Loading notification preferences...</div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-red-500 dark:text-red-400">Failed to load preferences</div>
    );
  }

  const notificationTypes = [
    { key: 'messages', label: 'Messages', description: 'New messages in your inbox' },
    { key: 'grades', label: 'Grades', description: 'When grades are posted or updated' },
    { key: 'announcements', label: 'Announcements', description: 'New course announcements' },
    { key: 'assignmentsDue', label: 'Assignments Due', description: 'Reminders for upcoming assignment due dates' },
    { key: 'assignmentsGraded', label: 'Assignments Graded', description: 'When your assignments are graded' },
    { key: 'enrollments', label: 'Enrollments', description: 'Enrollment requests and approvals' },
    { key: 'discussions', label: 'Discussions', description: 'New discussion threads and replies' },
    { key: 'submissions', label: 'Submissions', description: 'New student submissions (teachers only)' },
    { key: 'system', label: 'System', description: 'System-wide notifications' }
  ];

  return (
    <div className="text-gray-900 dark:text-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Notifications</h2>
        <p className="text-gray-600 dark:text-gray-400">Set your notification preferences for email, in-app, and browser push notifications.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400">
          Preferences saved successfully!
        </div>
      )}

      {/* Email Notifications */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Email Notifications</h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {notificationTypes.map((type) => (
              <div key={type.key} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{type.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{type.description}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.email[type.key] || false}
                    onChange={(e) => handleToggle('email', type.key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* In-App Notifications */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">In-App Notifications</h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {notificationTypes.map((type) => (
              <div key={type.key} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{type.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{type.description}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.inApp[type.key] || false}
                    onChange={(e) => handleToggle('inApp', type.key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Browser Push Notifications */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Browser Push Notifications</h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Enable Push Notifications</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Receive notifications even when the app is closed</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.push.enabled || false}
                onChange={async (e) => {
                  if (e.target.checked) {
                    // Request permission and subscribe
                    try {
                      const { subscribeToPushNotifications } = await import('../utils/pushNotifications');
                      const subscription = await subscribeToPushNotifications();
                      if (subscription) {
                        const subData = {
                          endpoint: subscription.endpoint,
                          keys: {
                            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
                            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
                          }
                        };
                        const updated = {
                          ...preferences,
                          push: { ...preferences.push, enabled: true },
                          pushSubscription: subData
                        };
                        setPreferences(updated);
                        await api.put('/notifications/preferences', updated);
                      } else {
                        alert('Failed to enable push notifications. Please check your browser settings.');
                      }
                    } catch (err) {
                      console.error('Error enabling push notifications:', err);
                      alert('Failed to enable push notifications.');
                    }
                  } else {
                    // Unsubscribe
                    try {
                      const { unsubscribeFromPushNotifications } = await import('../utils/pushNotifications');
                      await unsubscribeFromPushNotifications();
                      const updated = {
                        ...preferences,
                        push: { ...preferences.push, enabled: false },
                        pushSubscription: null
                      };
                      setPreferences(updated);
                      await api.put('/notifications/preferences', updated);
                    } catch (err) {
                      console.error('Error disabling push notifications:', err);
                    }
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
            </label>
          </div>
          {preferences.push.enabled && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {notificationTypes.map((type) => (
                <div key={type.key} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{type.label}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{type.description}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.push[type.key] || false}
                      onChange={(e) => handleToggle('push', type.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quiet Hours</h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Enable Quiet Hours</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Pause notifications during specified hours</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.quietHours?.enabled || false}
                onChange={(e) => handleQuietHoursToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
            </label>
          </div>
          {preferences.quietHours?.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                <input
                  type="time"
                  value={preferences.quietHours.start || '22:00'}
                  onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Time</label>
                <input
                  type="time"
                  value={preferences.quietHours.end || '08:00'}
                  onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Reminders */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Assignment Reminders</h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Weekly Summary</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Get a weekly summary of assignments due this week by Sunday</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.assignmentReminders?.weeklySummary || false}
                  onChange={(e) => {
                    const updated = {
                      ...preferences,
                      assignmentReminders: {
                        ...preferences.assignmentReminders,
                        weeklySummary: e.target.checked
                      }
                    };
                    setPreferences(updated);
                    api.put('/notifications/preferences', updated).catch(() => {
                      setError('Failed to save preferences');
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivitySection() {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [filterDays, setFilterDays] = React.useState(150);

  React.useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getLoginActivity(pagination.page, pagination.limit, filterDays);
        if (response.data.success) {
          setActivities(response.data.data);
          setPagination(response.data.pagination);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load login activity');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [pagination.page, pagination.limit, filterDays]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getDeviceInfo = (userAgent: string) => {
    if (!userAgent) return 'Unknown';
    
    // Simple device detection
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Desktop';
  };

  const getBrowserInfo = (userAgent: string) => {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (days: number) => {
    setFilterDays(days);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filter changes
  };

  return (
    <div className="dark:text-white">
      <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Recent Login Activity</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">View your recent login sessions and security information.</p>
      
      {/* Filter Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="activity-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Show activity from:</label>
          <select
            id="activity-filter"
            name="activity-filter"
            value={filterDays}
            onChange={(e) => handleFilterChange(Number(e.target.value))}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={150}>Last 5 months</option>
          </select>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {activities.length} of {pagination.total} records
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No login activity found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Browser
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {activities.map((activity, index) => (
                    <tr key={activity._id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(activity.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          activity.success 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {activity.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {activity.ipAddress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {getDeviceInfo(activity.userAgent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {getBrowserInfo(activity.userAgent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const sectionComponents: Record<string, React.FC> = {
  profile: ProfileSection,
  settings: SettingsSection,
  notifications: NotificationsSection,
  activity: ActivitySection,
};

const AccountPage: React.FC = () => {
  const [selected, setSelected] = useState('profile');
  const SectionComponent = sectionComponents[selected];

  return (
    <div className="flex min-h-[70vh] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <nav className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
        {sections.map((section) => (
          <button
            key={section.key}
            className={`text-left px-3 py-2 rounded transition font-medium ${
              selected === section.key 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setSelected(section.key)}
          >
            {section.label}
          </button>
        ))}
      </nav>
      {/* Main Content */}
      <main className="flex-1 p-8 bg-gray-50 dark:bg-gray-900">
        <SectionComponent />
      </main>
    </div>
  );
};

export default AccountPage; 