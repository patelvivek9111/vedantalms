import React from 'react';
import { useNavigate } from 'react-router-dom';
import LatestAnnouncements from '../LatestAnnouncements';

interface CourseOverviewProps {
  course: {
    _id: string;
    title: string;
    catalog?: {
      courseCode?: string;
    };
    instructor?: {
      firstName?: string;
      lastName?: string;
    };
    published?: boolean;
    students?: any[];
    overviewConfig?: {
      showLatestAnnouncements?: boolean;
      numberOfAnnouncements?: number;
    };
  };
  modules: Array<{
    _id: string;
    title?: string;
    assignments?: any[];
  }>;
  courseId: string;
  isInstructor: boolean;
  isAdmin: boolean;
  publishingCourse: boolean;
  publishError: string | null;
  handleToggleCoursePublish: () => void;
  setShowOverviewConfigModal: (show: boolean) => void;
  setShowSidebarConfigModal: (show: boolean) => void;
  setActiveSection: (section: string) => void;
}

const CourseOverview: React.FC<CourseOverviewProps> = ({
  course,
  modules,
  courseId,
  isInstructor,
  isAdmin,
  publishingCourse,
  publishError,
  handleToggleCoursePublish,
  setShowOverviewConfigModal,
  setShowSidebarConfigModal,
  setActiveSection,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {publishError && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-2 rounded mb-2 font-medium border border-red-200 dark:border-red-800">
          {publishError}
        </div>
      )}
      
      {/* Course Header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {course.catalog?.courseCode || course.title}
          </h1>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Instructor: {course.instructor?.firstName || ''} {course.instructor?.lastName || ''}
          </div>
        </div>
        {(isInstructor || isAdmin) && (
          <div className="flex flex-col items-end mt-4 md:mt-0 gap-2">
            <button
              onClick={handleToggleCoursePublish}
              disabled={publishingCourse}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                publishingCourse ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {publishingCourse ? 'Updating...' : course.published ? 'Unpublish' : 'Publish'}
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this course?')) {
                    // Handle delete
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Delete Course
              </button>
            )}
          </div>
        )}
      </div>

      {/* Course Overview Cards */}
      {(isInstructor || isAdmin) && (
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 text-center shadow">
            <div className="text-lg font-semibold text-blue-800 dark:text-blue-300">Students</div>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-200">{course.students?.length || 0}</div>
          </div>
          <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center shadow">
            <div className="text-lg font-semibold text-green-800 dark:text-green-300">Modules</div>
            <div className="text-3xl font-bold text-green-900 dark:text-green-200">{modules.length}</div>
          </div>
          <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 text-center shadow">
            <div className="text-lg font-semibold text-purple-800 dark:text-purple-300">Assignments</div>
            <div className="text-3xl font-bold text-purple-900 dark:text-purple-200">
              {modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions (teachers/admins only) */}
      {(isInstructor || isAdmin) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Actions</div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              onClick={() => navigate(`/courses/${courseId}/modules`)}
            >
              Create Module
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              onClick={() => navigate(`/courses/${courseId}/students`)}
            >
              Manage Students
            </button>
            <button
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
              onClick={() => navigate(`/courses/${courseId}/gradebook`)}
            >
              View Gradebook
            </button>
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
              onClick={() => setShowOverviewConfigModal(true)}
            >
              Configure Overview
            </button>
            <button
              className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
              onClick={() => setShowSidebarConfigModal(true)}
            >
              Customize Sidebar
            </button>
          </div>
        </div>
      )}

      {/* Student View - Latest Announcements */}
      {!isInstructor && !isAdmin && course.overviewConfig?.showLatestAnnouncements && (
        <LatestAnnouncements
          courseId={course._id}
          numberOfAnnouncements={course.overviewConfig.numberOfAnnouncements || 3}
        />
      )}
    </div>
  );
};

export default CourseOverview;





