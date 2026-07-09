import { useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../utils/authToken';
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Assignments-section discussion list (CourseDetail → AssignmentsSection).
 * **Graded discussions only** (`isGraded === true`): this hook backs assignment/gradebook
 * surfaces, not the course Discussions tab (`CourseDiscussions` loads the full list).
 */

interface UseDiscussionsProps {
  course: any;
  setDiscussions: React.Dispatch<React.SetStateAction<any[]>>;
  setDiscussionsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  /** Bump to force a re-fetch (e.g. after grading-period reconciliation). */
  refreshToken?: number;
}

export const useDiscussions = ({
  course,
  setDiscussions,
  setDiscussionsLoading,
  refreshToken = 0,
}: UseDiscussionsProps) => {
  useEffect(() => {
    if (!course?._id) return;
    const fetchDiscussions = async () => {
      setDiscussionsLoading(true);
      try {
        const token = getMemoryAuthToken();
        let threadsRes;
        try {
          threadsRes = await axios.get(
            `${API_URL}/api/threads/course/${course._id}?includeGrades=true`,
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
        } catch (e) {
          threadsRes = await axios.get(
            `${API_URL}/api/threads?course=${course._id}&includeGrades=true`,
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
        }
        const threadsData = threadsRes.data.data || threadsRes.data;
        const threadsArray = Array.isArray(threadsData) ? threadsData : [];
        // Module-scoped threads still store courseId; GET /threads/course/:id returns all course threads.
        // Avoid N parallel GET /threads/module/:moduleId calls (rate limits + load).
        const gradedDiscussions = threadsArray.filter((thread: any) => thread.isGraded);
        setDiscussions(gradedDiscussions);
      } catch (err) {
        setDiscussions([]);
      } finally {
        setDiscussionsLoading(false);
      }
    };
    fetchDiscussions();
  }, [course?._id, setDiscussions, setDiscussionsLoading, refreshToken]);
};





