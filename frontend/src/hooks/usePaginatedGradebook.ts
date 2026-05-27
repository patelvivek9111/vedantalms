import { useEffect, useState } from 'react';
import api from '../services/api';

interface UsePaginatedGradebookProps {
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  courseId?: string;
  page?: number;
  pageSize?: number;
  refresh: number;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
  setSubmissionMap: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  setGradebookLoading?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePaginatedGradebook({
  activeSection,
  isInstructor,
  isAdmin,
  courseId,
  page = 1,
  pageSize = 100,
  refresh,
  setGradebookData,
  setSubmissionMap,
  setGradebookLoading,
}: UsePaginatedGradebookProps) {
  const [pagination, setPagination] = useState<any>(null);
  const [cellMeta, setCellMeta] = useState<any>({});

  useEffect(() => {
    let cancelled = false;

    async function loadGradebookPage() {
      if (activeSection !== 'gradebook' || (!isInstructor && !isAdmin) || !courseId) {
        setGradebookLoading?.(false);
        return;
      }

      setGradebookLoading?.(true);
      try {
        const res = await api.get(`/grades/course/${courseId}/gradebook`, {
          params: { page, pageSize },
        });
        const data = res.data?.data;
        if (!data || cancelled) return;
        setGradebookData({
          students: data.students || [],
          assignments: data.assignments || [],
          grades: data.grades || {},
        });
        setSubmissionMap(data.submissionMap || {});
        setPagination(data.pagination || null);
        setCellMeta(data.cellMeta || {});
      } catch {
        if (!cancelled) {
          setGradebookData({ students: [], assignments: [], grades: {} });
          setSubmissionMap({});
          setPagination(null);
          setCellMeta({});
        }
      } finally {
        if (!cancelled) setGradebookLoading?.(false);
      }
    }

    void loadGradebookPage();
    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    isInstructor,
    isAdmin,
    courseId,
    page,
    pageSize,
    refresh,
    setGradebookData,
    setSubmissionMap,
    setGradebookLoading,
  ]);

  return { pagination, cellMeta };
}
