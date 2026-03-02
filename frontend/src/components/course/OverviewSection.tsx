import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Settings, Layout, Gamepad2 } from 'lucide-react';
import LatestAnnouncements from '../LatestAnnouncements';
import ConfirmationModal from '../common/ConfirmationModal';
import { useCourse } from '../../contexts/CourseContext';
import { toast } from 'react-toastify';

interface OverviewSectionProps {
  course: any;
  modules: any[];
  isInstructor: boolean;
  isAdmin: boolean;
  publishError: string | null;
  publishingCourse: boolean;
  handleToggleCoursePublish: () => void;
  courseId: string;
  setShowOverviewConfigModal: (show: boolean) => void;
  setShowSidebarConfigModal: (show: boolean) => void;
  setActiveSection: (section: string) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  course,
  modules,
  isInstructor,
  isAdmin,
  publishError,
  publishingCourse,
  handleToggleCoursePublish,
  courseId,
  setShowOverviewConfigModal,
  setShowSidebarConfigModal,
  setActiveSection,
}) => {
  const navigate = useNavigate();
  const { deleteCourse } = useCourse();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCourse = async () => {
    setIsDeleting(true);
    try {
      await deleteCourse(courseId);
      toast.success('Course deleted successfully');
      setShowDeleteConfirm(false);
      // Navigate to courses list after successful deletion
      navigate('/courses');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete course');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {(isInstructor || isAdmin) && publishError && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-1.5 rounded mb-2 text-sm font-medium border border-red-200 dark:border-red-800">
          {publishError}
        </div>
      )}
      {/* Course Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow p-3 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-3 sm:mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {course.catalog?.courseCode || course.title}
          </h1>
          <div className="text-xs sm:text-base text-gray-600 dark:text-gray-400">
            Instructor: {course.instructor?.firstName || ''} {course.instructor?.lastName || ''}
          </div>
        </div>
        {(isInstructor || isAdmin) && (
          <div className="flex flex-col w-full sm:w-auto items-stretch sm:items-end mt-3 md:mt-0 gap-2">
            {/* Publish/Unpublish toggle for teachers/admins only */}
            <button
              onClick={handleToggleCoursePublish}
              disabled={publishingCourse}
              className={`min-h-[44px] inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 touch-manipulation active:scale-95 ${course.published ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70'} ${publishingCourse ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {course.published ? (
                <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              ) : (
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              )}
              {publishingCourse
                ? 'Updating...'
                : course.published
                ? 'Unpublish'
                : 'Publish'}
            </button>
            <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
              <button
                onClick={() => navigate(`/courses/${course._id}/edit`)}
                className="min-h-[44px] w-full sm:w-auto px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-lg sm:rounded-md hover:bg-yellow-600 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium"
              >
                Edit Course
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="min-h-[44px] w-full sm:w-auto px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg sm:rounded-md hover:bg-red-600 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium"
                >
                  Delete Course
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Course Overview Cards */}
      {(isInstructor || isAdmin) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-6">
          <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg sm:rounded-xl p-3 sm:p-6 text-center shadow hover:shadow-md transition-shadow">
            <div className="text-sm sm:text-lg font-semibold text-blue-800 dark:text-blue-300 mb-1 sm:mb-3">Students</div>
            <div className="text-3xl sm:text-3xl font-bold text-blue-900 dark:text-blue-200">
              {course.students?.length || 0}
            </div>
          </div>
          <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg sm:rounded-xl p-3 sm:p-6 text-center shadow hover:shadow-md transition-shadow">
            <div className="text-sm sm:text-lg font-semibold text-green-800 dark:text-green-300 mb-1 sm:mb-3">Modules</div>
            <div className="text-3xl sm:text-3xl font-bold text-green-900 dark:text-green-200">
              {modules.length}
            </div>
          </div>
          <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg sm:rounded-xl p-3 sm:p-6 text-center shadow hover:shadow-md transition-shadow">
            <div className="text-sm sm:text-lg font-semibold text-purple-800 dark:text-purple-300 mb-1 sm:mb-3">Assignments</div>
            <div className="text-3xl sm:text-3xl font-bold text-purple-900 dark:text-purple-200">
              {modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions (teachers/admins only) */}
      {(isInstructor || isAdmin) && (
        <div className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-base sm:text-xl font-semibold mb-3 sm:mb-5 text-gray-900 dark:text-gray-100">Quick Actions</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            <button
              className="min-h-[44px] bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:bg-blue-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => navigate(`/courses/${courseId}/modules`)}
            >
              Create Module
            </button>
            <button
              className="min-h-[44px] bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:bg-green-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => navigate(`/courses/${courseId}/students`)}
            >
              Manage Students
            </button>
            <button
              className="min-h-[44px] bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:bg-purple-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => navigate(`/courses/${courseId}/gradebook`)}
            >
              View Gradebook
            </button>
            <button
              className="min-h-[44px] bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:bg-indigo-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => setShowOverviewConfigModal(true)}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Configure Overview
            </button>
            <button
              className="min-h-[44px] bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:bg-orange-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => setShowSidebarConfigModal(true)}
            >
              <Layout className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Customize Sidebar
            </button>
            <button
              className="min-h-[44px] bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:from-blue-700 hover:to-purple-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => setActiveSection('quizwave')}
            >
              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              QuizWave
            </button>
          </div>
        </div>
      )}

      {/* Student Quick Actions */}
      {!isInstructor && !isAdmin && (
        <div className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-base sm:text-xl font-semibold mb-3 sm:mb-5 text-gray-900 dark:text-gray-100">Quick Actions</div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
            <button
              className="min-h-[44px] bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-md hover:from-blue-700 hover:to-purple-700 transition-all touch-manipulation active:scale-95 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => setActiveSection('quizwave')}
            >
              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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

      {/* Delete Course Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteCourse}
        title="Delete Course"
        message={`Are you sure you want to delete "${course.catalog?.courseCode || course.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default OverviewSection;

