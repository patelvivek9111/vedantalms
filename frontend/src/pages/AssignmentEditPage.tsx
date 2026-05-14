import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreateAssignmentForm from '../components/assignments/CreateAssignmentForm';
import { ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import Breadcrumb from '../components/common/Breadcrumb';
import { hapticNavigation } from '../utils/hapticFeedback';

const AssignmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [course, setCourse] = useState<any>(null);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!id) return;

      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/assignments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data) {
          const assignment = response.data.data || response.data;
          setAssignment(assignment);

          if (assignment.module) {
            const modId =
              typeof assignment.module === 'string' ? assignment.module : assignment.module._id;
            setModuleId(modId);

            const moduleRes = await axios.get(`${API_URL}/api/modules/view/${modId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (moduleRes.data.success) {
              const courseId = moduleRes.data.data.course._id || moduleRes.data.data.course;
              const courseRes = await axios.get(`${API_URL}/api/courses/${courseId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              if (courseRes.data.success) {
                setCourse(courseRes.data.data);
              }
            }
          }
        } else {
          setError('Failed to load assignment data');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading assignment');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-3 sm:p-4 lg:p-6">
        <div
          className="relative rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:px-4 sm:py-3 sm:text-base"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div
          className="relative rounded-lg border border-yellow-400 bg-yellow-100 px-4 py-3 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
          role="alert"
        >
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don&apos;t have permission to edit assignments.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!moduleId) {
    return (
      <div className="mx-auto max-w-4xl p-3 sm:p-4 lg:p-6">
        <div
          className="relative rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:px-4 sm:py-3 sm:text-base"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">Could not determine module for this assignment.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const courseLabel = course?.catalog?.courseCode || course?.title || 'Course';
  const isQuiz = Boolean(assignment?.isGradedQuiz);
  const sectionLabel = isQuiz ? 'Quizzes' : 'Assignments';
  const sectionPath = isQuiz ? 'quizzes' : 'assignments';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="safe-area-inset-top fixed left-0 right-0 top-0 z-[150] border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:hidden">
        <div className="relative flex items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              hapticNavigation();
              navigate(course?._id ? `/courses/${course._id}/${sectionPath}` : '/dashboard');
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 touch-manipulation dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="flex-1 truncate px-2 text-center text-lg font-semibold text-gray-800 dark:text-gray-100">
            {isQuiz ? 'Edit quiz' : 'Edit assignment'}
          </h1>
          <div className="w-10 shrink-0" aria-hidden />
        </div>
      </nav>

      {course && assignment && (
        <div className="sticky top-0 z-[35] hidden w-full border-b border-gray-200/80 bg-gray-50/95 px-4 pt-3 backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-900/95 lg:block print:hidden">
          <div className="mx-auto max-w-4xl pb-3">
            <Breadcrumb
              className="mb-0"
              lastItemClassName="max-w-[min(100%,20rem)] min-w-0 shrink truncate"
              lastItemTitle={assignment.title || undefined}
              items={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Courses', path: '/courses' },
                { label: courseLabel, path: `/courses/${course._id}` },
                {
                  label: sectionLabel,
                  path: `/courses/${course._id}/${sectionPath}`,
                },
                {
                  label: assignment.title || (isQuiz ? 'Quiz' : 'Assignment'),
                  path: location.pathname,
                },
              ]}
            />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 pb-10 pt-16 lg:px-6 lg:pb-12 lg:pt-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {sectionLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {isQuiz ? 'Edit quiz' : 'Edit assignment'}
          </h1>
        </header>

        <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <CreateAssignmentForm
            moduleId={moduleId}
            editMode
            assignmentData={assignment}
            layout="embedded"
          />
        </div>
      </div>
    </div>
  );
};

export default AssignmentEditPage;
