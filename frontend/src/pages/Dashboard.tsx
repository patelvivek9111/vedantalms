import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import { ToDoPanel } from '../components/ToDoPanel';
import { MoreVertical, Megaphone, FileText, MessageSquare, Palette, BookOpen, File, Settings, Bell, Menu, Folder, HelpCircle, User as UserIcon, LogOut, CheckSquare, ClipboardList, ArrowLeft, Sun, Moon } from 'lucide-react';
import api, { getUserPreferences, updateUserPreferences, getImageUrl, updateUserProfile, uploadProfilePicture, getLoginActivity } from '../services/api';
import NotificationCenter from '../components/NotificationCenter';
import { NavCustomizationModal, NavItem, ALL_NAV_OPTIONS, DEFAULT_NAV_ITEMS } from '../components/NavCustomizationModal';
import { ChangeUserModal } from '../components/ChangeUserModal';
import { useTheme } from '../context/ThemeContext';

// Earthy tone color palette
const earthyColors = [
  { name: 'Olive Green', value: '#556B2F' },
  { name: 'Sage Green', value: '#9CAF88' },
  { name: 'Terra Cotta', value: '#E2725B' },
  { name: 'Warm Brown', value: '#8B4513' },
  { name: 'Moss Green', value: '#606C38' },
  { name: 'Clay Brown', value: '#D2691E' },
  { name: 'Forest Green', value: '#228B22' },
  { name: 'Earth Red', value: '#CD5C5C' },
  { name: 'Sand Beige', value: '#F4A460' },
  { name: 'Deep Brown', value: '#654321' }
];

// Available action icons
const availableIcons = [
  { id: 'announcements', name: 'Announcements', icon: Megaphone, color: 'text-gray-600' },
  { id: 'modules', name: 'Modules', icon: BookOpen, color: 'text-gray-600' },
  { id: 'pages', name: 'Pages', icon: File, color: 'text-gray-600' },
  { id: 'discussions', name: 'Discussions', icon: MessageSquare, color: 'text-gray-600' }
];

// Inline Section Components for Burger Menu
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

