import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  Gauge, 
  BookOpen, 
  Calendar, 
  Inbox, 
  Share2, 
  MoreHorizontal, 
  Users, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  BarChart3,
  Shield,
  Database,
  Search,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { getImageUrl } from '../services/api';

const getNavItems = (userRole: string) => {
  const baseItems = [
    { label: 'Account', icon: User, to: '/account' },
    { label: 'Dashboard', icon: Gauge, to: '/' },
    { label: 'Courses', icon: BookOpen, to: '/courses' },
    { label: 'Calendar', icon: Calendar, to: '/calendar' },
    { label: 'Inbox', icon: Inbox, to: '/inbox' },
  ];

  // Add admin-specific items
  if (userRole === 'admin') {
    return [
      ...baseItems,
      { label: 'Users', icon: Users, to: '/admin/users' },
      { label: 'Settings', icon: Settings, to: '/admin/settings' },
      { label: 'Security', icon: Shield, to: '/admin/security' },
    ];
  }

  // Add teacher-specific items
  if (userRole === 'teacher') {
    return [
      ...baseItems,
      { label: 'Groups', icon: Users, to: '/groups' },
      { label: 'Catalog', icon: Search, to: '/catalog' },
    ];
  }

  // Add Groups, Catalog, and Reports for students
  const studentItems = userRole === 'student' 
    ? [{ label: 'Report', icon: FileText, to: '/reports/transcript' }]
    : [];
  return [...baseItems, { label: 'Groups', icon: Users, to: '/groups' }, { label: 'Catalog', icon: Search, to: '/catalog' }, ...studentItems];
};

