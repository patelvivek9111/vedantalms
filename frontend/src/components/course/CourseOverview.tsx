import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Settings, Layout, Gamepad2 } from 'lucide-react';
import LatestAnnouncements from '../LatestAnnouncements';

interface CourseOverviewProps {
  course: any;
  modules: any[];
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
    <div className="space-y-4 sm:space-y-6">
      {(isInstructor || isAdmin) && publishError && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 rounded-lg mb-2 font-medium border border-red-200 dark:border-red-800 text-sm sm:text-base">
          {publishError}
        </div>
      )}
      {/* Course Header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center border border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0 mb-3 md:mb-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 break-words">{course.catalog?.courseCode || course.title}</h1>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Instructor: {course.instructor.firstName} {course.instructor.lastName}
          </div>
        </div>
        {(isInstructor || isAdmin) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full sm:w-auto gap-2 sm:gap-2">
            {/* Publish/Unpublish toggle for teachers/admins only */}
            <button
              onClick={handleToggleCoursePublish}
              disabled={publishingCourse}
              className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 ${course.published ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70'} ${publishingCourse ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {course.published ? (
                <Unlock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              ) : (
                <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              )}
              {publishingCourse
                ? 'Updating...'
                : course.published
                ? 'Unpublish'
                : 'Publish'}
            </button>
            <button
              onClick={() => navigate(`/courses/${course._id}/edit`)}
              className="px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-xs sm:text-sm font-medium active:scale-95"
            >
              Edit Course
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this course?')) {
                    // Handle delete
                  }
                }}
                className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-sm font-medium active:scale-95"
              >
                Delete Course
              </button>
            )}
          </div>
        )}
      </div>

      {/* Course Overview Cards */}
      {(isInstructor || isAdmin) && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-lg sm:rounded-xl p-3 sm:p-5 lg:p-6 text-center shadow-lg">
            <div className="text-xs sm:text-sm lg:text-base font-semibold text-white mb-1 sm:mb-2">Students</div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{course.students?.length || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-lg sm:rounded-xl p-3 sm:p-5 lg:p-6 text-center shadow-lg">
            <div className="text-xs sm:text-sm lg:text-base font-semibold text-white mb-1 sm:mb-2">Modules</div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{modules.length}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-lg sm:rounded-xl p-3 sm:p-5 lg:p-6 text-center shadow-lg">
            <div className="text-xs sm:text-sm lg:text-base font-semibold text-white mb-1 sm:mb-2">Assignments</div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0)}</div>
          </div>
        </div>
      )}

      {/* Quick Actions (teachers/admins only) */}
      {(isInstructor || isAdmin) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100 text-sm sm:text-base">Quick Actions</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <button className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium active:scale-95" onClick={() => navigate(`/courses/${courseId}/modules`)}>Create Module</button>
            <button className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium active:scale-95" onClick={() => navigate(`/courses/${courseId}/students`)}>Manage Students</button>
            <button className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm font-medium active:scale-95" onClick={() => navigate(`/courses/${courseId}/gradebook`)}>View Gradebook</button>
            <button 
              className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm font-medium active:scale-95" 
              onClick={() => setShowOverviewConfigModal(true)}
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Configure Overview</span>
              <span className="sm:hidden">Configure</span>
            </button>
            <button 
              className="bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm font-medium active:scale-95" 
              onClick={() => setShowSidebarConfigModal(true)}
            >
              <Layout className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Customize Sidebar</span>
              <span className="sm:hidden">Sidebar</span>
            </button>
            <button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm font-medium active:scale-95" 
              onClick={() => setActiveSection('quizwave')}
            >
              <Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4" />
              QuizWave
            </button>
          </div>
        </div>
      )}

      {/* Student Quick Actions */}
      {!isInstructor && !isAdmin && (
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100 text-sm sm:text-base">Quick Actions</div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm font-medium active:scale-95" 
              onClick={() => setActiveSection('quizwave')}
            >
              <Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4" />
              Join QuizWave
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









