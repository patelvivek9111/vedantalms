import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import axios from 'axios';
import { API_URL } from '../../config';
import CreateAssignmentForm from './CreateAssignmentForm';
import Breadcrumb from '../common/Breadcrumb';
import BackButton from '../common/BackButton';
import MobileNavigation from '../course/MobileNavigation';
import CourseSidebar from '../course/CourseSidebar';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import { useCourseShellMobile } from '../../hooks/useCourseShellMobile';

const CreateAssignmentWrapper: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { courses } = useCourse();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const isMobileDevice = useCourseShellMobile();

  const { filteredNavigationItems } = useSidebarConfig({ course, user });

  const isGradedQuiz = searchParams.get('isGradedQuiz') === 'true';
  const activeSection = isGradedQuiz ? 'quizzes' : 'assignments';

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!moduleId) return;

      try {
        const token = localStorage.getItem('token');
        const moduleRes = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
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
      } catch (err) {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [moduleId]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!course || !moduleId) {
    return <div>Course or module not found</div>;
  }

  return (
    <div className={`mx-auto flex w-full max-w-7xl ${isMobileDevice ? 'flex-col pt-20' : 'flex-row'}`}>
      <MobileNavigation
        isMobileDevice={isMobileDevice}
        course={course}
        showCourseDropdown={showCourseDropdown}
        setShowCourseDropdown={setShowCourseDropdown}
        user={user}
        courses={courses}
        courseId={course._id}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {isMobileMenuOpen && isMobileDevice && (
        <div
          className="fixed inset-0 z-[90] bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <CourseSidebar
        isMobileDevice={isMobileDevice}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        filteredNavigationItems={filteredNavigationItems}
        activeSection={activeSection}
        courseId={course._id}
      />

      <div
        className={`flex-1 w-full overflow-visible lg:overflow-auto ${isMobileMenuOpen && isMobileDevice ? 'overflow-hidden lg:overflow-auto' : ''}`}
      >
        <div className="container mx-auto overflow-x-hidden px-4 pb-6 pt-2 lg:pt-3">
          <div className="mb-3 lg:hidden">
            <BackButton
              fallbackPath={course?._id ? `/courses/${course._id}/assignments` : '/dashboard'}
              alwaysShow
              className="inline-flex"
              ariaLabel="Go back to assignments"
            />
          </div>
          {course && (
            <div className="mb-4 hidden lg:block">
              <Breadcrumb
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Courses', path: '/courses' },
                  {
                    label: course.catalog?.courseCode || course.title || 'Course',
                    path: `/courses/${course._id}`,
                  },
                  {
                    label: isGradedQuiz ? 'Quizzes' : 'Assignments',
                    path: `/courses/${course._id}/${isGradedQuiz ? 'quizzes' : 'assignments'}`,
                  },
                  {
                    label: isGradedQuiz ? 'Create Quiz' : 'Create Assignment',
                    path: location.pathname,
                  },
                ]}
              />
            </div>
          )}
          <CreateAssignmentForm moduleId={moduleId} />
        </div>
      </div>
    </div>
  );
};

export default CreateAssignmentWrapper;
