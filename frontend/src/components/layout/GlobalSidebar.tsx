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
  LogOut,
  Settings,
  BarChart3,
  Shield,
  Database,
  Search,
  FileText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { getImageUrl } from '../../services/api';

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

/** Shared nav tile + active rail for a calmer, modern sidebar selection state */
const sidebarNavBase =
  'flex flex-col items-center w-full py-1.5 px-1 rounded-xl relative transition-[color,background-color,box-shadow,transform] duration-200 ease-out group outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900 dark:focus-visible:ring-offset-gray-900';

const sidebarNavInactive =
  'text-blue-100/85 dark:text-gray-400 hover:bg-white/[0.08] dark:hover:bg-white/[0.06] hover:text-white dark:hover:text-gray-100';

const sidebarNavActive =
  'text-white dark:text-gray-50 bg-white/[0.12] dark:bg-white/[0.08] ring-1 ring-inset ring-white/15 dark:ring-white/10 shadow-sm';

function SidebarActiveRail({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="pointer-events-none absolute left-0.5 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-sky-200 to-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.45)] dark:from-sky-300 dark:to-sky-500 dark:shadow-[0_0_12px_rgba(56,189,248,0.35)]"
      aria-hidden
    />
  );
}

export default function GlobalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { courses } = useCourse();
  const { unreadCount } = useUnreadMessages();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
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

  const availableCourses = courses.filter((course) => course.published);


  return (
    <>
      {/* Mobile Hamburger Button - Removed for mobile, only show on desktop */}
      {/* Mobile Overlay - Removed since hamburger is removed */}

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <nav 
        className="print:hidden hidden lg:flex fixed top-0 left-0 h-[100dvh] bg-blue-900 dark:bg-gray-900 flex-col items-center py-2 z-50 shadow-lg border-r-2 border-blue-700 dark:border-gray-700 transition-all duration-300 w-20 overflow-visible"
        data-testid="global-sidebar"
      >
      <div className="mb-3 flex flex-col items-center w-full px-2 shrink-0">
        {/* Logo placeholder */}
        <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-blue-700 dark:border-gray-600">
          <span className="text-blue-800 dark:text-blue-300 text-lg font-bold">LMS</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-visible flex flex-col gap-1 items-center w-full px-2">
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
                className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
              >
                <SidebarActiveRail show={isActive} />
                <div className="relative mb-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-blue-800/80 dark:border-gray-600 dark:bg-gray-700 transition-transform duration-200 group-hover:border-white/30">
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
                <span className={`text-[11px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
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
                  className={`${sidebarNavBase} ${isAdminCoursesActive ? sidebarNavActive : sidebarNavInactive}`}
                >
                  <SidebarActiveRail show={isAdminCoursesActive} />
                  <BookOpen className={`mb-1 h-5 w-5 transition-opacity duration-200 ${isAdminCoursesActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                  <span className={`text-[11px] font-medium leading-tight tracking-tight ${isAdminCoursesActive ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
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
                  type="button"
                  onClick={() => {
                    if (hideTimeoutRef.current) {
                      clearTimeout(hideTimeoutRef.current);
                      hideTimeoutRef.current = null;
                    }
                    setShowCourseDropdown(!showCourseDropdown);
                  }}
                  className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
                >
                  <SidebarActiveRail show={isActive} />
                  <BookOpen className={`mb-1 h-5 w-5 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                  <span className={`text-[11px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
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
                className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
              >
                <SidebarActiveRail show={isActive} />
                <div className="relative">
                  <Icon className={`mb-1 h-5 w-5 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </Link>
            );
          }
          
          return (
            <Link
              key={label}
              to={to}
              className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
            >
              <SidebarActiveRail show={isActive} />
              <Icon className={`mb-1 h-5 w-5 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
              <span className={`text-[11px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      
      {/* Logout Button - Always visible at bottom */}
      <div className="mt-1 w-full px-2 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full flex-col items-center rounded-xl px-1 py-2 text-blue-100/85 transition-colors duration-200 hover:bg-white/[0.08] hover:text-white dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
        >
          <LogOut className="mb-1 h-5 w-5 opacity-90 transition-opacity group-hover:opacity-100" />
          <span className="text-[11px] font-medium leading-tight tracking-tight">Logout</span>
        </button>
      </div>
    </nav>
    </>
  );
} 