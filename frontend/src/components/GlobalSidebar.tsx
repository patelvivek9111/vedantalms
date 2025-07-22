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
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';

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

  // Add Groups for non-admin users
  return [...baseItems, { label: 'Groups', icon: Users, to: '/groups' }, { label: 'More', icon: MoreHorizontal, to: '/more' }];
};

export default function GlobalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { courses } = useCourse();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCourseDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
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
        <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center mb-2">
          <span className="text-white text-lg font-bold">UIS</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2 items-center w-full">
        {getNavItems(user?.role || '').map(({ label, icon: Icon, to }) => {
          // Highlight 'Courses' for any /courses* route
          const isActive =
            (to === '/courses' && location.pathname.startsWith('/courses')) ||
            location.pathname === to;
          
          // Special handling for Account item to show profile picture
          if (label === 'Account') {
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center w-full py-2 transition-colors ${isActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isActive ? 'text-blue-300' : 'text-white'}`}
              >
                <div className="h-5 w-5 mb-1 rounded-full bg-blue-700 flex items-center justify-center">
                  {user?.profilePicture ? (
                    <img 
                      src={user.profilePicture} 
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover rounded-full"
                      onError={() => {
                        // Hide image on error, fallback will show
                      }}
                    />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {user?.firstName?.charAt(0) || user?.lastName?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          }
          
          // Special handling for Courses with dropdown
          if (label === 'Courses') {
            return (
              <div 
                key={label} 
                className="relative w-full" 
                ref={dropdownRef}
                onMouseLeave={() => setShowCourseDropdown(false)}
              >
                <button
                  onClick={() => setShowCourseDropdown(!showCourseDropdown)}
                  onMouseEnter={() => setShowCourseDropdown(true)}
                  className={`flex flex-col items-center w-full py-2 transition-colors ${isActive ? 'bg-blue-800' : 'hover:bg-blue-800'} ${isActive ? 'text-blue-300' : 'text-white'}`}
                >
                  <BookOpen className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
                
                {/* Course Dropdown */}
                {showCourseDropdown && availableCourses.length > 0 && (
                  <div 
                    className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50"
                    onMouseEnter={() => setShowCourseDropdown(true)}
                    onMouseLeave={() => setShowCourseDropdown(false)}
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Courses</span>
                    </div>
                    {availableCourses.map((course) => {
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
                          <div className="text-xs text-gray-500 mt-1">
                            {course.instructor?.firstName} {course.instructor?.lastName}
                          </div>
                        </Link>
                      );
                    })}

                  </div>
                )}
              </div>
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