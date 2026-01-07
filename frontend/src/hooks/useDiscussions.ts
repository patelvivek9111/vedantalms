import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseDiscussionsProps {
  course: any;
  modules: any[];
  setDiscussions: React.Dispatch<React.SetStateAction<any[]>>;
  setDiscussionsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useDiscussions = ({
  course,
  modules,
  setDiscussions,
  setDiscussionsLoading,
}: UseDiscussionsProps) => {
  useEffect(() => {
    if (!course?._id) return;
    const fetchDiscussions = async () => {
      setDiscussionsLoading(true);
      try {
        const token = localStorage.getItem('token');
        let threadsRes;
        try {
          threadsRes = await axios.get(`${API_URL}/api/threads/course/${course._id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        } catch (e) {
          threadsRes = await axios.get(`${API_URL}/api/threads?course=${course._id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        }
        const threadsData = threadsRes.data.data || threadsRes.data;
        const threadsArray = Array.isArray(threadsData) ? threadsData : [];
        let gradedDiscussions = threadsArray.filter((thread: any) => thread.isGraded);

        // Fetch module-level graded discussions and merge
        if (modules.length > 0) {
          const moduleDiscussionsArrays = await Promise.all(
            modules.map(async (module: any) => {
              try {
                const res = await axios.get(`${API_URL}/api/threads/module/${module._id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
                const moduleThreadsData = res.data.data || res.data;
                const moduleThreadsArray = Array.isArray(moduleThreadsData) ? moduleThreadsData : [];
                return moduleThreadsArray.filter((thread: any) => thread.isGraded);
              } catch (err) {
                return [];
              }
            })
          );
          const moduleDiscussions = moduleDiscussionsArrays.flat();
          // Merge and deduplicate by _id
          const allDiscussionsMap = new Map();
          [...gradedDiscussions, ...moduleDiscussions].forEach(d => allDiscussionsMap.set(d._id, d));
          gradedDiscussions = Array.from(allDiscussionsMap.values());
        }
        setDiscussions(gradedDiscussions);
      } catch (err) {
        setDiscussions([]);
      } finally {
        setDiscussionsLoading(false);
      }
    };
    fetchDiscussions();
  }, [course?._id, modules, setDiscussions, setDiscussionsLoading]);
};





