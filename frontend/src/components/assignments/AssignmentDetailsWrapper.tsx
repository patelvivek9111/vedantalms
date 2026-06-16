import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import axios from 'axios';
import { API_URL } from '../../config';
import AssignmentDetails from './AssignmentDetails';
import Breadcrumb from '../common/Breadcrumb';
import BackButton from '../common/BackButton';
import MobileNavigation from '../course/MobileNavigation';
import CourseSidebar from '../course/CourseSidebar';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import { useCourseShellMobile } from '../../hooks/useCourseShellMobile';

const AssignmentDetailsWrapper: React.FC = () => {
  const { id: assignmentId } = useParams<{ id: string }>();
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
    const fetchCourseData = async () => {
      if (!assignmentId) return;

      try {
        const token = localStorage.getItem('token');
        const assignmentRes = await axios.get(`${API_URL}/api/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (assignmentRes.data) {
          const assignment = assignmentRes.data;
          if (assignment.module) {
            const moduleId =
              typeof assignment.module === 'string' ? assignment.module : assignment.module._id;
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
          }
        }
      } catch (err) {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!course) {
    return <div>Course not found</div>;
  }

  return (
    <div className={`mx-auto flex w-full max-w-7xl ${isMobileDevice ? 'flex-col pt-16' : 'flex-row'}`}>
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
        activeSection="assignments"
        courseId={course._id}
      />

      <div
        className={`flex-1 w-full overflow-visible lg:overflow-auto ${isMobileMenuOpen && isMobileDevice ? 'overflow-hidden lg:overflow-auto' : ''}`}
      >
        <div className="container mx-auto px-4 pb-6 pt-2 lg:pt-3">
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
                    label: 'Assignments',
                    path: `/courses/${course._id}/assignments`,
                  },
                  {
                    label: 'Assignment Details',
                    path: location.pathname,
                  },
                ]}
              />
            </div>
          )}
          <AssignmentDetails />
        </div>
      </div>
    </div>
  );
};

export default AssignmentDetailsWrapper;
