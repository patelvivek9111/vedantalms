import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Menu, ArrowLeft, User as UserIcon, Settings, Megaphone, ClipboardList, 
  HelpCircle, LogOut, CheckSquare, Sun, Moon, Users, Shield, BookOpen, BarChart3, Gauge, Check
} from 'lucide-react';

const SECTION_LABEL =
  'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400';
const SETTINGS_CARD =
  'overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800';
import { 
  getImageUrl, updateUserProfile, uploadProfilePicture, getUserPreferences, 
  updateUserPreferences, getLoginActivity 
} from '../../services/api';
import api from '../../services/api';
import { NavCustomizationModal, NavItem } from '../layout/NavCustomizationModal';
import { ChangeUserModal } from '../modals/ChangeUserModal';
import { NotificationPreferencesPanel } from '../notifications/NotificationPreferencesPanel';

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
  const [prefs, setPrefs] = useState({ theme: 'light', showOnlineStatus: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getUserPreferences().then(res => {
      if (res.data && res.data.preferences) {
        setPrefs({ 
          theme: res.data.preferences.theme || 'light',
          showOnlineStatus: res.data.preferences.showOnlineStatus !== undefined ? res.data.preferences.showOnlineStatus : true
        });
      }
    });
  }, []);

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    const newPrefs = { ...prefs, theme: newTheme };
    setPrefs(newPrefs);
    setTheme(newTheme);
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

  const themeOptionClass = (selected: boolean) =>
    `relative flex h-14 items-center justify-center rounded-lg border transition-colors ${
      selected
        ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-100 dark:border-blue-400 dark:bg-blue-950/30 dark:ring-blue-900/40'
        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/30'
    } ${saving ? 'opacity-50' : ''}`;

  return (
    <div className="space-y-4">
      <div>
        <h3 className={SECTION_LABEL}>Theme</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            disabled={saving}
            className={themeOptionClass(prefs.theme === 'light')}
            aria-pressed={prefs.theme === 'light'}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-600">
              <Sun className="h-4 w-4 text-amber-500" />
            </div>
            {prefs.theme === 'light' && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            disabled={saving}
            className={themeOptionClass(prefs.theme === 'dark')}
            aria-pressed={prefs.theme === 'dark'}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-gray-800 shadow-sm">
              <Moon className="h-4 w-4 text-blue-300" />
            </div>
            {prefs.theme === 'dark' && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </span>
            )}
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="mt-2 text-[11px] text-blue-600 dark:text-blue-400">Theme saved</p>}
      </div>

      <div>
        <h3 className={SECTION_LABEL}>Privacy</h3>
        <div className={`${SETTINGS_CARD} px-3 py-2.5 sm:px-4 sm:py-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                Show Online Status
              </div>
              <div className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
                Allow others to see when you&apos;re online
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleShowOnlineStatusChange(!prefs.showOnlineStatus)}
              disabled={saving}
              className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                prefs.showOnlineStatus ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              } ${saving ? 'cursor-not-allowed opacity-50' : ''}`}
              role="switch"
              aria-checked={prefs.showOnlineStatus}
            >
              <span
                className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  prefs.showOnlineStatus ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
        {success && !error && (
          <p className="mt-2 text-[11px] text-blue-600 dark:text-blue-400">Preferences saved</p>
        )}
      </div>
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

  if (loading) {
    return <p className="py-4 text-center text-[11px] text-gray-500 dark:text-gray-400">Loading…</p>;
  }
  if (error) {
    return <p className="py-4 text-center text-[11px] text-red-600 dark:text-red-400">{error}</p>;
  }
  if (activities.length === 0) {
    return <p className="py-4 text-center text-[11px] text-gray-500 dark:text-gray-400">No recent activity</p>;
  }

  return (
    <div className="space-y-1.5">
      {activities.map((activity, index) => {
        const device = activity.userAgent || 'Unknown device';
        const deviceLabel = device.length > 48 ? `${device.slice(0, 48)}…` : device;

        return (
          <div
            key={activity._id || index}
            className={`${SETTINGS_CARD} px-3 py-2.5 sm:px-3.5 sm:py-3`}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <time
                dateTime={activity.timestamp}
                className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs"
              >
                {new Date(activity.timestamp).toLocaleString()}
              </time>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  activity.success
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                }`}
              >
                {activity.success ? 'Success' : 'Failed'}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-300">IP</span>{' '}
                {activity.ipAddress || '—'}
              </p>
              <p className="truncate" title={device}>
                <span className="font-medium text-gray-600 dark:text-gray-300">Device</span>{' '}
                {deviceLabel}
              </p>
            </div>
          </div>
        );
      })}
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
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
            <button
              type="button"
              onClick={() => setBurgerMenuSection(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
            
            {user?.role === 'admin' && (
              <div className="border-b border-gray-200 py-2 dark:border-gray-700">
                <div className="px-4 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Administration
                  </div>
                </div>
                {[
                  { label: 'Admin Dashboard', to: '/dashboard', icon: Gauge },
                  { label: 'User Management', to: '/admin/users', icon: Users },
                  { label: 'Course Oversight', to: '/admin/courses', icon: BookOpen },
                  { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
                  { label: 'System Settings', to: '/admin/settings', icon: Settings },
                  { label: 'Security', to: '/admin/security', icon: Shield },
                ].map(({ label, to, icon: Icon }) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => {
                      setShowBurgerMenu(false);
                      setBurgerMenuSection(null);
                      navigate(to);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 touch-manipulation dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

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
          <div className="px-4 py-3">
            <SettingsSectionInline />
          </div>
        )}
        {burgerMenuSection === 'notifications' && (
          <div className="px-4 py-3">
            <NotificationPreferencesPanel compact showHeading={false} />
          </div>
        )}
        {burgerMenuSection === 'activity' && (
          <div className="px-4 py-3">
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