export default function GlobalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { courses } = useCourse();
  const { unreadCount } = useUnreadMessages();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCourseDropdown(false);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse enter - show dropdown and clear any pending hide
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowCourseDropdown(true);
  };

  // Handle mouse leave - delay hiding to allow time to move to dropdown
  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowCourseDropdown(false);
      hideTimeoutRef.current = null;
    }, 300); // 300ms delay before hiding
  };

  const handleLogout = () => {
    logout();
    // Clear any cached state and redirect to login
    navigate('/login', { replace: true });
    // Force a page reload to clear any cached component state
    window.location.href = '/login';
  };

  // Filter courses based on user role
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const availableCourses = isTeacherOrAdmin 
    ? courses 
    : courses.filter(course => course.published);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);


  return (
    <>
      {/* Mobile Hamburger Button - Removed for mobile, only show on desktop */}
      {/* Mobile Overlay - Removed since hamburger is removed */}

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <nav 
        className={`hidden lg:flex fixed top-0 left-0 h-full bg-blue-900 dark:bg-gray-900 flex-col items-center py-4 z-50 shadow-lg border-r-2 border-blue-700 dark:border-gray-700 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-20'
        }`}
      data-testid="global-sidebar"
    >
      <div className="mb-6 flex flex-col items-center w-full px-2">
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mb-4 p-1.5 hover:bg-blue-800 dark:hover:bg-gray-800 rounded-lg transition-colors group relative"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-white dark:text-gray-300 transition-transform group-hover:scale-110" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-white dark:text-gray-300 transition-transform group-hover:scale-110" />
          )}
          {isCollapsed && (
            <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {isCollapsed ? 'Expand' : 'Collapse'}
            </div>
          )}
        </button>
        
        {/* Logo placeholder */}
        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center mb-2 border border-blue-700 dark:border-gray-600">
          <span className="text-blue-800 dark:text-blue-300 text-lg font-bold">LMS</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2 items-center w-full px-2">
        {getNavItems(user?.role || '').map(({ label, icon: Icon, to }) => {
          // Highlight 'Courses' for any /courses* route (but not /teacher/courses or /admin/courses)
          const isActive =
            (label === 'Courses' && (location.pathname.startsWith('/courses') || location.pathname === '/teacher/courses') && !location.pathname.startsWith('/admin/courses')) ||
            (location.pathname === to && label !== 'Courses');
          
          // Special handling for Account item to show profile picture
          if (label === 'Account') {
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center w-full py-2 px-2 rounded-lg relative transition-all duration-200 ease-in-out group ${
                  isActive 
                    ? 'bg-blue-800 dark:bg-gray-800 scale-105' 
                    : 'hover:bg-blue-800/70 dark:hover:bg-gray-800/70 hover:scale-105'
                } ${isActive ? 'text-blue-300 dark:text-blue-400' : 'text-white dark:text-gray-300'}`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 dark:bg-blue-400 rounded-r-full" />
                )}
                {/* Active glow effect */}
                {isActive && (
                  <div className="absolute inset-0 bg-blue-400/20 rounded-lg" />
                )}
                <div className="h-8 w-8 mb-1 rounded-full bg-blue-700 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-blue-600 dark:border-gray-600 relative transition-transform group-hover:scale-110">
                  {/* Fallback initials - always present as background */}
                  <span className="text-white dark:text-gray-200 text-sm font-bold absolute inset-0 flex items-center justify-center">
                    {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
                  </span>
                  {/* Profile picture - overlays fallback when loaded */}
                  {user?.profilePicture && (
                    <img 
                      src={user.profilePicture.startsWith('http') 
                        ? user.profilePicture 
                        : getImageUrl(user.profilePicture)} 
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover rounded-full relative z-10"
                      onError={(e) => {
                        // Hide image on error - fallback will show through
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <span className={`text-xs font-medium transition-all ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {label}
                  </div>
                )}
              </Link>
            );
          }
          
          // Special handling for Courses with dropdown (skip hover for admins)
          if (label === 'Courses') {
            // Admins: Simple link to Course Oversight page
            if (user?.role === 'admin') {
              const isAdminCoursesActive = location.pathname === '/admin/courses';
              return (
                <Link
                  key={label}
                  to="/admin/courses"
                  className={`flex flex-col items-center w-full py-2 px-2 rounded-lg relative transition-all duration-200 ease-in-out group ${
                    isAdminCoursesActive 
                      ? 'bg-blue-800 dark:bg-gray-800 scale-105' 
                      : 'hover:bg-blue-800/70 dark:hover:bg-gray-800/70 hover:scale-105'
                  } ${isAdminCoursesActive ? 'text-blue-300 dark:text-blue-400' : 'text-white dark:text-gray-300'}`}
                >
                  {/* Active indicator bar */}
                  {isAdminCoursesActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 dark:bg-blue-400 rounded-r-full" />
                  )}
                  {/* Active glow effect */}
                  {isAdminCoursesActive && (
                    <div className="absolute inset-0 bg-blue-400/20 rounded-lg" />
                  )}
                  <BookOpen className={`h-5 w-5 mb-1 transition-transform ${isAdminCoursesActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className={`text-xs font-medium transition-all ${isAdminCoursesActive ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
                  {/* Tooltip when collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {label}
                    </div>
                  )}
                </Link>
              );
            }
            
            // Non-admin users: Dropdown with hover
            return (
              <div 
                key={label} 
                className="relative w-full" 
                ref={dropdownRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => {
                    if (hideTimeoutRef.current) {
                      clearTimeout(hideTimeoutRef.current);
                      hideTimeoutRef.current = null;
                    }
                    setShowCourseDropdown(!showCourseDropdown);
                  }}
                  className={`flex flex-col items-center w-full py-2 px-2 rounded-lg relative transition-all duration-200 ease-in-out group ${
                    isActive 
                      ? 'bg-blue-800 dark:bg-gray-800 scale-105' 
                      : 'hover:bg-blue-800/70 dark:hover:bg-gray-800/70 hover:scale-105'
                  } ${isActive ? 'text-blue-300 dark:text-blue-400' : 'text-white dark:text-gray-300'}`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 dark:bg-blue-400 rounded-r-full" />
                  )}
                  {/* Active glow effect */}
                  {isActive && (
                    <div className="absolute inset-0 bg-blue-400/20 rounded-lg" />
                  )}
                  <BookOpen className={`h-5 w-5 mb-1 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className={`text-xs font-medium transition-all ${isActive ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
                  {/* Tooltip when collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {label}
                    </div>
                  )}
                </button>
                
                {/* Course Dropdown */}
                {showCourseDropdown && (
                  <div 
                    className="absolute left-full top-0 ml-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-48 w-auto z-50"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    {(!user || user.role !== 'teacher') && (
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Your Courses</span>
                      </div>
                    )}
                    {availableCourses.length > 0 ? availableCourses.map((course) => {
                      const isCurrentCourse = location.pathname.startsWith(`/courses/${course._id}`);
                      const courseCode = course.catalog?.courseCode || course.title;
                      return (
                        <Link
                          key={course._id}
                          to={`/courses/${course._id}`}
                          onClick={() => {
                            setShowCourseDropdown(false);
                          }}
                          className={`block px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            isCurrentCourse ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                          title={course.title}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{courseCode}</span>
                            {isCurrentCourse && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                            )}
                          </div>
                        </Link>
                      );
                    }) : user?.role === 'teacher' ? null : (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No courses available</div>
                    )}
                    {user?.role === 'teacher' && (
                      <>
                        {availableCourses.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        )}
                        <Link
                          to="/teacher/courses"
                          onClick={() => {
                            setShowCourseDropdown(false);
                          }}
                          className={`block px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium ${
                            location.pathname === '/teacher/courses' ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>My Courses</span>
                            {location.pathname === '/teacher/courses' && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                            )}
                          </div>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }
          
          // Special handling for Inbox with unread indicator
          if (label === 'Inbox') {
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center w-full py-2 px-2 rounded-lg relative transition-all duration-200 ease-in-out group ${
                  isActive 
                    ? 'bg-blue-800 dark:bg-gray-800 scale-105' 
                    : 'hover:bg-blue-800/70 dark:hover:bg-gray-800/70 hover:scale-105'
                } ${isActive ? 'text-blue-300 dark:text-blue-400' : 'text-white dark:text-gray-300'}`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 dark:bg-blue-400 rounded-r-full" />
                )}
                {/* Active glow effect */}
                {isActive && (
                  <div className="absolute inset-0 bg-blue-400/20 rounded-lg" />
                )}
                <div className="relative">
                  <Icon className={`h-5 w-5 mb-1 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-medium transition-all ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {label} {unreadCount > 0 && `(${unreadCount})`}
                  </div>
                )}
              </Link>
            );
          }
          
          return (
            <Link
              key={label}
              to={to}
              className={`flex flex-col items-center w-full py-2 px-2 rounded-lg relative transition-all duration-200 ease-in-out group ${
                isActive 
                  ? 'bg-blue-800 dark:bg-gray-800 scale-105' 
                  : 'hover:bg-blue-800/70 dark:hover:bg-gray-800/70 hover:scale-105'
              } ${isActive ? 'text-blue-300 dark:text-blue-400' : 'text-white dark:text-gray-300'}`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 dark:bg-blue-400 rounded-r-full" />
              )}
              {/* Active glow effect */}
              {isActive && (
                <div className="absolute inset-0 bg-blue-400/20 rounded-lg" />
              )}
              <Icon className={`h-5 w-5 mb-1 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className={`text-xs font-medium transition-all ${isActive ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {label}
                </div>
              )}
            </Link>
          );
        })}
      </div>
      
      {/* Logout Button - Always visible at bottom */}
      <div className="mt-2 w-full px-2">
        <button
          onClick={handleLogout}
          className="flex flex-col items-center w-full py-2 px-2 rounded-lg transition-all duration-200 ease-in-out hover:bg-blue-800 dark:hover:bg-gray-800 hover:scale-105 text-white dark:text-gray-300 group"
        >
          <LogOut className="h-5 w-5 mb-1 transition-transform group-hover:scale-110" />
          <span className="text-xs font-medium">{isCollapsed ? '' : 'Logout'}</span>
          {/* Tooltip when collapsed */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Logout
            </div>
          )}
        </button>
      </div>
    </nav>
    </>
  );
} 