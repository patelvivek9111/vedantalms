import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { updateUserProfile, uploadProfilePicture, getUserPreferences, updateUserPreferences, getLoginActivity, getImageUrl } from '../services/api';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

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
    <div className="max-w-xl w-full">
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        {/* Profile picture */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20">
          {user && user.profilePicture ? (
            <img
              src={
                user.profilePicture.startsWith('http')
                  ? user.profilePicture
                  : getImageUrl(user.profilePicture)
              }
              alt="Profile"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-gray-300 dark:border-gray-600"
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
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl sm:text-3xl text-gray-400 dark:text-gray-300 ${user && user.profilePicture ? 'hidden' : ''}`}
            style={{ display: user && user.profilePicture ? 'none' : 'flex' }}
          >
            <span>{user && user.firstName && user.lastName ? `${user.firstName[0]}${user.lastName[0]}` : ''}</span>
          </div>

          <label className="absolute bottom-0 right-0 bg-white dark:bg-gray-800 rounded-full p-1 sm:p-1.5 shadow cursor-pointer border border-gray-300 dark:border-gray-600 touch-manipulation" title="Change profile picture">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfilePictureChange}
              disabled={uploading}
            />
            <span className="text-[10px] sm:text-xs">{uploading ? '...' : '✏️'}</span>
          </label>
        </div>
        <div className="text-center sm:text-left">
          <div className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{user?.firstName} {user?.lastName}</div>
          <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-all">{user?.email}</div>
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-0.5 sm:mt-1">{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</div>
        </div>
      </div>
      {editMode ? (
        <form className="flex flex-col gap-3 sm:gap-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <label htmlFor="firstName" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
              <input id="firstName" name="firstName" type="text" autoComplete="given-name" className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="flex-1">
              <label htmlFor="lastName" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
              <input id="lastName" name="lastName" type="text" autoComplete="family-name" className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed" value={email} onChange={e => setEmail(e.target.value)} disabled />
          </div>
          <div>
            <label htmlFor="bio" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
            <textarea id="bio" name="bio" autoComplete="off" rows={4} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." />
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2">
            <button type="button" className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm touch-manipulation" onClick={handleCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm touch-manipulation" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <div className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
          <div className="mb-2 sm:mb-3">
            <span className="font-medium text-xs sm:text-sm">Name:</span> <span className="text-xs sm:text-sm">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="mb-2 sm:mb-3">
            <span className="font-medium text-xs sm:text-sm">Email:</span> <span className="text-xs sm:text-sm break-all">{user?.email}</span>
          </div>
          <div className="mb-3 sm:mb-4">
            <span className="font-medium text-xs sm:text-sm">Bio:</span> <span className="text-xs sm:text-sm">{user?.bio ? user.bio : <span className="text-gray-500 dark:text-gray-400">(not set)</span>}</span>
          </div>
          <button className="w-full sm:w-auto mt-2 sm:mt-4 px-3 sm:px-4 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm sm:text-base touch-manipulation" onClick={() => setEditMode(true)}>Edit Profile</button>
        </div>
      )}
    </div>
  );
}

function SettingsSection() {
  const [prefs, setPrefs] = React.useState({ theme: 'light', showOnlineStatus: true });
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
          setPrefs({ 
            theme: res.data.preferences.theme || 'light',
            showOnlineStatus: res.data.preferences.showOnlineStatus !== undefined ? res.data.preferences.showOnlineStatus : true
          });
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

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setPrefs({ ...prefs, theme: newTheme });
    setTheme(newTheme);
    // Auto-save on click
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateUserPreferences({ ...prefs, theme: newTheme });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleShowOnlineStatusChange = async (showOnlineStatus: boolean) => {
    const newPrefs = { ...prefs, showOnlineStatus };
    setPrefs(newPrefs);
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateUserPreferences(newPrefs);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-gray-900 dark:text-gray-100">
      <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-2 sm:mb-3">Settings</h2>
      <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">Manage your password and theme preferences.</p>
      
      {/* Password Change Scaffold */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Change Password</h3>
        <form className="flex flex-col gap-2 w-full max-w-md">
          <input type="password" className="border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed" placeholder="Current Password" disabled />
          <input type="password" className="border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed" placeholder="New Password" disabled />
          <input type="password" className="border border-gray-300 dark:border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed" placeholder="Confirm New Password" disabled />
          <button type="button" className="bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-3 sm:px-4 py-1.5 sm:py-2 mt-1 sm:mt-2 cursor-not-allowed text-xs sm:text-sm" disabled>Change Password (Coming Soon)</button>
        </form>
      </div>

      {/* Theme Selection - Improved UI with Icons */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 p-4 sm:p-6 rounded-lg shadow-sm">
        <h3 className="text-sm sm:text-base font-semibold mb-4 text-gray-900 dark:text-gray-100">Theme</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            disabled={saving || loading}
            className={`relative p-4 rounded-lg border-2 transition-all touch-manipulation ${
              prefs.theme === 'light'
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } ${saving || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-gray-200 shadow-sm flex items-center justify-center">
                <Sun className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
            {prefs.theme === 'light' && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            disabled={saving || loading}
            className={`relative p-4 rounded-lg border-2 transition-all touch-manipulation ${
              prefs.theme === 'dark'
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } ${saving || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-800 border-2 border-gray-700 shadow-sm flex items-center justify-center">
                <Moon className="w-6 h-6 text-blue-300" />
              </div>
            </div>
            {prefs.theme === 'dark' && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        </div>
        
        {error && <div className="text-red-600 dark:text-red-400 text-xs sm:text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded mt-4">{error}</div>}
        {success && <div className="text-green-600 dark:text-green-400 text-xs sm:text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded mt-4">Theme saved!</div>}
      </div>

      {/* Online Status Toggle */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 p-4 sm:p-6 rounded-lg shadow-sm mt-4 sm:mt-6">
        <h3 className="text-sm sm:text-base font-semibold mb-4 text-gray-900 dark:text-gray-100">Privacy</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">Show Online Status</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Allow others to see when you're online</div>
          </div>
          <button
            type="button"
            onClick={() => handleShowOnlineStatusChange(!prefs.showOnlineStatus)}
            disabled={saving || loading}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              prefs.showOnlineStatus ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
            } ${saving || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            role="switch"
            aria-checked={prefs.showOnlineStatus}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                prefs.showOnlineStatus ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {error && <div className="text-red-600 dark:text-red-400 text-xs sm:text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded mt-4">{error}</div>}
        {success && <div className="text-green-600 dark:text-green-400 text-xs sm:text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded mt-4">Preferences saved!</div>}
      </div>
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

  // Simplified notification categories
  const notificationCategories = [
    { 
      key: 'academic', 
      label: 'Academic Updates', 
      description: 'Grades, assignments, and course activities',
      types: ['grades', 'assignmentsDue', 'assignmentsGraded', 'submissions']
    },
    { 
      key: 'communication', 
      label: 'Communication', 
      description: 'Messages, announcements, and discussions',
      types: ['messages', 'announcements', 'discussions']
    },
    { 
      key: 'administrative', 
      label: 'Administrative', 
      description: 'Enrollments and system notifications',
      types: ['enrollments', 'system']
    }
  ];

  return (
    <div className="text-gray-900 dark:text-gray-100">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">Notifications</h2>
        <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400">Set your notification preferences for email, in-app, and browser push notifications.</p>
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

      {/* Simplified Notification Preferences */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">Notification Preferences</h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 space-y-4">
          {notificationCategories.map((category) => {
            // Check if all types in this category are enabled
            const allEmailEnabled = category.types.every(key => preferences.email[key]);
            const allInAppEnabled = category.types.every(key => preferences.inApp[key]);
            
            const handleCategoryToggle = async (channel: 'email' | 'inApp', enabled: boolean) => {
              const updated = {
                ...preferences,
                [channel]: {
                  ...preferences[channel],
                  ...category.types.reduce((acc, key) => {
                    acc[key] = enabled;
                    return acc;
                  }, {} as any)
                }
              };
              setPreferences(updated);
              try {
                setSaving(true);
                await api.put('/notifications/preferences', updated);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
              } catch (err) {
                setError('Failed to save preferences');
                setPreferences(preferences);
              } finally {
                setSaving(false);
              }
            };

            return (
              <div key={category.key} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                <div className="mb-3">
                  <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-1">
                    {category.label}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {category.description}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Email Notifications</span>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 touch-manipulation">
                      <input
                        type="checkbox"
                        checked={allEmailEnabled}
                        onChange={(e) => handleCategoryToggle('email', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">In-App Notifications</span>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 touch-manipulation">
                      <input
                        type="checkbox"
                        checked={allInAppEnabled}
                        onChange={(e) => handleCategoryToggle('inApp', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
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
      <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-1 sm:mb-2 text-gray-800 dark:text-gray-100">Recent Login Activity</h2>
      <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 lg:mb-6">View your recent login sessions and security information.</p>
      
      {/* Filter Controls */}
      <div className="mb-3 sm:mb-4 lg:mb-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="activity-filter" className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Show activity from:</label>
          <select
            id="activity-filter"
            name="activity-filter"
            value={filterDays}
            onChange={(e) => handleFilterChange(Number(e.target.value))}
            className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={150}>Last 5 months</option>
          </select>
        </div>
        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
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
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 sm:p-8 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No login activity found.</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {activities.map((activity, index) => (
              <div key={activity._id || index} className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {formatDate(activity.timestamp)}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${
                    activity.success 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {activity.success ? 'Success' : 'Failed'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">IP:</span> {activity.ipAddress}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Device:</span> {getDeviceInfo(activity.userAgent)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Browser:</span> {getBrowserInfo(activity.userAgent)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Browser
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {activities.map((activity, index) => (
                    <tr key={activity._id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(activity.timestamp)}
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          activity.success 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {activity.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {activity.ipAddress}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {getDeviceInfo(activity.userAgent)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
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
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-0 sm:space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 touch-manipulation"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 touch-manipulation"
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
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') || 'profile';
  const [selected, setSelected] = useState(sectionParam);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const SectionComponent = sectionComponents[selected];

  useEffect(() => {
    const sectionParam = searchParams.get('section') || 'profile';
    if (sectionParam && sectionComponents[sectionParam]) {
      setSelected(sectionParam);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col lg:flex-row min-h-[70vh] bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Toggle account menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Account</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </nav>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[151]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav className={`w-full lg:w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 flex flex-col gap-2 sm:gap-3 lg:gap-4 transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } fixed lg:relative left-0 top-[57px] lg:top-0 h-[calc(100vh-57px-4rem)] lg:h-auto z-[152] lg:z-auto overflow-y-auto`}>
        <div className="flex justify-between items-center mb-2 lg:hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">Account Menu</h3>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 touch-manipulation"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {sections.map((section) => (
          <button
            key={section.key}
            className={`text-left px-3 py-2 sm:py-2.5 rounded transition font-medium text-xs sm:text-sm lg:text-base touch-manipulation ${
              selected === section.key 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600'
            }`}
            onClick={() => {
              setSelected(section.key);
              setSearchParams({ section: section.key });
              setIsMobileMenuOpen(false);
            }}
          >
            {section.label}
          </button>
        ))}
      </nav>
      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8 bg-gray-50 dark:bg-gray-900 w-full pb-20 lg:pb-8 pt-20 lg:pt-3">
        <SectionComponent />
      </main>
    </div>
  );
};

export default AccountPage; 