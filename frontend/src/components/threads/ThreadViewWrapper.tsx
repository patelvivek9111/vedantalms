import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import axios from 'axios';
import { API_URL } from '../../config';
import ThreadView from '../threads/ThreadView';
import Breadcrumb from '../common/Breadcrumb';
import { ArrowLeft } from 'lucide-react';
import { hapticNavigation } from '../../utils/hapticFeedback';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import { useCourseShellMobile } from '../../hooks/useCourseShellMobile';
import MobileNavigation from '../course/MobileNavigation';
import CourseSidebar from '../course/CourseSidebar';

const ThreadViewWrapper: React.FC = () => {
  const { courseId, groupId } = useParams<{
    courseId?: string;
    threadId: string;
    groupId?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { courses } = useCourse();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const isMobileDevice = useCourseShellMobile();

  const { filteredNavigationItems } = useSidebarConfig({ course, user });

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId || courseId === 'undefined' || courseId === 'null') {
        return;
      }

      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get(`${API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success) {
          setCourse(response.data.data);
        } else {
          throw new Error(response.data.message || 'Failed to fetch course');
        }
      } catch (err: any) {
        if (err.response?.status === 400) {
          /* ignore */
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!course || !course._id) {
    return <div>Course not found or invalid course data</div>;
  }

  const cid = course._id;
  const courseLabel = course.catalog?.courseCode || course.title || 'Course';
  const showCourseBreadcrumb = Boolean(courseId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MobileNavigation
        className="print:hidden"
        isMobileDevice={isMobileDevice}
        course={course}
        showCourseDropdown={showCourseDropdown}
        setShowCourseDropdown={setShowCourseDropdown}
        user={user}
        courses={courses}
        courseId={courseId || cid}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {showCourseBreadcrumb && (
        <div className="sticky top-0 z-[35] mx-auto hidden w-full max-w-7xl bg-gray-50 px-4 pt-2 dark:bg-gray-900 lg:block print:hidden">
          <div className="flex flex-col">
            <div className="pb-3">
              <Breadcrumb
                className="mb-0"
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Courses', path: '/courses' },
                  { label: courseLabel, path: `/courses/${courseId}` },
                  { label: 'Discussions', path: `/courses/${courseId}/discussions` },
                  { label: 'Discussion Thread', path: location.pathname },
                ]}
              />
            </div>
            <div className="h-px w-full shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />
            <div className="h-3 shrink-0" aria-hidden />
          </div>
        </div>
      )}

      <div className={`mx-auto flex w-full max-w-7xl print:block ${isMobileDevice ? 'flex-col pt-16' : 'flex-row'}`}>
        {isMobileMenuOpen && isMobileDevice && (
          <div
            className="print:hidden fixed inset-0 z-[90] bg-black bg-opacity-50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ touchAction: 'none', pointerEvents: 'auto' }}
          />
        )}

        <CourseSidebar
          className="print:hidden"
          isMobileDevice={isMobileDevice}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          filteredNavigationItems={filteredNavigationItems}
          activeSection="discussions"
          courseId={cid}
        />

        <div
          className={`w-full flex-1 overflow-visible print:pt-0 lg:overflow-auto ${isMobileMenuOpen && isMobileDevice ? 'overflow-hidden lg:overflow-auto' : ''}`}
        >
          <div className="container mx-auto px-4 pb-6 pt-2 print:px-0 print:py-0 lg:pt-3">
            <div className="mb-3 lg:hidden">
              <button
                type="button"
                onClick={() => {
                  hapticNavigation();
                  navigate(
                    groupId
                      ? `/groups/${groupId}/discussion`
                      : courseId
                        ? `/courses/${courseId}/discussions`
                        : '/dashboard'
                  );
                }}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Go back to discussions"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            </div>
            <ThreadView />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadViewWrapper;
