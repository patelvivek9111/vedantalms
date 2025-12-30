import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

const CourseList: React.FC = () => {
  const { courses, loading, error, deleteCourse, getCourses } = useCourse();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch courses when component mounts
  useEffect(() => {
    getCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await deleteCourse(id);
      } catch (err) {
        logger.error('Error deleting course', err);
      }
    }
  };

  // Auto-redirect to first course if available (only when on /courses route)
  useEffect(() => {
    // Only auto-redirect when we're on the /courses route, not when embedded elsewhere
    if (location.pathname === '/courses' && !loading && courses && courses.length > 0) {
      // Filter published courses for students, all courses for teachers/admins
      const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
      const availableCourses = isTeacherOrAdmin 
        ? courses 
        : courses.filter(course => course.published);
      
      if (availableCourses.length > 0) {
        // Redirect to the first available course
        navigate(`/courses/${availableCourses[0]._id}`);
      }
    }
  }, [courses, loading, user, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-center p-4">
        {error}
      </div>
    );
  }

  // If no courses available, show a message
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const availableCourses = isTeacherOrAdmin 
    ? courses 
    : courses.filter(course => course.published);

  if (availableCourses.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Courses</h1>
        </div>
        <div className="text-center py-12">
          <h2 className="text-xl text-gray-600 dark:text-gray-400 mb-4">
            {isTeacherOrAdmin ? 'No courses available' : 'No published courses available'}
          </h2>
          {isTeacherOrAdmin && (
            <Link
              to="/courses/create"
              className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
            >
              Create Your First Course
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Courses</h1>
      </div>
      {/* Auto-redirecting to first course... */}
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting to your course...</p>
      </div>
    </div>
  );
};

export default CourseList; 