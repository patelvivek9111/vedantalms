import { useEffect, useState } from 'react';
import api from '../services/api';

export type GradebookPolicyMeta = {
  missingAssignmentMode?: 'count_as_zero' | 'exclude_until_graded';
  applyMode?: string;
  hasLegacyPolicy?: boolean;
  policyVersion?: number;
  policyHash?: string;
};

interface UsePaginatedGradebookProps {
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  courseId?: string;
  page?: number;
  pageSize?: number;
  refresh: number;
  /** When set, gradebook columns + totals are scoped to that grading period. */
  gradingPeriodId?: string;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
  setSubmissionMap: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  setGradebookLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  setStudentTotals?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setStudentFinalTotals?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setGradeOverrides?: React.Dispatch<
    React.SetStateAction<Record<string, { finalPercent: number; letterGrade?: string; reason?: string }>>
  >;
  setReleasedTotals?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPolicyMeta?: React.Dispatch<React.SetStateAction<GradebookPolicyMeta | null>>;
}

export function usePaginatedGradebook({
  activeSection,
  isInstructor,
  isAdmin,
  courseId,
  page = 1,
  pageSize = 100,
  refresh,
  gradingPeriodId,
  setGradebookData,
  setSubmissionMap,
  setGradebookLoading,
  setStudentTotals,
  setReleasedTotals,
  setPolicyMeta,
  setStudentFinalTotals,
  setGradeOverrides,
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
          params: { page, pageSize, ...(gradingPeriodId ? { gradingPeriodId } : {}) },
        });
        const data = res.data?.data;
        if (!data || cancelled) return;
        setGradebookData({
          students: data.students || [],
          assignments: data.assignments || [],
          grades: data.grades || {},
        });
        setSubmissionMap(data.submissionMap || {});
        // Overall column must match GET /api/grades/student/course/:id (student visibility).
        setStudentTotals?.(data.studentTotals || data.releasedTotals || data.instructorTotals || {});
        setStudentFinalTotals?.(data.studentFinalTotals || {});
        setGradeOverrides?.(data.gradeOverrides || {});
        setReleasedTotals?.(data.releasedTotals || data.studentTotals || {});
        setPolicyMeta?.(data.policyMeta || null);
        setPagination(data.pagination || null);
        setCellMeta(data.cellMeta || {});
      } catch {
        if (!cancelled) {
          setGradebookData({ students: [], assignments: [], grades: {} });
          setSubmissionMap({});
          setStudentTotals?.({});
          setStudentFinalTotals?.({});
          setGradeOverrides?.({});
          setReleasedTotals?.({});
          setPolicyMeta?.(null);
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
    gradingPeriodId,
    setGradebookData,
    setSubmissionMap,
    setGradebookLoading,
    setStudentTotals,
    setReleasedTotals,
    setPolicyMeta,
  ]);

  return { pagination, cellMeta };
}
