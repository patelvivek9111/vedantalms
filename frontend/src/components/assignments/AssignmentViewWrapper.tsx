import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import axios from 'axios';
import { API_URL } from '../../config';
import ViewAssignment from './ViewAssignment';
import Breadcrumb from '../common/Breadcrumb';
import MobileNavigation from '../course/MobileNavigation';
import CourseSidebar from '../course/CourseSidebar';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import { useCourseShellMobile } from '../../hooks/useCourseShellMobile';

const AssignmentViewWrapper: React.FC = () => {
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

  const cid = course._id;
  const courseLabel = course.catalog?.courseCode || course.title || 'Course';

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
        courseId={cid}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="sticky top-0 z-[35] mx-auto hidden w-full max-w-7xl bg-gray-50 px-4 pt-2 dark:bg-gray-900 lg:block print:hidden">
        <div className="flex flex-col">
          <div className="pb-3">
            <Breadcrumb
              className="mb-0"
              items={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Courses', path: '/courses' },
                { label: courseLabel, path: `/courses/${cid}` },
                { label: 'Assignments', path: `/courses/${cid}/assignments` },
                { label: 'View Assignment', path: location.pathname },
              ]}
            />
          </div>
          <div className="h-px w-full shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />
          <div className="h-3 shrink-0" aria-hidden />
        </div>
      </div>

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
          activeSection="assignments"
          courseId={cid}
        />

        <div
          className={`w-full flex-1 overflow-auto print:pt-0 ${isMobileMenuOpen && isMobileDevice ? 'overflow-hidden lg:overflow-auto' : ''}`}
        >
          <div className="container mx-auto px-4 pb-6 pt-2 print:px-0 print:py-0 lg:pt-3">
            <ViewAssignment courseId={cid} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentViewWrapper;
