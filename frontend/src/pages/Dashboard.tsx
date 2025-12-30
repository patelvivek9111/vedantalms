import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Settings, Megaphone, FileText, MessageSquare, Palette, BookOpen, MoreHorizontal, Check, Menu, Folder, HelpCircle, User as UserIcon, LogOut, CheckSquare, ChevronDown, ChevronRight, Sun, Moon, Eye, EyeOff, Lock, Smartphone } from 'lucide-react';
import { useCourse } from '../contexts/CourseContext';
import { ToDoPanel } from '../components/ToDoPanel';
import NotificationCenter from '../components/NotificationCenter';
import BottomNav from '../components/BottomNav';
import { ChangeUserModal } from '../components/ChangeUserModal';
import { NavCustomizationModal, ALL_NAV_OPTIONS, DEFAULT_NAV_ITEMS, NavItem } from '../components/NavCustomizationModal';
import { getImageUrl, updateUserProfile, uploadProfilePicture, updatePassword, getLoginActivity } from '../services/api';
import api from '../services/api';
import { getUserPreferences, updateUserPreferences } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import logger from '../utils/logger';

// ColorWheelPicker component (from Calendar)
const ColorWheelPicker: React.FC<{
  colors: string[];
  onSelect: (color: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}> = ({ colors, onSelect, onClose, anchorRef }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // Don't close if clicking on the color wheel itself
      if (pickerRef.current && pickerRef.current.contains(target)) {
        return;
      }
      // Don't close if clicking on the anchor button
      if (anchorRef.current && anchorRef.current.contains(target)) {
        return;
      }
      // Close if clicking anywhere else
      onClose();
    }
    // Use a longer delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }, 200);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [onClose, anchorRef]);

  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (anchorRef.current && pickerRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const wheelSize = 112;
      setStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left - 40,
        zIndex: 9999,
      });
    }
  }, [anchorRef]);

  const radius = 48;
  const center = 56;
  const circleRadius = 14;
  const angleStep = (2 * Math.PI) / colors.length;

  return (
    <div ref={pickerRef} style={style} className="bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 border border-gray-200 dark:border-gray-700">
      <svg width={center * 2} height={center * 2} style={{ display: 'block' }}>
        {colors.map((color, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <circle
              key={color + '-' + i}
              cx={x}
              cy={y}
              r={circleRadius}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
              className="dark:stroke-gray-700"
              style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
              onClick={() => onSelect(color)}
            />
          );
        })}
      </svg>
    </div>
  );
};

