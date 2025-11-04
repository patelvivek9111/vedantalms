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

  return (
    <nav 
      className="fixed top-0 left-0 h-full bg-blue-900 flex flex-col items-center py-4 z-50 shadow-lg border-r-2 border-blue-700" 
      style={{ width: '80px', minWidth: '80px' }}
      data-testid="global-sidebar"
    >
      <div className="mb-6 flex flex-col items-center">
        {/* Logo placeholder */}
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
          <span className="text-blue-800 text-lg font-bold">LMS</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2 items-center w-full">
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
                className={`flex flex-col items-center w-full py-2 transition-colors ${isActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isActive ? 'text-blue-300' : 'text-white'}`}
              >
                <div className="h-8 w-8 mb-1 rounded-full bg-blue-700 flex items-center justify-center overflow-hidden border-2 border-blue-600">
                  {user?.profilePicture ? (
                    <img 
                      src={user.profilePicture.startsWith('http') 
                        ? user.profilePicture 
                        : getImageUrl(user.profilePicture)} 
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        // Hide image on error, fallback will show
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  {(!user?.profilePicture || !user.profilePicture.trim()) && (
                    <span className="text-white text-sm font-bold">
                      {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{label}</span>
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
                  className={`flex flex-col items-center w-full py-2 transition-colors ${isAdminCoursesActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isAdminCoursesActive ? 'text-blue-300' : 'text-white'}`}
                >
                  <BookOpen className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{label}</span>
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
                  className={`flex flex-col items-center w-full py-2 transition-colors ${isActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isActive ? 'text-blue-300' : 'text-white'}`}
                >
                  <BookOpen className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
                
                {/* Course Dropdown */}
                {showCourseDropdown && (
                  <div 
                    className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    {user?.role === 'teacher' && (
                      <Link
                        to="/teacher/courses"
                        onClick={() => setShowCourseDropdown(false)}
                        className={`block px-3 py-2 text-sm hover:bg-gray-50 transition-colors font-medium ${
                          location.pathname === '/teacher/courses' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>My Courses</span>
                          {location.pathname === '/teacher/courses' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                          )}
                        </div>
                      </Link>
                    )}
                    {user?.role === 'teacher' && availableCourses.length > 0 && (
                      <div className="border-t border-gray-100 my-1"></div>
                    )}
                    {(!user || user.role !== 'teacher') && (
                      <div className="px-3 py-2 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Courses</span>
                      </div>
                    )}
                    {availableCourses.length > 0 ? availableCourses.map((course) => {
                      const isCurrentCourse = location.pathname.startsWith(`/courses/${course._id}`);
                      return (
                        <Link
                          key={course._id}
                          to={`/courses/${course._id}`}
                          onClick={() => setShowCourseDropdown(false)}
                          className={`block px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                            isCurrentCourse ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{course.title}</span>
                            {isCurrentCourse && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                            )}
                          </div>
                        </Link>
                      );
                    }) : user?.role === 'teacher' ? null : (
                      <div className="px-3 py-2 text-sm text-gray-500">No courses available</div>
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
                className={`flex flex-col items-center w-full py-2 transition-colors ${isActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isActive ? 'text-blue-300' : 'text-white'} relative`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 mb-1" />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          }
          
          return (
            <Link
              key={label}
              to={to}
              className={`flex flex-col items-center w-full py-2 transition-colors ${isActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isActive ? 'text-blue-300' : 'text-white'}`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
      
      {/* Logout Button - Always visible at bottom */}
      <div className="mt-2">
        <button
          onClick={handleLogout}
          className="flex flex-col items-center w-full py-2 transition-colors hover:bg-blue-800 text-white"
        >
          <LogOut className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
} 