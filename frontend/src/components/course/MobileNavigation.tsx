import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ChevronDown } from 'lucide-react';
import { useCourse } from '../../contexts/CourseContext';
import { useAuth } from '../../context/AuthContext';

interface MobileNavigationProps {
  courseTitle: string | undefined;
  user: any;
  isMobileDevice: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  setShowChangeUserModal: (show: boolean) => void;
  logout: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  courseTitle,
  user,
  isMobileDevice,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setShowChangeUserModal,
  logout,
}) => {
  const navigate = useNavigate();
  const { id: currentCourseId } = useParams<{ id: string }>();
  const { courses, getCourses } = useCourse();
  const { user: authUser } = useAuth();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load courses when component mounts
    if (courses.length === 0) {
      getCourses();
    }
  }, [courses.length, getCourses]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCourseDropdown(false);
      }
    };

    if (showCourseDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCourseDropdown]);

  // Filter courses based on user role
  const isTeacherOrAdmin = authUser?.role === 'teacher' || authUser?.role === 'admin';
  const availableCourses = isTeacherOrAdmin 
    ? courses 
    : courses.filter(course => course.published);

  if (!isMobileDevice) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="relative flex items-center justify-center px-4 py-3">
        {/* Spacer for book icon on right */}
        <div className="absolute right-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-blue-600 dark:text-blue-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Toggle course menu"
          >
            <BookOpen className="w-6 h-6" />
          </button>
        </div>
        
        {/* Centered Course Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCourseDropdown(!showCourseDropdown)}
            className="text-lg font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors touch-manipulation px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-1.5"
            aria-label="Switch course"
          >
            <span className="truncate max-w-[150px] sm:max-w-[250px]">{courseTitle || 'Course'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCourseDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Course Dropdown */}
          {showCourseDropdown && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
                onClick={() => setShowCourseDropdown(false)}
              />
              {/* Dropdown Menu */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-[240px] max-h-[320px] overflow-hidden z-[152]">
                {isTeacherOrAdmin && (
                  <button
                    onClick={() => {
                      setShowCourseDropdown(false);
                      // Store current course ID before navigating
                      if (currentCourseId) {
                        localStorage.setItem('previousCourseId', currentCourseId);
                      }
                      navigate(authUser?.role === 'admin' ? '/admin/courses' : '/teacher/courses');
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30 transition-colors border-b border-gray-200 dark:border-gray-700"
                  >
                    My Courses
                  </button>
                )}
                <div className="max-h-[240px] overflow-y-auto">
                  {availableCourses.length > 0 ? (
                    availableCourses.map((course) => {
                      const isCurrentCourse = currentCourseId === course._id;
                      const courseCode = course.catalog?.courseCode || course.title;
                      return (
                        <button
                          key={course._id}
                          onClick={() => {
                            setShowCourseDropdown(false);
                            // Clear previous course ID when switching to a different course
                            localStorage.removeItem('previousCourseId');
                            navigate(`/courses/${course._id}`);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between active:scale-[0.98] ${
                            isCurrentCourse
                              ? 'bg-blue-600 dark:bg-blue-700 text-white font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-600'
                          }`}
                        >
                          <span className="truncate flex-1 pr-2">{courseCode}</span>
                          {isCurrentCourse && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></div>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                      No courses available
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowCourseDropdown(false);
                      navigate('/dashboard');
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30 transition-colors"
                  >
                    View All Courses
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default MobileNavigation;

