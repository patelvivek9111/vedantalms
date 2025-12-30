import { useState, useEffect, useCallback } from 'react';
import { fetchInstructorGradebookData, fetchStudentGradebookData, GradebookData } from '../services/gradebookService';

export interface UseGradebookOptions {
  courseId: string;
  modules: any[];
  course?: any;
  userId?: string;
  isInstructor?: boolean;
  isAdmin?: boolean;
  activeSection?: string;
  refreshTrigger?: number;
}

export interface UseGradebookReturn {
  gradebookData: GradebookData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Custom hook for managing gradebook data
 * Handles fetching and state management for both instructor and student views
 */
export const useGradebook = (options: UseGradebookOptions): UseGradebookReturn => {
  const {
    courseId,
    modules,
    course,
    userId,
    isInstructor,
    isAdmin,
    activeSection,
    refreshTrigger = 0
  } = options;

  const [gradebookData, setGradebookData] = useState<GradebookData>({
    students: [],
    assignments: [],
    grades: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalRefresh, setInternalRefresh] = useState(0);

  const fetchData = useCallback(async () => {
    // Only fetch if gradebook section is active
    if (activeSection !== 'gradebook' && activeSection !== 'grades') {
      return;
    }

    // For gradebook section, only instructors/admins can access
    if (activeSection === 'gradebook' && !isInstructor && !isAdmin) {
      return;
    }

    // For grades section, only students can access
    if (activeSection === 'grades' && (isInstructor || isAdmin)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: GradebookData;

      if (activeSection === 'gradebook' && (isInstructor || isAdmin)) {
        // Instructor/admin view - fetch all students
        data = await fetchInstructorGradebookData({
          courseId,
          modules,
          course,
          isInstructor: !!isInstructor
        });
      } else if (activeSection === 'grades' && userId) {
        // Student view - fetch only current student
        data = await fetchStudentGradebookData({
          courseId,
          modules,
          course,
          userId
        });
      } else {
        // Default empty data
        data = { students: [], assignments: [], grades: {} };
      }

      setGradebookData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch gradebook data');
      setGradebookData({ students: [], assignments: [], grades: {} });
    } finally {
      setLoading(false);
    }
  }, [courseId, modules, course, userId, isInstructor, isAdmin, activeSection]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger, internalRefresh]);

  const refresh = useCallback(() => {
    setInternalRefresh(prev => prev + 1);
  }, []);

  return {
    gradebookData,
    loading,
    error,
    refresh
  };
};