// Color palette
const colorPalette = [
  '#556B2F', '#9CAF88', '#E2725B', '#8B4513', '#606C38',
  '#D2691E', '#228B22', '#CD5C5C', '#F4A460', '#654321',
  '#4169E1', '#9370DB', '#FF6347', '#20B2AA', '#FFA500', '#DC143C'
];

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { courses, loading, getCourses } = useCourse();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userCourseColors, setUserCourseColors] = useState<{ [courseId: string]: string }>({});
  const [courseQuickLinks, setCourseQuickLinks] = useState<{ [courseId: string]: ('announcements' | 'pages' | 'discussions' | 'modules')[] }>({});
  const [courseGrades, setCourseGrades] = useState<{ [courseId: string]: number | null }>({});
  const [courseAverages, setCourseAverages] = useState<{ [courseId: string]: number | null }>({}); // For teachers
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<{ [courseId: string]: 'color' | 'icons' | null }>({});
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const [showNavCustomizationModal, setShowNavCustomizationModal] = useState(false);
  const [showGrades, setShowGrades] = useState(true);
  const [currentNavItems, setCurrentNavItems] = useState<NavItem[]>([]);
  const [expandedAccountSection, setExpandedAccountSection] = useState<string | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [profileData, setProfileData] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', bio: user?.bio || '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const [settingsPrefs, setSettingsPrefs] = useState({ theme: 'light', showOnlineStatus: true });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { theme, setTheme } = useTheme();
  const { setUser } = useAuth() as any;

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/notifications/unread-count');
        if (response.data.success) {
          setUnreadCount(response.data.count || 0);
        }
      } catch (error) {
        // Silently fail - notifications are optional
      }
    };
    
    fetchUnreadCount();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch courses when component mounts
  useEffect(() => {
    getCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          
          if (mappedItems.length > 0) {
            setCurrentNavItems(mappedItems);
            return;
          }
        }
      } catch (error) {
        logger.error('Error loading navigation items', error);
      }
      
      // Default items
      const defaultItems = DEFAULT_NAV_ITEMS
        .map(id => ALL_NAV_OPTIONS.find(opt => opt.id === id))
        .filter((item): item is NavItem => item !== undefined);
      setCurrentNavItems(defaultItems);
    };

    loadNavItems();

    // Listen for updates
    const handleNavUpdate = () => {
      loadNavItems();
    };
    window.addEventListener('bottomNavUpdated', handleNavUpdate);
    return () => {
      window.removeEventListener('bottomNavUpdated', handleNavUpdate);
    };
  }, []);


  // Fetch course grades for students
  useEffect(() => {
    const fetchCourseGrades = async () => {
      if (user?.role !== 'student' || !courses.length) return;
      
      const grades: { [courseId: string]: number | null } = {};
      for (const course of courses) {
        try {
          const response = await api.get(`/grades/student/course/${course._id}`);
          if (response.data?.totalPercent !== undefined && response.data.totalPercent !== null) {
            grades[course._id] = response.data.totalPercent;
          } else {
            grades[course._id] = null;
          }
        } catch (error) {
          grades[course._id] = null;
        }
      }
      setCourseGrades(grades);
    };

    if (user?.role === 'student') {
      fetchCourseGrades();
    }
  }, [courses, user?.role]);

  // Fetch course averages for teachers
  useEffect(() => {
    const fetchCourseAverages = async () => {
      if ((user?.role !== 'teacher' && user?.role !== 'admin') || !courses.length) return;
      
      const averages: { [courseId: string]: number | null } = {};
      for (const course of courses) {
        try {
          const response = await api.get(`/grades/course/${course._id}/average`);
          if (response.data?.average !== undefined && response.data.average !== null) {
            averages[course._id] = response.data.average;
          } else {
            averages[course._id] = null;
          }
        } catch (error) {
          averages[course._id] = null;
        }
      }
      setCourseAverages(averages);
    };

    if (user?.role === 'teacher' || user?.role === 'admin') {
      fetchCourseAverages();
    }
  }, [courses, user?.role]);

  // Load user course colors and quick links from preferences
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await getUserPreferences();
        
        if (response.data?.preferences) {
          if (response.data.preferences.courseColors) {
            setUserCourseColors(response.data.preferences.courseColors);
          }
          // Always initialize courseQuickLinks, even if empty
          const quickLinks: { [courseId: string]: ('announcements' | 'pages' | 'discussions' | 'modules')[] } = {};
          const defaultIcons: ('announcements' | 'pages' | 'discussions')[] = ['announcements', 'pages', 'discussions'];
          
          if (response.data.preferences.courseQuickLinks) {
            // Convert old format (single value) to new format (array) if needed
            Object.keys(response.data.preferences.courseQuickLinks).forEach(courseId => {
              const value = response.data.preferences.courseQuickLinks[courseId];
              if (Array.isArray(value)) {
                // Include empty arrays too, so we know the user has interacted with this course
                quickLinks[courseId] = value;
              } else if (value && !Array.isArray(value)) {
                // Old format: single value, convert to array
                quickLinks[courseId] = [value];
              }
            });
          }
          
          // Set default icons for courses that don't have any quick links set
          // Only set defaults if courses are loaded and user hasn't customized them
          if (courses.length > 0) {
            let hasNewDefaults = false;
            courses.forEach(course => {
              // If course doesn't have quick links set (not in preferences at all), set defaults
              if (quickLinks[course._id] === undefined) {
                quickLinks[course._id] = [...defaultIcons];
                hasNewDefaults = true;
              }
            });
            
            // Save defaults if we added any
            if (hasNewDefaults) {
              // Save defaults to preferences
              updateUserPreferences({
                courseQuickLinks: quickLinks,
              }).catch(err => {
                logger.error('Error saving default icons', err);
              });
            }
          }
          
          // Always set the state, even if empty
          setCourseQuickLinks(quickLinks);
        }
      } catch (error) {
        logger.error('Error loading user preferences', error);
      }
    };

    if (user && courses.length > 0) {
      loadUserPreferences();
    }
  }, [user, courses]);

  // Filter courses based on user role
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const publishedCourses = isTeacherOrAdmin 
    ? courses.filter(course => course.published)
    : courses.filter(course => course.published);
  const unpublishedCourses = isTeacherOrAdmin 
    ? courses.filter(course => !course.published)
    : [];
  
  // Debug logging
  console.log('[Dashboard Debug]', {
    isTeacherOrAdmin,
    totalCourses: courses.length,
    publishedCount: publishedCourses.length,
    unpublishedCount: unpublishedCourses.length,
    courses: courses.map(c => ({ id: c._id, title: c.title, published: c.published }))
  });

  // Get course color - priority: user custom color > course defaultColor > palette
  const getCourseColor = (course: any, index: number) => {
    // Check if user has a custom color for this course
    if (userCourseColors[course._id]) {
      return userCourseColors[course._id];
    }
    // Use course's default color if available
    if (course.defaultColor) {
      return course.defaultColor;
    }
    // Fallback to palette
    const colors = [
      '#556B2F', '#9CAF88', '#E2725B', '#8B4513', '#606C38',
      '#D2691E', '#228B22', '#CD5C5C', '#F4A460', '#654321'
    ];
    return colors[index % colors.length];
  };

  const handleColorChange = async (courseId: string, color: string) => {
    setUserCourseColors(prev => ({
      ...prev,
      [courseId]: color,
    }));
    
    // Save to preferences
    try {
      const prefsResponse = await getUserPreferences();
      const currentPrefs = prefsResponse.data?.preferences || {};
      const currentCourseColors = currentPrefs.courseColors || {};
      const updatedCourseColors = {
        ...currentCourseColors,
        [courseId]: color,
      };
      await updateUserPreferences({
        courseColors: updatedCourseColors,
      });
    } catch (error) {
      logger.error('Error saving course color', error);
    }
  };

  const handleQuickLinkSelect = async (e: React.MouseEvent, courseId: string, section: 'announcements' | 'pages' | 'discussions' | 'modules') => {
    e.preventDefault();
    e.stopPropagation();
    
    // Toggle selection - add if not present, remove if present
    // Max 3 icons allowed
    const currentLinks = courseQuickLinks[courseId] || [];
    const isSelected = currentLinks.includes(section);
    
    let newLinks: ('announcements' | 'pages' | 'discussions' | 'modules')[];
    if (isSelected) {
      // Remove if already selected
      newLinks = currentLinks.filter(link => link !== section);
    } else {
      // Add if not selected, but only if less than 3 are selected
      if (currentLinks.length < 3) {
        newLinks = [...currentLinks, section];
      } else {
        // Already at max, don't add
        return;
      }
    }
    
    // Update state immediately for responsive UI
    setCourseQuickLinks(prev => ({
      ...prev,
      [courseId]: newLinks,
    }));
    
    // Save to preferences
    try {
      const prefsResponse = await getUserPreferences();
      const currentPrefs = prefsResponse.data?.preferences || {};
      const currentQuickLinks = currentPrefs.courseQuickLinks || {};
      const updatedQuickLinks = {
        ...currentQuickLinks,
        [courseId]: newLinks, // Always save as array (empty array if no selections)
      };
      
      const response = await updateUserPreferences({
        courseQuickLinks: updatedQuickLinks,
      });
      
      // Verify the save was successful by checking the response
      if (response.data?.preferences?.courseQuickLinks) {
        // Optionally reload preferences to ensure sync, but state is already updated
        const savedQuickLinks: { [courseId: string]: ('announcements' | 'pages' | 'discussions' | 'modules')[] } = {};
        Object.keys(response.data.preferences.courseQuickLinks).forEach(id => {
          const value = response.data.preferences.courseQuickLinks[id];
          if (Array.isArray(value)) {
            savedQuickLinks[id] = value;
          } else if (value && !Array.isArray(value)) {
            savedQuickLinks[id] = [value];
          }
        });
        // Update state with saved values to ensure consistency
        setCourseQuickLinks(prev => ({
          ...prev,
          ...savedQuickLinks,
        }));
      }
    } catch (error) {
      logger.error('Error saving quick link', error);
      // Revert state on error
      setCourseQuickLinks(prev => ({
        ...prev,
        [courseId]: currentLinks, // Revert to previous state
      }));
    }
    
    // Don't close menu - allow multiple selections
  };

  const handleQuickLinkNavigate = (e: React.MouseEvent, courseId: string, section: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/courses/${courseId}/${section}`);
    setOpenMenuId(null);
  };

  const handleMenuToggle = (e: React.MouseEvent, courseId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpening = openMenuId !== courseId;
    setOpenMenuId(isOpening ? courseId : null);
    if (!isOpening) {
      // Reset expanded section when closing menu
      setExpandedSection(prev => {
        const newState = { ...prev };
        delete newState[courseId];
        return newState;
      });
    }
  };

  const handleSectionToggle = (e: React.MouseEvent, courseId: string, section: 'color' | 'icons') => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSection(prev => {
      const current = prev[courseId];
      // If clicking the same section, collapse it. Otherwise, expand the clicked section
      return {
        ...prev,
        [courseId]: current === section ? null : section
      };
    });
  };

  // Close menu when clicking outside (but not color wheel - handled by ColorWheelPicker)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          // Check if click is on color wheel or its button
          const target = event.target as HTMLElement;
          if (!target.closest('.color-wheel-picker') && !target.closest('button[data-color-button]')) {
            setOpenMenuId(null);
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  // Load settings preferences
  useEffect(() => {
    if (expandedAccountSection === 'settings') {
      setSettingsLoading(true);
      getUserPreferences()
        .then(res => {
          if (res.data && res.data.preferences) {
            const preferences = res.data.preferences;
            setSettingsPrefs({
              theme: preferences.theme || theme || 'light',
              showOnlineStatus: preferences.showOnlineStatus !== undefined ? preferences.showOnlineStatus : true
            });
          }
        })
        .catch(() => logger.error('Failed to load preferences'))
        .finally(() => setSettingsLoading(false));
    }
  }, [expandedAccountSection, theme]);

  // Load notification preferences
  useEffect(() => {
    if (expandedAccountSection === 'notifications') {
      setNotificationLoading(true);
      api.get('/notifications/preferences')
        .then(res => {
          if (res.data.success) {
            setNotificationPrefs(res.data.data);
          }
        })
        .catch(() => logger.error('Failed to load notification preferences'))
        .finally(() => setNotificationLoading(false));
    }
  }, [expandedAccountSection]);

  // Load login activity
  useEffect(() => {
    if (expandedAccountSection === 'activity') {
      setActivityLoading(true);
      getLoginActivity(1, 10, 30)
        .then(res => {
          if (res.data.success) {
            setActivities(res.data.data || []);
          }
        })
        .catch(() => logger.error('Failed to load login activity'))
        .finally(() => setActivityLoading(false));
    }
  }, [expandedAccountSection]);

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({ firstName: user.firstName || '', lastName: user.lastName || '', bio: user.bio || '' });
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[160] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </nav>
      
      {/* Burger Menu Sidebar */}
      {showBurgerMenu && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
            onClick={() => setShowBurgerMenu(false)}
          />
          {/* Sidebar Menu - Starts below top nav */}
          <div className="fixed top-[57px] left-0 bottom-0 w-[280px] bg-white dark:bg-gray-800 z-[152] overflow-y-auto shadow-xl">
                {/* Profile Information Header - Clickable to expand Profile section */}
                <button
                  onClick={() => setExpandedAccountSection(expandedAccountSection === 'profile' ? null : 'profile')}
                  className="w-full text-left px-4 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {user?.profilePicture ? (
                        <img
                          src={user.profilePicture.startsWith('http') 
                            ? user.profilePicture 
                            : getImageUrl(user.profilePicture)}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
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
                        className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base font-bold ${
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
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </div>
                    </div>
                    {expandedAccountSection === 'profile' ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Profile Section - Expanded */}
                {expandedAccountSection === 'profile' && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    {profileEditMode ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                          <input
                            type="text"
                            value={profileData.firstName}
                            onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                          <input
                            type="text"
                            value={profileData.lastName}
                            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                          <textarea
                            value={profileData.bio}
                            onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                            placeholder="Tell us about yourself..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setProfileSaving(true);
                              try {
                                const res = await updateUserProfile({ firstName: profileData.firstName, lastName: profileData.lastName, bio: profileData.bio });
                                if (res.data && res.data.user) {
                                  setUser(res.data.user);
                                }
                                setProfileEditMode(false);
                              } catch (err: any) {
                                alert('Failed to update profile: ' + (err.response?.data?.message || err.message || 'Unknown error'));
                              } finally {
                                setProfileSaving(false);
                              }
                            }}
                            disabled={profileSaving}
                            className="flex-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
                          >
                            {profileSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setProfileData({ firstName: user?.firstName || '', lastName: user?.lastName || '', bio: user?.bio || '' });
                              setProfileEditMode(false);
                            }}
                            className="flex-1 px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Profile Picture</label>
                        <label className="block w-full px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs text-center cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600">
                          {profileUploading ? 'Uploading...' : 'Change Picture'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              if (!e.target.files || e.target.files.length === 0) return;
                              setProfileUploading(true);
                              try {
                                const res = await uploadProfilePicture(e.target.files[0]);
                                if (res.data && res.data.user) {
                                  setUser(res.data.user);
                                }
                              } catch (err) {
                                alert('Failed to upload profile picture');
                              } finally {
                                setProfileUploading(false);
                              }
                            }}
                            disabled={profileUploading}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Name:</span> {user?.firstName} {user?.lastName}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Email:</span> {user?.email}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Bio:</span> {user?.bio || <span className="text-gray-400">(not set)</span>}
                        </div>
                        <button
                          onClick={() => setProfileEditMode(true)}
                          className="w-full mt-2 px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                        >
                          Edit Profile
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Options */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      navigate('/account');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <Folder className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Files</span>
                  </button>
                  <button
                    onClick={() => setExpandedAccountSection(expandedAccountSection === 'settings' ? null : 'settings')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      <span>Settings</span>
                    </div>
                    {expandedAccountSection === 'settings' ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>

                {/* Settings Section - Expanded */}
                {expandedAccountSection === 'settings' && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                    {settingsLoading ? (
                      <div className="text-xs text-gray-500">Loading...</div>
                    ) : (
                      <>
                        {/* Theme Selection */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                const newTheme = 'light';
                                setSettingsPrefs({ ...settingsPrefs, theme: newTheme });
                                setTheme(newTheme);
                                updateUserPreferences({ ...settingsPrefs, theme: newTheme }).catch(() => {});
                              }}
                              className={`px-3 py-2 rounded text-xs flex items-center justify-center gap-1 ${
                                settingsPrefs.theme === 'light'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <Sun className="w-3 h-3" />
                              Light
                            </button>
                            <button
                              onClick={() => {
                                const newTheme = 'dark';
                                setSettingsPrefs({ ...settingsPrefs, theme: newTheme });
                                setTheme(newTheme);
                                updateUserPreferences({ ...settingsPrefs, theme: newTheme }).catch(() => {});
                              }}
                              className={`px-3 py-2 rounded text-xs flex items-center justify-center gap-1 ${
                                settingsPrefs.theme === 'dark'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <Moon className="w-3 h-3" />
                              Dark
                            </button>
                          </div>
                        </div>

                        {/* Online Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {settingsPrefs.showOnlineStatus ? (
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            )}
                            <span className="text-xs text-gray-700 dark:text-gray-300">Show Online Status</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settingsPrefs.showOnlineStatus}
                              onChange={(e) => {
                                const updated = { ...settingsPrefs, showOnlineStatus: e.target.checked };
                                setSettingsPrefs(updated);
                                updateUserPreferences(updated).catch(() => {});
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        {/* Change Password */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Change Password</label>
                          {passwordError && (
                            <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs">
                              {passwordError}
                            </div>
                          )}
                          {passwordSuccess && (
                            <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-xs">
                              Password updated!
                            </div>
                          )}
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              setPasswordError(null);
                              setPasswordSuccess(false);
                              if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
                                setPasswordError('All fields required');
                                return;
                              }
                              if (passwordData.newPassword.length < 6) {
                                setPasswordError('Password must be at least 6 characters');
                                return;
                              }
                              if (passwordData.newPassword !== passwordData.confirmPassword) {
                                setPasswordError('Passwords do not match');
                                return;
                              }
                              try {
                                setPasswordSaving(true);
                                await updatePassword(passwordData);
                                setPasswordSuccess(true);
                                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                setTimeout(() => setPasswordSuccess(false), 3000);
                              } catch (err: any) {
                                setPasswordError(err?.response?.data?.message || 'Failed to update password');
                              } finally {
                                setPasswordSaving(false);
                              }
                            }}
                            className="space-y-2"
                          >
                            <input
                              type="password"
                              placeholder="Current Password"
                              value={passwordData.currentPassword}
                              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              required
                            />
                            <input
                              type="password"
                              placeholder="New Password"
                              value={passwordData.newPassword}
                              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              required
                              minLength={6}
                            />
                            <input
                              type="password"
                              placeholder="Confirm Password"
                              value={passwordData.confirmPassword}
                              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              required
                              minLength={6}
                            />
                            <button
                              type="submit"
                              disabled={passwordSaving}
                              className="w-full px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
                            >
                              {passwordSaving ? 'Updating...' : 'Change Password'}
                            </button>
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Notifications Section Button */}
                <div className="py-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setExpandedAccountSection(expandedAccountSection === 'notifications' ? null : 'notifications')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      <span>Notifications</span>
                    </div>
                    {expandedAccountSection === 'notifications' ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>

                {/* Notifications Section - Expanded */}
                {expandedAccountSection === 'notifications' && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
                    {notificationLoading ? (
                      <div className="text-xs text-gray-500">Loading...</div>
                    ) : notificationPrefs ? (
                      <>
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Email Notifications</div>
                        {['Course Activity', 'Messages', 'Account & System'].map((group) => (
                          <div key={group} className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{group}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => {}}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        ))}
                        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                          For detailed notification settings, visit Account page
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">Failed to load preferences</div>
                    )}
                  </div>
                )}

                {/* Activity Section Button */}
                <div className="py-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setExpandedAccountSection(expandedAccountSection === 'activity' ? null : 'activity')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      <span>Recent Activity</span>
                    </div>
                    {expandedAccountSection === 'activity' ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>

                {/* Activity Section - Expanded */}
                {expandedAccountSection === 'activity' && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    {activityLoading ? (
                      <div className="text-xs text-gray-500">Loading...</div>
                    ) : activities.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {activities.slice(0, 5).map((activity: any, index: number) => (
                          <div key={activity._id || index} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {new Date(activity.timestamp).toLocaleDateString()}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                activity.success
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {activity.success ? 'Success' : 'Failed'}
                              </span>
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {activity.ipAddress} • {activity.userAgent?.includes('Mobile') ? 'Mobile' : 'Desktop'}
                            </div>
                          </div>
                        ))}
                        {activities.length > 5 && (
                          <button
                            onClick={() => {
                              setShowBurgerMenu(false);
                              navigate('/account');
                            }}
                            className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View all activity →
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No recent activity</div>
                    )}
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>

                {/* Options Section */}
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    OPTIONS
                  </div>
                  <button
                    onClick={() => setShowGrades(!showGrades)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <CheckSquare className={`h-5 w-5 ${showGrades ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span>Show Grades</span>
                    </div>
                    <div className={`relative w-11 h-6 rounded-full transition-colors ${showGrades ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${showGrades ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      setShowNavCustomizationModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Customize Navigation</span>
                  </button>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>

                {/* Account Actions */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <HelpCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Help</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      setShowChangeUserModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Change User</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}

      <ChangeUserModal
        isOpen={showChangeUserModal}
        onClose={() => setShowChangeUserModal(false)}
      />

      <NavCustomizationModal
        isOpen={showNavCustomizationModal}
        onClose={() => setShowNavCustomizationModal(false)}
        onSave={(items) => {
          setCurrentNavItems(items);
        }}
        currentItems={currentNavItems}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-8 pt-20 lg:pt-8 pb-20 lg:pb-8">
        {/* Header Section - Desktop Only */}
        <div className="hidden lg:flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back, {user?.firstName || 'User'}!
            </p>
          </div>
          {/* Bell Icon - Desktop */}
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Welcome Message - Mobile Only */}
        <div className="mb-6 lg:hidden">
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back, {user?.firstName || 'User'}!
          </p>
        </div>

        {/* Published Courses Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Published Courses {publishedCourses.length > 0 && `(${publishedCourses.length})`}
            </h2>
            {/* Create Course Button - Desktop */}
            {isTeacherOrAdmin && (
              <Link
                to="/courses/create"
                className="hidden lg:block bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors text-sm font-medium"
              >
                Create Course
              </Link>
            )}
          </div>
          
          {/* Create Course Button - Mobile */}
          {isTeacherOrAdmin && (
            <div className="flex justify-center mb-6 lg:hidden">
              <Link
                to="/courses/create"
                className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors text-sm font-medium"
              >
                Create Course
              </Link>
            </div>
          )}

          {/* Desktop: Two Column Layout: Courses on Left, To-Dos on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Courses */}
            <div className="lg:col-span-2 w-full">

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
              </div>
            ) : publishedCourses.length === 0 && unpublishedCourses.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl text-gray-600 dark:text-gray-400 mb-4">
                  {isTeacherOrAdmin ? 'No courses available' : 'No published courses available'}
                </h3>
                {isTeacherOrAdmin && (
                  <Link
                    to="/courses/create"
                    className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors inline-block"
                  >
                    Create Your First Course
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4 lg:space-y-6">
                {/* Published Courses */}
                {publishedCourses.length > 0 && (
                  <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6">
                    {publishedCourses.map((course, index) => {
                        const courseColor = getCourseColor(course, index);
                        const courseCode = course.catalog?.courseCode || course.title?.substring(0, 8).toUpperCase() || 'COURSE';
                        const instructorName = course.instructor && typeof course.instructor === 'object' && course.instructor !== null
                          ? `${(course.instructor as any).firstName || ''} ${(course.instructor as any).lastName || ''}`.trim() || 'N/A'
                          : 'N/A';
                        
                        const courseGrade = courseGrades[course._id];
                        const gradePercentage = courseGrade !== null && courseGrade !== undefined 
                          ? courseGrade.toFixed(2) 
                          : '0.00';
                        
                        return (
                          <div
                            key={course._id}
                            className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden w-full lg:max-w-[240px] lg:mx-auto"
                            style={{ height: '280px' }}
                          >
                            <Link
                              to={`/courses/${course._id}`}
                              onClick={(e) => {
                                // Prevent navigation if clicking on dropdown area
                                if (openMenuId === course._id) {
                                  e.preventDefault();
                                }
                              }}
                              className="block h-full"
                            >
                              {/* Colored Top Section with Menu - 75% of card */}
                              <div 
                                className="w-full relative flex-shrink-0 rounded-t-lg"
                                style={{ backgroundColor: courseColor, height: '60%' }}
                              >
                                {/* Grade Badge - Top Left - Shows for both teachers and students */}
                                {showGrades && (() => {
                                  // For teachers: show course average
                                  if ((user?.role === 'teacher' || user?.role === 'admin') && courseAverages[course._id] !== null && courseAverages[course._id] !== undefined) {
                                    const avg = courseAverages[course._id];
                                    return (
                                      <div className="absolute top-2 left-2 z-10 bg-black/70 dark:bg-gray-900 rounded px-3 py-1.5 flex items-center justify-center">
                                        <span className="text-white text-sm font-semibold">
                                          {avg?.toFixed(2)}%
                                        </span>
                                      </div>
                                    );
                                  }
                                  // For students: show their course grade
                                  if (user?.role === 'student' && courseGrade !== null && courseGrade !== undefined) {
                                    return (
                                      <div className="absolute top-2 left-2 z-10 bg-black/70 dark:bg-gray-900 rounded px-3 py-1.5 flex items-center justify-center">
                                        <span className="text-white text-sm font-semibold">
                                          {gradePercentage}%
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                
                                {/* Three Dots Menu - Top Right */}
                                <div className="absolute top-2 right-2 z-10">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleMenuToggle(e, course._id);
                                    }}
                                    className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                                    title="Course options"
                                  >
                                    <MoreHorizontal className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Bottom Section - Dark Gray Background - 25% of card */}
                              <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 flex flex-col justify-between rounded-b-lg" style={{ height: '40%' }}>
                                <div className="px-4 pt-3">
                                  <p 
                                    className="text-base font-semibold mb-1"
                                    style={{ color: courseColor }}
                                  >
                                    {courseCode}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Instructor: {instructorName}
                                  </p>
                                </div>
                                
                                {/* Quick Link Icons - Bottom of dark section */}
                                {(() => {
                                  const quickLinks = courseQuickLinks[course._id] || [];
                                  
                                  if (quickLinks.length > 0) {
                                    const iconMap = {
                                      announcements: { icon: Megaphone, path: 'announcements' },
                                      modules: { icon: BookOpen, path: 'modules' },
                                      pages: { icon: FileText, path: 'pages' },
                                      discussions: { icon: MessageSquare, path: 'discussions' }
                                    };
                                    
                                    return (
                                      <div className="flex items-center justify-center gap-14 pb-4">
                                        {quickLinks.map((link) => {
                                          const IconComponent = iconMap[link]?.icon;
                                          if (!IconComponent) return null;
                                          
                                          return (
                                            <button
                                              key={link}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleQuickLinkNavigate(e, course._id, iconMap[link].path);
                                              }}
                                              className="text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
                                              title={link.charAt(0).toUpperCase() + link.slice(1)}
                                            >
                                              <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </Link>
                            {/* Dropdown Menu Container */}
                            <div className="absolute top-2 right-2 z-50" ref={(el) => menuRefs.current[course._id] = el} style={{ pointerEvents: 'auto' }}>
                              
                              {/* Dropdown Menu - Updated Style */}
                              {openMenuId === course._id && (
                                <div className="absolute right-0 top-10 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto" style={{ pointerEvents: 'auto' }}>
                                  {/* Choose Color Section - First */}
                                  <div className="p-2.5 border-b border-gray-200 dark:border-gray-700">
                                    <button
                                      onClick={(e) => handleSectionToggle(e, course._id, 'color')}
                                      className="w-full flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors py-1.5 px-2"
                                      style={{ pointerEvents: 'auto' }}
                                    >
                                      <Palette className="w-4 h-4 text-gray-700 dark:text-white" />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">Choose Color</span>
                                      <span className="text-gray-700 dark:text-white text-xs">
                                        {expandedSection[course._id] === 'color' ? '−' : '+'}
                                      </span>
                                    </button>
                                    {expandedSection[course._id] === 'color' && (
                                      <div className="grid grid-cols-5 gap-2 mt-2.5 mb-1">
                                        {colorPalette.slice(0, 10).map((color) => (
                                          <button
                                            key={color}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleColorChange(course._id, color);
                                            }}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                                              getCourseColor(course, 0) === color
                                                ? 'border-blue-400 scale-110 ring-2 ring-blue-300'
                                                : 'border-white/30 hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Display Icons Section - Second */}
                                  <div className="p-2.5 pb-2.5">
                                    <button
                                      onClick={(e) => handleSectionToggle(e, course._id, 'icons')}
                                      className="w-full flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors py-1.5 px-2"
                                      style={{ pointerEvents: 'auto' }}
                                    >
                                      <Settings className="w-4 h-4 text-gray-700 dark:text-white" />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                                        Display Icons (Max 3)
                                      </span>
                                      <span className="text-gray-700 dark:text-white text-xs">
                                        {expandedSection[course._id] === 'icons' ? '−' : '+'}
                                      </span>
                                    </button>
                                    {expandedSection[course._id] === 'icons' && (() => {
                                      const currentLinks = courseQuickLinks[course._id] || [];
                                      return (
                                        <div className="space-y-1 mt-2.5 mb-0">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'announcements');
                                            }}
                                            disabled={!currentLinks.includes('announcements') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('announcements') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Megaphone className={`w-4 h-4 ${currentLinks.includes('announcements') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('announcements') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Announcements
                                              </span>
                                            </div>
                                            {currentLinks.includes('announcements') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'modules');
                                            }}
                                            disabled={!currentLinks.includes('modules') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('modules') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <BookOpen className={`w-4 h-4 ${currentLinks.includes('modules') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('modules') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Modules
                                              </span>
                                            </div>
                                            {currentLinks.includes('modules') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'pages');
                                            }}
                                            disabled={!currentLinks.includes('pages') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('pages') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <FileText className={`w-4 h-4 ${currentLinks.includes('pages') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('pages') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Pages
                                              </span>
                                            </div>
                                            {currentLinks.includes('pages') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'discussions');
                                            }}
                                            disabled={!currentLinks.includes('discussions') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('discussions') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <MessageSquare className={`w-4 h-4 ${currentLinks.includes('discussions') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('discussions') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Discussions
                                              </span>
                                            </div>
                                            {currentLinks.includes('discussions') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                )}

                {/* Unpublished Courses - Only visible to teachers/admins */}
                {isTeacherOrAdmin && unpublishedCourses.length > 0 && (
                  <div className="mt-6 lg:mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Unpublished Courses ({unpublishedCourses.length})
                    </h3>
                    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6">
                      {unpublishedCourses.map((course, index) => {
                        const courseColor = getCourseColor(course, index);
                        const courseCode = course.catalog?.courseCode || course.title?.substring(0, 8).toUpperCase() || 'COURSE';
                        const instructorName = course.instructor && typeof course.instructor === 'object' && course.instructor !== null
                          ? `${(course.instructor as any).firstName || ''} ${(course.instructor as any).lastName || ''}`.trim() || 'N/A'
                          : 'N/A';
                        
                        const courseGrade = courseGrades[course._id];
                        const gradePercentage = courseGrade !== null && courseGrade !== undefined 
                          ? courseGrade.toFixed(2) 
                          : '0.00';
                        
                        return (
                          <div
                            key={course._id}
                            className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden w-full lg:max-w-[240px] lg:mx-auto"
                            style={{ height: '280px' }}
                          >
                            <Link
                              to={`/courses/${course._id}`}
                              onClick={(e) => {
                                // Prevent navigation if clicking on dropdown area
                                if (openMenuId === course._id) {
                                  e.preventDefault();
                                }
                              }}
                              className="block h-full"
                            >
                              {/* Colored Top Section with Menu - 75% of card */}
                              <div 
                                className="w-full relative flex-shrink-0 rounded-t-lg"
                                style={{ backgroundColor: courseColor, height: '60%' }}
                              >
                                {/* Grade Badge - Top Left - Shows for both teachers and students */}
                                {showGrades && (() => {
                                  // For teachers: show course average
                                  if ((user?.role === 'teacher' || user?.role === 'admin') && courseAverages[course._id] !== null && courseAverages[course._id] !== undefined) {
                                    const avg = courseAverages[course._id];
                                    return (
                                      <div className="absolute top-2 left-2 z-10 bg-black/70 dark:bg-gray-900 rounded px-3 py-1.5 flex items-center justify-center">
                                        <span className="text-white text-sm font-semibold">
                                          {avg?.toFixed(2)}%
                                        </span>
                                      </div>
                                    );
                                  }
                                  // For students: show their course grade
                                  if (user?.role === 'student' && courseGrade !== null && courseGrade !== undefined) {
                                    return (
                                      <div className="absolute top-2 left-2 z-10 bg-black/70 dark:bg-gray-900 rounded px-3 py-1.5 flex items-center justify-center">
                                        <span className="text-white text-sm font-semibold">
                                          {gradePercentage}%
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                
                                {/* Three Dots Menu - Top Right */}
                                <div className="absolute top-2 right-2 z-10">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleMenuToggle(e, course._id);
                                    }}
                                    className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                                    title="Course options"
                                  >
                                    <MoreHorizontal className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Bottom Section - Dark Gray Background - 25% of card */}
                              <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 flex flex-col justify-between rounded-b-lg" style={{ height: '40%' }}>
                                <div className="px-4 pt-3">
                                  <p 
                                    className="text-base font-semibold mb-1"
                                    style={{ color: courseColor }}
                                  >
                                    {courseCode}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Instructor: {instructorName}
                                  </p>
                                </div>
                                
                                {/* Quick Link Icons - Bottom of dark section */}
                                {(() => {
                                  const quickLinks = courseQuickLinks[course._id] || [];
                                  
                                  if (quickLinks.length > 0) {
                                    const iconMap = {
                                      announcements: { icon: Megaphone, path: 'announcements' },
                                      modules: { icon: BookOpen, path: 'modules' },
                                      pages: { icon: FileText, path: 'pages' },
                                      discussions: { icon: MessageSquare, path: 'discussions' }
                                    };
                                    
                                    return (
                                      <div className="flex items-center justify-center gap-14 pb-4">
                                        {quickLinks.map((link) => {
                                          const IconComponent = iconMap[link]?.icon;
                                          if (!IconComponent) return null;
                                          
                                          return (
                                            <button
                                              key={link}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleQuickLinkNavigate(e, course._id, iconMap[link].path);
                                              }}
                                              className="text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
                                              title={link.charAt(0).toUpperCase() + link.slice(1)}
                                            >
                                              <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </Link>
                            {/* Dropdown Menu Container */}
                            <div className="absolute top-2 right-2 z-20" ref={(el) => menuRefs.current[course._id] = el}>
                              
                              {/* Dropdown Menu - Updated Style */}
                              {openMenuId === course._id && (
                                <div className="absolute right-0 top-10 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-30 max-h-96 overflow-y-auto" style={{ pointerEvents: 'auto' }}>
                                  {/* Choose Color Section - First */}
                                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                                    <button
                                      onClick={(e) => handleSectionToggle(e, course._id, 'color')}
                                      className="w-full flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors p-1"
                                      style={{ pointerEvents: 'auto' }}
                                    >
                                      <Palette className="w-4 h-4 text-gray-700 dark:text-white" />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">Choose Color</span>
                                      <span className="text-gray-700 dark:text-white text-xs">
                                        {expandedSection[course._id] === 'color' ? '−' : '+'}
                                      </span>
                                    </button>
                                    {expandedSection[course._id] === 'color' && (
                                      <div className="grid grid-cols-5 gap-2 mt-3">
                                        {colorPalette.slice(0, 10).map((color) => (
                                          <button
                                            key={color}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleColorChange(course._id, color);
                                            }}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                                              getCourseColor(course, 0) === color
                                                ? 'border-blue-400 scale-110 ring-2 ring-blue-300'
                                                : 'border-white/30 hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Display Icons Section - Second */}
                                  <div className="p-2.5 pb-2.5">
                                    <button
                                      onClick={(e) => handleSectionToggle(e, course._id, 'icons')}
                                      className="w-full flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors py-1.5 px-2"
                                      style={{ pointerEvents: 'auto' }}
                                    >
                                      <Settings className="w-4 h-4 text-gray-700 dark:text-white" />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                                        Display Icons (Max 3)
                                      </span>
                                      <span className="text-gray-700 dark:text-white text-xs">
                                        {expandedSection[course._id] === 'icons' ? '−' : '+'}
                                      </span>
                                    </button>
                                    {expandedSection[course._id] === 'icons' && (() => {
                                      const currentLinks = courseQuickLinks[course._id] || [];
                                      return (
                                        <div className="space-y-1 mt-2.5">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'announcements');
                                            }}
                                            disabled={!currentLinks.includes('announcements') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('announcements') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Megaphone className={`w-4 h-4 ${currentLinks.includes('announcements') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('announcements') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Announcements
                                              </span>
                                            </div>
                                            {currentLinks.includes('announcements') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'modules');
                                            }}
                                            disabled={!currentLinks.includes('modules') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('modules') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <BookOpen className={`w-4 h-4 ${currentLinks.includes('modules') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('modules') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Modules
                                              </span>
                                            </div>
                                            {currentLinks.includes('modules') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'pages');
                                            }}
                                            disabled={!currentLinks.includes('pages') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('pages') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <FileText className={`w-4 h-4 ${currentLinks.includes('pages') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('pages') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Pages
                                              </span>
                                            </div>
                                            {currentLinks.includes('pages') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleQuickLinkSelect(e, course._id, 'discussions');
                                            }}
                                            disabled={!currentLinks.includes('discussions') && currentLinks.length >= 3}
                                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between rounded transition-colors ${
                                              !currentLinks.includes('discussions') && currentLinks.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <MessageSquare className={`w-4 h-4 ${currentLinks.includes('discussions') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                              <span className={currentLinks.includes('discussions') ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                                                Discussions
                                              </span>
                                            </div>
                                            {currentLinks.includes('discussions') && (
                                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Right Column: To-Dos - Hidden on Mobile */}
            <div className="hidden lg:block lg:col-span-1">
              <ToDoPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={notificationOpen} 
        onClose={() => setNotificationOpen(false)} 
      />

      {/* Bottom Navigation (Mobile Only) */}
      <BottomNav />
    </div>
  );
}

