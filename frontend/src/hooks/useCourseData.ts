import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { API_URL } from '../config';
import axios from 'axios';
import logger from '../utils/logger';

interface UseCourseDataProps {
  courseId: string | undefined;
  getCourseRef: React.MutableRefObject<(id: string) => Promise<any>>;
  refetchTrigger?: string; // Optional trigger to refetch (e.g., activeSection)
}

export const useCourseData = ({ courseId, getCourseRef, refetchTrigger }: UseCourseDataProps) => {
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourseAndModulesWithAssignments = useCallback(async () => {
    if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId.trim() === '') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch course data
      const courseData = await getCourseRef.current(courseId);
      setCourse(courseData);

      // Fetch modules for the course
      const token = localStorage.getItem('token');
      const modulesResponse = await api.get(`/modules/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (modulesResponse.data.success) {
        const modulesRaw = modulesResponse.data.data;
        // For each module, fetch its assignments
        const modulesWithAssignments = await Promise.all(
          modulesRaw.map(async (module: any) => {
            try {
              const assignmentsRes = await axios.get(`${API_URL}/api/assignments/module/${module._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              return { ...module, assignments: assignmentsRes.data };
            } catch (err) {
              return { ...module, assignments: [] };
            }
          })
        );
        setModules(modulesWithAssignments);
      }
    } catch (err) {
      logger.error('Error fetching course or modules', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch course data');
    } finally {
      setLoading(false);
    }
  }, [courseId, getCourseRef]);

  // Initial fetch on mount
  useEffect(() => {
    fetchCourseAndModulesWithAssignments();
  }, [fetchCourseAndModulesWithAssignments]);

  // Refetch when trigger changes (e.g., when switching to assignments tab)
  useEffect(() => {
    if (refetchTrigger) {
      fetchCourseAndModulesWithAssignments();
    }
  }, [refetchTrigger, fetchCourseAndModulesWithAssignments]);

  return {
    course,
    modules,
    loading,
    error,
    refetch: fetchCourseAndModulesWithAssignments,
    setCourse, // Allow parent to update course (e.g., after enrollment)
  };
};