export function Dashboard() {
  const courseContext = useCourse();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Safety check - ensure context is available
  if (!courseContext) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  const { courses, loading, error, updateCourse, getCourses } = courseContext;
  
  // State to track user's personal course colors (for students) or course default colors (for teachers)
  const [userCourseColors, setUserCourseColors] = useState<{ [key: string]: string }>({});
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);
  
  // State to track selected icons for each course (default to first 3)
  const [courseIcons, setCourseIcons] = useState<{ [key: string]: string[] }>(() => {
    // Load icons from localStorage on component mount
    const savedIcons = localStorage.getItem('courseIcons');
    return savedIcons ? JSON.parse(savedIcons) : {};
  });
  const [openIconPicker, setOpenIconPicker] = useState<string | null>(null);
  
  // Notification state
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Navigation customization state
  const [showNavCustomization, setShowNavCustomization] = useState(false);
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [burgerMenuSection, setBurgerMenuSection] = useState<string | null>(null); // 'profile' | 'settings' | 'notifications' | 'activity' | null
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const [currentNavItems, setCurrentNavItems] = useState<NavItem[]>([]);
  const [showGrades, setShowGrades] = useState(() => {
    const saved = localStorage.getItem('showGrades');
    return saved ? JSON.parse(saved) : true;
  });
  const [courseGrades, setCourseGrades] = useState<{ [courseId: string]: { grade: number | null; letter?: string } }>({});
  const [loadingGrades, setLoadingGrades] = useState<{ [courseId: string]: boolean }>({});
  const loadedGradesRef = useRef<Set<string>>(new Set());
  
  // Refs for dropdown containers
  const colorPickerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const iconPickerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  // Load user preferences on mount and when user changes
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) {
        // Clear preferences when no user
        setUserCourseColors({});
        setLoadingPreferences(false);
        return;
      }
      
      try {
        setLoadingPreferences(true);
        const response = await getUserPreferences();
        if (response.data.success && response.data.preferences?.courseColors) {
          setUserCourseColors(response.data.preferences.courseColors || {});
        } else {
          setUserCourseColors({});
        }
      } catch (err) {
        console.error('Error loading user preferences:', err);
        setUserCourseColors({});
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadUserPreferences();
  }, [user?._id]); // Use user._id to ensure it reloads when user changes

  // Fetch notification count
  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const response = await api.get('/notifications/unread-count');
        if (response.data.success) {
          setNotificationCount(response.data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch course grades when showGrades is enabled
  useEffect(() => {
    if (!showGrades) {
      setCourseGrades({});
      loadedGradesRef.current.clear();
      return;
    }

    if (!courses || courses.length === 0) return;

    const fetchCourseGrades = async () => {
      // Filter published courses
      const publishedCoursesList = courses.filter(course => course.published);
      if (publishedCoursesList.length === 0) return;

      const courseIds = publishedCoursesList.map(c => c._id);
      const coursesToLoad = courseIds.filter(id => !loadedGradesRef.current.has(id));

      for (const courseId of coursesToLoad) {
        const course = publishedCoursesList.find(c => c._id === courseId);
        if (!course) continue;
        
        loadedGradesRef.current.add(courseId);
        setLoadingGrades(prev => ({ ...prev, [courseId]: true }));
        try {
          if (isTeacherOrAdmin) {
            // Fetch class average for teachers/admin
            const response = await api.get(`/grades/course/${courseId}/average`);
            console.log(`Grade response for course ${courseId} (teacher/admin):`, response.data);
            if (response.data && response.data.average !== null && response.data.average !== undefined) {
              const average = response.data.average;
              setCourseGrades(prev => ({
                ...prev,
                [courseId]: { grade: average }
              }));
            } else {
              setCourseGrades(prev => ({
                ...prev,
                [courseId]: { grade: null }
              }));
            }
          } else {
            // Fetch student's own grade
            const response = await api.get(`/grades/student/course/${courseId}`);
            console.log(`Grade response for course ${courseId} (student):`, response.data);
            if (response.data && response.data.totalPercent !== null && response.data.totalPercent !== undefined) {
              const grade = response.data.totalPercent;
              const letter = response.data.letterGrade || '';
              setCourseGrades(prev => ({
                ...prev,
                [courseId]: { grade, letter }
              }));
            } else {
              setCourseGrades(prev => ({
                ...prev,
                [courseId]: { grade: null }
              }));
            }
          }
        } catch (error: any) {
          console.error(`Error fetching grade for course ${courseId}:`, error);
          console.error('Error details:', error.response?.data || error.message);
          setCourseGrades(prev => ({
            ...prev,
            [courseId]: { grade: null }
          }));
        } finally {
          setLoadingGrades(prev => ({ ...prev, [courseId]: false }));
        }
      }
    };

    fetchCourseGrades();
  }, [showGrades, courses, isTeacherOrAdmin, user?._id]);

  // Load current navigation items
  useEffect(() => {
    const loadNavItems = () => {
      try {
        const saved = localStorage.getItem('bottomNavItems');
        if (saved) {
          const savedItems = JSON.parse(saved);
          const mappedItems = savedItems.map((item: any) => {
            const option = ALL_NAV_OPTIONS.find(opt => opt.id === item.id);
            if (option) {
              return {
                ...option,
                ...item
              };
            }
            return null;
          }).filter((item: NavItem | null): item is NavItem => item !== null);
          
          // Filter out 'my-course' if user is not a teacher or admin
          const filteredItems = mappedItems.filter((item: NavItem) => {
            if (item.id === 'my-course' && user?.role !== 'teacher' && user?.role !== 'admin') {
              return false;
            }
            return true;
          });
          
          if (filteredItems.length > 0) {
            setCurrentNavItems(filteredItems);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading navigation items:', error);
      }
      
      // Default items
      const availableOptions = ALL_NAV_OPTIONS.filter(option => {
        if (option.id === 'my-course') {
          return user?.role === 'teacher' || user?.role === 'admin';
        }
        return true;
      });
      
      const defaultItems = DEFAULT_NAV_ITEMS
        .map(id => availableOptions.find(opt => opt.id === id))
        .filter((item): item is NavItem => item !== undefined);
      setCurrentNavItems(defaultItems);
    };

    loadNavItems();
  }, [user?.role]);

  // Click outside handler to close dropdowns - FIXED VERSION
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any color picker
      const isOutsideColorPicker = Object.values(colorPickerRefs.current).every(ref => 
        !ref || !ref.contains(target)
      );
      
      // Check if click is outside any icon picker
      const isOutsideIconPicker = Object.values(iconPickerRefs.current).every(ref => 
        !ref || !ref.contains(target)
      );
      
      // Only close dropdowns if clicking outside AND not on a course card
      const isOnCourseCard = (target as Element).closest('[data-course-card]');
      
      if (isOutsideColorPicker && !isOnCourseCard) {
        setOpenColorPicker(null);
      }
      
      if (isOutsideIconPicker && !isOnCourseCard) {
        setOpenIconPicker(null);
      }
      
      // Note: NotificationCenter handles its own click outside detection
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  // Split courses into published and unpublished
  const publishedCourses = courses.filter(course => course.published);
  const unpublishedCourses = courses.filter(course => !course.published);

  const handleCardClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  const handleColorChange = async (courseId: string, color: string) => {
    try {
      if (isTeacherOrAdmin) {
        // Teacher/Admin: Update course's defaultColor
        await updateCourse(courseId, undefined, undefined, undefined, color);
        // Refresh courses to get updated defaultColor
        await getCourses();
      } else {
        // Student: Update user's personal course color preference
    const newColors = {
          ...userCourseColors,
      [courseId]: color
    };
        setUserCourseColors(newColors);
        await updateUserPreferences({ courseColors: newColors });
      }
    setOpenColorPicker(null);
    } catch (err) {
      console.error('Error updating course color:', err);
      // Optionally show an error message to the user
    }
  };

  const getCourseColor = (courseId: string) => {
    const course = courses.find(c => c._id === courseId);
    
    if (isTeacherOrAdmin) {
      // Teachers see the course's defaultColor
      return course?.defaultColor || '#556B2F';
    } else {
      // Students: priority is user's personal color > course defaultColor > fallback
      if (userCourseColors[courseId]) {
        return userCourseColors[courseId];
      }
      return course?.defaultColor || '#556B2F';
    }
  };

  const getCourseIcons = (courseId: string) => {
    return courseIcons[courseId] || ['announcements', 'pages', 'discussions']; // Default icons
  };

  const handleIconToggle = (courseId: string, iconId: string) => {
    const currentIcons = getCourseIcons(courseId);
    const isSelected = currentIcons.includes(iconId);
    
    let newIcons;
    if (isSelected) {
      // Remove icon
      newIcons = currentIcons.filter(id => id !== iconId);
    } else {
      // Add icon (max 3)
      if (currentIcons.length < 3) {
        newIcons = [...currentIcons, iconId];
      } else {
        return; // Don't update if already at max
      }
    }
    
    const newCourseIcons = {
      ...courseIcons,
      [courseId]: newIcons
    };
    setCourseIcons(newCourseIcons);
    // Save to localStorage
    localStorage.setItem('courseIcons', JSON.stringify(newCourseIcons));
  };

  const renderActionIcon = (iconId: string, courseId: string) => {
    const iconConfig = availableIcons.find(icon => icon.id === iconId);
    if (!iconConfig) return null;
    
    const IconComponent = iconConfig.icon;
    return (
      <button 
        key={iconId}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          // Navigate to specific course section based on icon type
          switch(iconId) {
            case 'announcements':
              navigate(`/courses/${courseId}/announcements`);
              break;
            case 'modules':
              navigate(`/courses/${courseId}/modules`);
              break;
            case 'pages':
              navigate(`/courses/${courseId}/pages`);
              break;
            case 'discussions':
              navigate(`/courses/${courseId}/discussions`);
              break;
            default:
              navigate(`/courses/${courseId}`);
          }
        }}
      >
        <IconComponent className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open account menu"
          >
            <UserIcon className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Dashboard</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu Dropdown */}
          {showBurgerMenu && (
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
                    </div>
                    
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
          </>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col lg:flex-row gap-4 lg:gap-8 lg:pt-8 pt-20">
        {/* Main dashboard content */}
        <div className="flex-1">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="lg:ml-0">
              <h1 className="hidden lg:block text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Welcome back, {user?.firstName}!</p>
            </div>
            {/* Notification Bell - Hidden on mobile */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                className="relative p-3 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />
                {notificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </div>
                )}
              </button>
            </div>
          </div>
          {/* Notification Center - Rendered outside header for proper fixed positioning */}
          <NotificationCenter 
            isOpen={showNotificationCenter} 
            onClose={() => setShowNotificationCenter(false)}
          />
        {/* Published Courses Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            {isTeacherOrAdmin ? (
              <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">Published Courses ({publishedCourses.length})</h2>
            ) : (
              <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">My Courses</h2>
            )}
            {isTeacherOrAdmin && (
              <Link
                to="/courses/create"
                className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors text-sm sm:text-base w-full sm:w-auto text-center"
              >
                Create Course
              </Link>
            )}
          </div>
          {publishedCourses.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm sm:text-base">No published courses</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {publishedCourses.map((course) => (
                <div 
                  key={course._id} 
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-visible cursor-pointer hover:shadow-xl transition-all duration-300 sm:ml-4 border border-gray-100 dark:border-gray-700 group"
                  onClick={() => handleCardClick(course._id)}
                  data-course-card
                >
                  {/* Top section - Dynamic color */}
                  <div 
                    className="h-32 sm:h-48 relative"
                    style={{ backgroundColor: getCourseColor(course._id) }}
                  >
                    {/* Grade Display - Top Left */}
                    {showGrades && (
                      <div className="absolute top-3 left-3 z-10">
                        {loadingGrades[course._id] ? (
                          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-md">
                            <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          </div>
                        ) : (() => {
                          const grade = courseGrades[course._id]?.grade;
                          return grade !== null && grade !== undefined && typeof grade === 'number' && !isNaN(grade);
                        })() ? (
                          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-2.5 py-1.5 rounded-md shadow-md">
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {(() => {
                                const grade = courseGrades[course._id]?.grade;
                                return grade !== null && grade !== undefined ? grade.toFixed(2) : '0.00';
                              })()}%
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                            setOpenIconPicker(null);
                          }}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-white" />
                        </button>
                        
                        {/* Color picker dropdown */}
                        {openColorPicker === course._id && (
                          <div 
                            className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                            ref={(el) => { colorPickerRefs.current[course._id] = el; }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Palette className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose Color</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2 mb-3">
                              {earthyColors.map((color) => (
                                <button
                                  key={color.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleColorChange(course._id, color.value);
                                  }}
                                  className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors"
                                  style={{ backgroundColor: color.value }}
                                  title={color.name}
                                />
                              ))}
                            </div>
                            <hr className="my-2" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenColorPicker(null);
                                setOpenIconPicker(openIconPicker === course._id ? null : course._id);
                              }}
                              className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                            >
                              <Settings className="h-4 w-4" />
                              <span>Display Icons</span>
                            </button>
                          </div>
                        )}

                        {/* Icon picker dropdown */}
                        {openIconPicker === course._id && (
                          <div 
                            className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                            ref={(el) => { iconPickerRefs.current[course._id] = el; }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Icons (Max 3)</span>
                            </div>
                            <div className="space-y-2">
                              {availableIcons.map((iconConfig) => {
                                const IconComponent = iconConfig.icon;
                                const isSelected = getCourseIcons(course._id).includes(iconConfig.id);
                                const isDisabled = !isSelected && getCourseIcons(course._id).length >= 3;
                                
                                return (
                                  <button
                                    key={iconConfig.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isDisabled) {
                                        handleIconToggle(course._id, iconConfig.id);
                                      }
                                    }}
                                    className={`flex items-center gap-2 w-full text-left p-2 rounded transition-colors ${
                                      isSelected 
                                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                                        : isDisabled 
                                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                    disabled={isDisabled}
                                  >
                                    <IconComponent className="h-4 w-4" />
                                    <span className="text-sm">{iconConfig.name}</span>
                                    {isSelected && (
                                      <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                        Selected
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            <hr className="my-2" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenIconPicker(null);
                                setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                              }}
                              className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                            >
                              <Palette className="h-4 w-4" />
                              <span>Choose Color</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom section - White */}
                  <div className="p-4 sm:p-6">
                    <div className="mb-2">
                      <h2 
                        className="font-bold text-base sm:text-lg mb-1 line-clamp-2"
                        style={{ color: getCourseColor(course._id) }}
                      >
                        {course.catalog?.courseCode || course.title}
                      </h2>
                      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm line-clamp-1">
                        Instructor: {course.instructor.firstName} {course.instructor.lastName}
                      </p>
                    </div>
                    
                    {/* Action icons */}
                    <div className="flex justify-between items-center mt-3 sm:mt-4">
                      {getCourseIcons(course._id).map((iconId) => renderActionIcon(iconId, course._id))}
                      {/* Add empty divs to maintain spacing if less than 3 icons */}
                      {Array.from({ length: 3 - getCourseIcons(course._id).length }).map((_, index) => (
                        <div key={index} className="w-9 h-9"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Unpublished Courses Section (hide for students) */}
        {isTeacherOrAdmin && (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">Unpublished Courses ({unpublishedCourses.length})</h2>
            {unpublishedCourses.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm sm:text-base">No unpublished courses</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {unpublishedCourses.map((course) => (
                  <div 
                    key={course._id} 
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 dark:border-gray-700"
                    onClick={() => handleCardClick(course._id)}
                  >
                    {/* Top section - Dynamic color */}
                    <div 
                      className="h-32 sm:h-48 relative bg-gradient-to-br"
                      style={{ 
                        background: `linear-gradient(135deg, ${getCourseColor(course._id)} 0%, ${getCourseColor(course._id)}dd 100%)`
                      }}
                    >
                      {/* Grade Display - Top Left */}
                      {showGrades && (
                        <div className="absolute top-3 left-3 z-10">
                          {loadingGrades[course._id] ? (
                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-md">
                              <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                            </div>
                          ) : (() => {
                            const grade = courseGrades[course._id]?.grade;
                            return grade !== null && grade !== undefined && typeof grade === 'number' && !isNaN(grade);
                          })() ? (
                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-2.5 py-1.5 rounded-md shadow-md">
                              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                {(() => {
                                  const grade = courseGrades[course._id]?.grade;
                                  return grade !== null && grade !== undefined ? grade.toFixed(2) : '0.00';
                                })()}%
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                              setOpenIconPicker(null);
                            }}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                          >
                            <MoreVertical className="h-5 w-5 text-white" />
                          </button>
                          
                          {/* Color picker dropdown */}
                          {openColorPicker === course._id && (
                            <div 
                              className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                              ref={(el) => { colorPickerRefs.current[course._id] = el; }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Palette className="h-4 w-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Choose Color</span>
                              </div>
                              <div className="grid grid-cols-5 gap-2 mb-3">
                                {earthyColors.map((color) => (
                                  <button
                                    key={color.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleColorChange(course._id, color.value);
                                    }}
                                    className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                              <hr className="my-2" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenColorPicker(null);
                                  setOpenIconPicker(openIconPicker === course._id ? null : course._id);
                                }}
                                className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                              >
                                <Settings className="h-4 w-4" />
                                <span>Display Icons</span>
                              </button>
                            </div>
                          )}

                          {/* Icon picker dropdown */}
                          {openIconPicker === course._id && (
                            <div 
                              className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                              ref={(el) => { iconPickerRefs.current[course._id] = el; }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Settings className="h-4 w-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Display Icons (Max 3)</span>
                              </div>
                              <div className="space-y-2">
                                {availableIcons.map((iconConfig) => {
                                  const IconComponent = iconConfig.icon;
                                  const isSelected = getCourseIcons(course._id).includes(iconConfig.id);
                                  const isDisabled = !isSelected && getCourseIcons(course._id).length >= 3;
                                  
                                  return (
                                    <button
                                      key={iconConfig.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isDisabled) {
                                          handleIconToggle(course._id, iconConfig.id);
                                        }
                                      }}
                                      className={`flex items-center gap-2 w-full text-left p-2 rounded transition-colors ${
                                        isSelected 
                                          ? 'bg-blue-50 text-blue-700' 
                                          : isDisabled 
                                            ? 'text-gray-400 cursor-not-allowed' 
                                            : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                      disabled={isDisabled}
                                    >
                                      <IconComponent className="h-4 w-4" />
                                      <span className="text-sm">{iconConfig.name}</span>
                                      {isSelected && (
                                        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                          Selected
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <hr className="my-2" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenIconPicker(null);
                                  setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                                }}
                                className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                              >
                                <Palette className="h-4 w-4" />
                                <span>Choose Color</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Bottom section - White */}
                    <div className="p-4 sm:p-6">
                      <div className="mb-2 sm:mb-3">
                        <h2 
                          className="font-bold text-base sm:text-lg mb-1 sm:mb-2 line-clamp-2"
                          style={{ color: getCourseColor(course._id) }}
                        >
                          {course.catalog?.courseCode || course.title}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex items-center line-clamp-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                          Instructor: {course.instructor.firstName} {course.instructor.lastName}
                        </p>
                      </div>
                      
                      {/* Action icons */}
                      <div className="flex justify-between items-center mt-3 sm:mt-4">
                        {getCourseIcons(course._id).map((iconId) => renderActionIcon(iconId, course._id))}
                        {/* Add empty divs to maintain spacing if less than 3 icons */}
                        {Array.from({ length: 3 - getCourseIcons(course._id).length }).map((_, index) => (
                          <div key={index} className="w-9 h-9"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* To-Do Panel: Hidden on mobile, visible on desktop */}
      <aside className="hidden lg:block w-full lg:w-96 flex-shrink-0 order-first lg:order-last">
        <ToDoPanel />
      </aside>
    </div>

    {/* Navigation Customization Modal */}
    <NavCustomizationModal
      isOpen={showNavCustomization}
      onClose={() => {
        setShowNavCustomization(false);
        setShowBurgerMenu(false);
      }}
      onSave={(items) => {
        setCurrentNavItems(items);
      }}
      currentItems={currentNavItems}
    />

    {/* Change User Modal */}
    <ChangeUserModal
      isOpen={showChangeUserModal}
      onClose={() => setShowChangeUserModal(false)}
    />
  </div>
  );
} 