import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Settings, Layout, Gamepad2 } from 'lucide-react';
import LatestAnnouncements from '../announcements/LatestAnnouncements';
import ConfirmationModal from '../common/ConfirmationModal';
import CourseEnrollmentQrCard from './CourseEnrollmentQrCard';
import { useCourse } from '../../contexts/CourseContext';
import { toast } from 'react-toastify';
import { fetchGradebookColumnItems } from '../../utils/fetchGradebookColumnItems';

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
  const [gradebookAssignmentCount, setGradebookAssignmentCount] = useState<number | 'loading'>(
    'loading'
  );

  useEffect(() => {
    if (!isInstructor && !isAdmin) return;
    let cancelled = false;
    const run = async () => {
      setGradebookAssignmentCount('loading');
      try {
        const token = localStorage.getItem('token');
        const fallback = modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0);
        if (!token || !course?._id) {
          if (!cancelled) setGradebookAssignmentCount(fallback);
          return;
        }
        const items = await fetchGradebookColumnItems(course._id, modules, token);
        if (!cancelled) setGradebookAssignmentCount(items.length);
      } catch {
        if (!cancelled) {
          setGradebookAssignmentCount(
            modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0)
          );
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isInstructor, isAdmin, course?._id, modules]);

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

  const metricCardClassName =
    'rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80';
  const quickActionClassName =
    'min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:px-4 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
  const primaryActionClassName =
    'min-h-[44px] rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 sm:px-4 sm:text-sm';

  return (
    <div className="space-y-3 sm:space-y-6">
      {(isInstructor || isAdmin) && publishError && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-1.5 rounded mb-2 text-sm font-medium border border-red-200 dark:border-red-800">
          {publishError}
        </div>
      )}
      {/* Course Header */}
      <div className="mb-3 flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-6 md:flex-row md:items-center dark:border-slate-700 dark:bg-slate-900">
        <div className="flex-1 min-w-0">
          <h1 className="mb-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            {course.catalog?.courseCode || course.title}
          </h1>
          <div className="text-xs text-slate-600 sm:text-sm dark:text-slate-300">
            Instructor: {course.instructor?.firstName || ''} {course.instructor?.lastName || ''}
          </div>
        </div>
        {(isInstructor || isAdmin) && (
          <div className="mt-3 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end md:mt-0">
            {/* Publish/Unpublish toggle for teachers/admins only */}
            <button
              onClick={handleToggleCoursePublish}
              disabled={publishingCourse}
              className={`min-h-[42px] inline-flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-medium transition-colors sm:text-sm ${
                course.published
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50'
              } ${publishingCourse ? 'cursor-not-allowed opacity-60' : ''}`}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => navigate(`/courses/${course._id}/edit`)}
                className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Edit Course
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="min-h-[44px] w-full rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 sm:w-auto sm:px-4 sm:text-sm"
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
          <div className={metricCardClassName}>
            <div className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Students</div>
            <div className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {course.students?.length || 0}
            </div>
          </div>
          <div className={metricCardClassName}>
            <div className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Modules</div>
            <div className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {modules.length}
            </div>
          </div>
          <div className={metricCardClassName}>
            <div className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Assignments</div>
            <div className="text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {gradebookAssignmentCount === 'loading' ? (
                <span
                  className="inline-block text-slate-400 animate-pulse dark:text-slate-500"
                  aria-busy="true"
                  aria-label="Loading assignment count"
                >
                  …
                </span>
              ) : (
                gradebookAssignmentCount
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions (teachers/admins only) */}
      {(isInstructor || isAdmin) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">Quick Actions</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            <button
              className={primaryActionClassName}
              onClick={() => navigate(`/courses/${courseId}/modules`)}
            >
              Create Module
            </button>
            <button
              className={quickActionClassName}
              onClick={() => navigate(`/courses/${courseId}/students`)}
            >
              Manage Students
            </button>
            <button
              className={quickActionClassName}
              onClick={() => navigate(`/courses/${courseId}/gradebook`)}
            >
              View Gradebook
            </button>
            <button
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => setShowOverviewConfigModal(true)}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Configure Overview
            </button>
            <button
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => setShowSidebarConfigModal(true)}
            >
              <Layout className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Customize Sidebar
            </button>
            <button
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => setActiveSection('quizwave')}
            >
              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              QuizWave
            </button>
          </div>
        </div>
      )}

      {(isInstructor || isAdmin) && (
        <CourseEnrollmentQrCard courseId={courseId} />
      )}

      {/* Student Quick Actions */}
      {!isInstructor && !isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">Quick Actions</div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
            <button
              className={`${primaryActionClassName} flex items-center justify-center gap-2`}
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

