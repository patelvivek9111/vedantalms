import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookOpen } from 'lucide-react';

interface MobileNavigationProps {
  isMobileDevice: boolean;
  course: any;
  showCourseDropdown: boolean;
  setShowCourseDropdown: (show: boolean) => void;
  user: any;
  courses: any[];
  courseId: string;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isMobileDevice,
  course,
  showCourseDropdown,
  setShowCourseDropdown,
  user,
  courses,
  courseId,
  setIsMobileMenuOpen,
}) => {
  const navigate = useNavigate();

  if (!isMobileDevice) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="relative flex items-center justify-between px-4 py-3">
        {/* Course Dropdown */}
        <div className="relative flex-1 max-w-[60%]">
          <button
            onClick={() => setShowCourseDropdown(!showCourseDropdown)}
            className="flex items-center justify-between w-full px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors touch-manipulation"
            aria-label="Select course"
          >
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
              {course?.title || course?.catalog?.courseCode || 'Select Course'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showCourseDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Course Dropdown Menu */}
          {showCourseDropdown && (
            <>
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
                onClick={() => setShowCourseDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-h-[60vh] overflow-y-auto z-[152]">
                {(() => {
                  // Filter courses based on user role
                  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
                  const availableCourses = isTeacherOrAdmin 
                    ? courses 
                    : courses.filter((c: any) => c.published);
                  
                  return availableCourses && availableCourses.length > 0 ? (
                    availableCourses.map((c: any) => (
                      <button
                        key={c._id}
                        onClick={() => {
                          setShowCourseDropdown(false);
                          navigate(`/courses/${c._id}`);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                          c._id === courseId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="font-medium">{c.title || c.catalog?.courseCode}</div>
                        {c.catalog?.courseCode && c.title && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.catalog.courseCode}</div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No courses available</div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
        
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-blue-600 dark:text-blue-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          aria-label="Toggle course menu"
        >
          <BookOpen className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
};

export default MobileNavigation;

