import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Menu, ArrowLeft, User as UserIcon, Settings, Megaphone, ClipboardList, 
  HelpCircle, LogOut, CheckSquare, Sun, Moon 
} from 'lucide-react';
import { 
  getImageUrl, updateUserProfile, uploadProfilePicture, getUserPreferences, 
  updateUserPreferences, getLoginActivity 
} from '../services/api';
import api from '../services/api';
import { NavCustomizationModal, NavItem } from './NavCustomizationModal';
import { ChangeUserModal } from './ChangeUserModal';

interface BurgerMenuProps {
  showBurgerMenu: boolean;
  setShowBurgerMenu: (show: boolean) => void;
  showNavCustomization?: boolean;
  setShowNavCustomization?: (show: boolean) => void;
  showGrades?: boolean;
  setShowGrades?: (value: boolean) => void;
  currentNavItems?: NavItem[];
  setCurrentNavItems?: (items: NavItem[]) => void;
}

// Inline Section Components
function ProfileSectionInline() {
  const { user, setUser } = useAuth() as any;
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
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
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          {user?.profilePicture ? (
            <img
              src={user.profilePicture.startsWith('http') ? user.profilePicture : getImageUrl(user.profilePicture)}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
              {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
            </div>
          )}
          <label className="absolute bottom-0 right-0 bg-white dark:bg-gray-800 rounded-full p-1 shadow cursor-pointer border border-gray-300 dark:border-gray-600">
            <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureChange} disabled={uploading} />
            <span className="text-xs">{uploading ? '...' : '✏️'}</span>
          </label>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{user?.firstName} {user?.lastName}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</div>
        </div>
      </div>
      {editMode ? (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
            <textarea rows={3} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditMode(false)} className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded text-sm">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Name:</span> {user?.firstName} {user?.lastName}</div>
          <div><span className="font-medium">Email:</span> {user?.email}</div>
          <div><span className="font-medium">Bio:</span> {user?.bio || '(not set)'}</div>
          <button onClick={() => setEditMode(true)} className="w-full mt-3 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded text-sm">Edit Profile</button>
        </div>
      )}
    </div>
  );
}

function SettingsSectionInline() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState({ theme: 'light' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getUserPreferences().then(res => {
      if (res.data && res.data.preferences) {
        setPrefs({ theme: res.data.preferences.theme || 'light' });
      }
    });
  }, []);

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setPrefs({ theme: newTheme });
    setTheme(newTheme);
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Theme</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            disabled={saving}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              prefs.theme === 'light'
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-gray-200 shadow-sm flex items-center justify-center">
                <Sun className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
            {prefs.theme === 'light' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            disabled={saving}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              prefs.theme === 'dark'
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-800 border-2 border-gray-700 shadow-sm flex items-center justify-center">
                <Moon className="w-6 h-6 text-blue-300" />
              </div>
            </div>
            {prefs.theme === 'dark' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>
        {error && <div className="text-red-600 dark:text-red-400 text-xs mt-2">{error}</div>}
        {success && <div className="text-green-600 dark:text-green-400 text-xs mt-2">Theme saved!</div>}
      </div>
    </div>
  );
}

