import { useState, useCallback } from 'react';
import api from '../services/api';
import { useCourse } from '../contexts/CourseContext';
import logger from '../utils/logger';

interface UseEnrollmentProps {
  courseId: string | undefined;
  getCourseRef: React.MutableRefObject<(id: string) => Promise<any>>;
  setCourse: (course: any) => void;
}

export const useEnrollment = ({ courseId, getCourseRef, setCourse }: UseEnrollmentProps) => {
  const { enrollStudent, unenrollStudent } = useCourse();
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);

  const handleEnroll = useCallback(async (studentId: string) => {
    if (!courseId) return;
    
    setEnrolling(true);
    setEnrollmentError(null);
    
    try {
      await enrollStudent(courseId, studentId);
      // Refresh course data to show updated student list
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enroll student';
      setEnrollmentError(errorMessage);
      logger.error('Error enrolling student', err);
      return false;
    } finally {
      setEnrolling(false);
    }
  }, [courseId, enrollStudent, getCourseRef, setCourse]);

  const handleUnenroll = useCallback(async (studentId: string) => {
    if (!courseId) return;
    
    setEnrolling(true);
    setEnrollmentError(null);
    
    try {
      await unenrollStudent(courseId, studentId);
      // Refresh course data
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unenroll student';
      setEnrollmentError(errorMessage);
      logger.error('Error unenrolling student', err);
      return false;
    } finally {
      setEnrolling(false);
    }
  }, [courseId, unenrollStudent, getCourseRef, setCourse]);

  const handleApproveEnrollment = useCallback(async (studentId: string) => {
    if (!courseId) return;
    
    setEnrolling(true);
    setEnrollmentError(null);
    
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/approve`);
      // Refresh course data
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve enrollment';
      setEnrollmentError(errorMessage);
      logger.error('Error approving enrollment', err);
      return false;
    } finally {
      setEnrolling(false);
    }
  }, [courseId, getCourseRef, setCourse]);

  const handleDenyEnrollment = useCallback(async (studentId: string) => {
    if (!courseId) return;
    
    setEnrolling(true);
    setEnrollmentError(null);
    
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/deny`);
      // Refresh course data
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deny enrollment';
      setEnrollmentError(errorMessage);
      logger.error('Error denying enrollment', err);
      return false;
    } finally {
      setEnrolling(false);
    }
  }, [courseId, getCourseRef, setCourse]);

  return {
    handleEnroll,
    handleUnenroll,
    handleApproveEnrollment,
    handleDenyEnrollment,
    enrolling,
    enrollmentError,
  };
};