function NotificationsSectionInline() {
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
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
      [category]: { ...preferences[category], [key]: value }
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
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    { key: 'academic', label: 'Academic Updates', types: ['grades', 'assignmentsDue', 'assignmentsGraded', 'submissions'] },
    { key: 'communication', label: 'Communication', types: ['messages', 'announcements', 'discussions'] },
    { key: 'administrative', label: 'Administrative', types: ['enrollments', 'system'] }
  ];

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (!preferences) return <div className="text-sm text-red-500">Failed to load</div>;

  return (
    <div className="space-y-4">
      {error && <div className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
      {success && <div className="text-green-600 dark:text-green-400 text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded">Saved!</div>}
      {categories.map((category) => {
        const allEmailEnabled = category.types.every(key => preferences.email[key]);
        const allInAppEnabled = category.types.every(key => preferences.inApp[key]);
        const handleCategoryToggle = async (channel: 'email' | 'inApp', enabled: boolean) => {
          const updated = {
            ...preferences,
            [channel]: { ...preferences[channel], ...category.types.reduce((acc, key) => { acc[key] = enabled; return acc; }, {} as any) }
          };
          setPreferences(updated);
          try {
            setSaving(true);
            await api.put('/notifications/preferences', updated);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
          } catch (err) {
            setError('Failed to save');
            setPreferences(preferences);
          } finally {
            setSaving(false);
          }
        };
        return (
          <div key={category.key} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
            <div className="font-semibold text-sm mb-2">{category.label}</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Email</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={allEmailEnabled} onChange={(e) => handleCategoryToggle('email', e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 dark:bg-gray-700 dark:peer-checked:bg-blue-500 after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">In-App</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={allInAppEnabled} onChange={(e) => handleCategoryToggle('inApp', e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 dark:bg-gray-700 dark:peer-checked:bg-blue-500 after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivitySectionInline() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await getLoginActivity(1, 10, 30);
        if (response.data && response.data.success) {
          setActivities(response.data.data || []);
        }
      } catch (err) {
        setError('Failed to load activities');
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (activities.length === 0) return <div className="text-sm text-gray-500">No recent activity</div>;

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={activity._id || index} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0">
          <div className="flex justify-between items-start mb-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {new Date(activity.timestamp).toLocaleString()}
            </div>
            <span className={`text-xs px-2 py-1 rounded ${activity.success ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
              {activity.success ? 'Success' : 'Failed'}
            </span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div>IP: {activity.ipAddress}</div>
            <div>Device: {activity.userAgent?.substring(0, 50)}...</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({
  showBurgerMenu,
  setShowBurgerMenu,
  showNavCustomization,
  setShowNavCustomization,
  showGrades,
  setShowGrades,
  currentNavItems,
  setCurrentNavItems
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [burgerMenuSection, setBurgerMenuSection] = useState<string | null>(null);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);

  if (!showBurgerMenu) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
        onClick={() => {
          setShowBurgerMenu(false);
          setBurgerMenuSection(null);
        }}
      />
      {/* Menu - Centered */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[calc(100vw-2rem)] max-w-md max-h-[85vh] overflow-y-auto z-[152]">
        {/* Back Button (when viewing a section) */}
        {burgerMenuSection && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <button
              onClick={() => setBurgerMenuSection(null)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {burgerMenuSection === 'profile' && 'Profile'}
              {burgerMenuSection === 'settings' && 'Settings'}
              {burgerMenuSection === 'notifications' && 'Notifications'}
              {burgerMenuSection === 'activity' && 'Recent Login Activity'}
            </h2>
          </div>
        )}

        {/* Main Menu View */}
        {!burgerMenuSection && (
          <>
            {/* Profile Information */}
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture.startsWith('http') 
                        ? user.profilePicture 
                        : getImageUrl(user.profilePicture)}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  {/* Fallback avatar */}
                  <div
                    className={`w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold ${
                      user?.profilePicture ? 'hidden' : 'flex'
                    }`}
                    style={{
                      display: user?.profilePicture ? 'none' : 'flex'
                    }}
                  >
                    {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email}
                  </div>
                  {user?.role && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                      {user.role}
                    </div>
                  )}
                </div>
              </div>
              {/* Profile Details */}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Name:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{user?.firstName} {user?.lastName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Email:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400 break-all">{user?.email}</span>
                </div>
                {user?.bio && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Bio:</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">{user.bio}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Account Sections */}
            <div className="py-2">
              <button
                onClick={() => setBurgerMenuSection('profile')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => setBurgerMenuSection('settings')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => setBurgerMenuSection('notifications')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <Megaphone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>Notifications</span>
              </button>
              <button
                onClick={() => setBurgerMenuSection('activity')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <ClipboardList className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>Recent Login Activity</span>
              </button>
            </div>
            
            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>
            
            {/* Options Section */}
            {showGrades !== undefined && setShowGrades && (
              <div className="py-2">
                <div className="px-4 py-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Options
                  </div>
                </div>
                {/* Show Grades Toggle */}
                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer touch-manipulation"
                  onClick={() => {
                    const newValue = !showGrades;
                    setShowGrades(newValue);
                    localStorage.setItem('showGrades', JSON.stringify(newValue));
                  }}
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show Grades</span>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      showGrades ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                        showGrades ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
                {/* Customize Navigation */}
                {setShowNavCustomization && (
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      setBurgerMenuSection(null);
                      setShowNavCustomization(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
                  >
                    <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Customize Navigation</span>
                  </button>
                )}
              </div>
            )}
            
            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>
            
            {/* Other Options */}
            <div className="py-2">
              <button
                onClick={() => {
                  setShowBurgerMenu(false);
                  setBurgerMenuSection(null);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <HelpCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>Help</span>
              </button>
              <button
                onClick={() => {
                  setShowBurgerMenu(false);
                  setBurgerMenuSection(null);
                  setShowChangeUserModal(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>Change User</span>
              </button>
              <button
                onClick={() => {
                  setShowBurgerMenu(false);
                  setBurgerMenuSection(null);
                  logout();
                  navigate('/login');
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
              >
                <LogOut className="h-5 w-5" />
                <span>Log Out</span>
              </button>
            </div>
          </>
        )}

        {/* Section Content Views */}
        {burgerMenuSection === 'profile' && (
          <div className="p-4">
            <ProfileSectionInline />
          </div>
        )}
        {burgerMenuSection === 'settings' && (
          <div className="p-4">
            <SettingsSectionInline />
          </div>
        )}
        {burgerMenuSection === 'notifications' && (
          <div className="p-4">
            <NotificationsSectionInline />
          </div>
        )}
        {burgerMenuSection === 'activity' && (
          <div className="p-4">
            <ActivitySectionInline />
          </div>
        )}
      </div>

      {/* Change User Modal */}
      <ChangeUserModal
        isOpen={showChangeUserModal}
        onClose={() => setShowChangeUserModal(false)}
      />
    </>
  );
};

