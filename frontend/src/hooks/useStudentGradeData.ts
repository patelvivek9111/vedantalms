import { useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../utils/authToken';
import axios from 'axios';
import { API_URL } from '../config';
import { normalizeMongoIdRef } from '../utils/mongoId';

interface UseStudentGradeDataProps {
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  course: any;
  user: any;
  /** When set, totals are scoped to that grading period. */
  gradingPeriodId?: string;
  setStudentTotalGrade: React.Dispatch<React.SetStateAction<number | null>>;
  setStudentLetterGrade: React.Dispatch<React.SetStateAction<string | null>>;
  setStudentFinalGrade?: React.Dispatch<React.SetStateAction<number | null>>;
  setStudentFinalLetterGrade?: React.Dispatch<React.SetStateAction<string | null>>;
  setStudentGradingPeriodBreakdown?: React.Dispatch<
    React.SetStateAction<import('../services/gradingApi').GradingPeriodBreakdownRow[] | null>
  >;
  setStudentDiscussions: React.Dispatch<React.SetStateAction<any[]>>;
  setStudentGroupAssignments: React.Dispatch<React.SetStateAction<any[]>>;
  /** False while the course total API is in flight so the UI can avoid a misleading client-only total. */
  setStudentGradeSummaryReady?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useStudentGradeData = ({
  activeSection,
  isInstructor,
  isAdmin,
  course,
  user,
  gradingPeriodId,
  setStudentTotalGrade,
  setStudentLetterGrade,
  setStudentFinalGrade,
  setStudentFinalLetterGrade,
  setStudentGradingPeriodBreakdown,
  setStudentDiscussions,
  setStudentGroupAssignments,
  setStudentGradeSummaryReady,
}: UseStudentGradeDataProps) => {
  // Fetch backend-calculated student grade when grades section is active
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id) {
      setStudentGradeSummaryReady?.(false);
      return;
    }
    const fetchStudentGrade = async () => {
      setStudentGradeSummaryReady?.(false);
      setStudentTotalGrade(null);
      setStudentLetterGrade(null);
      setStudentFinalGrade?.(null);
      setStudentFinalLetterGrade?.(null);
      setStudentGradingPeriodBreakdown?.(null);
      try {
        const token = getMemoryAuthToken();
        const res = await axios.get(`${API_URL}/api/grades/student/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: gradingPeriodId ? { gradingPeriodId } : undefined,
        });
        const current =
          res.data.currentPercent ?? res.data.totalPercent ?? null;
        setStudentTotalGrade(current);
        setStudentLetterGrade(res.data.letterGrade ?? null);
        setStudentFinalGrade?.(res.data.finalPercent ?? null);
        setStudentFinalLetterGrade?.(res.data.finalLetterGrade ?? null);
        setStudentGradingPeriodBreakdown?.(res.data.gradingPeriodBreakdown ?? null);
      } catch (err) {
        setStudentTotalGrade(null);
        setStudentLetterGrade(null);
        setStudentFinalGrade?.(null);
        setStudentFinalLetterGrade?.(null);
        setStudentGradingPeriodBreakdown?.(null);
      } finally {
        setStudentGradeSummaryReady?.(true);
      }
    };
    fetchStudentGrade();
  }, [activeSection, isInstructor, isAdmin, course?._id, gradingPeriodId, setStudentTotalGrade, setStudentLetterGrade, setStudentFinalGrade, setStudentFinalLetterGrade, setStudentGradingPeriodBreakdown, setStudentGradeSummaryReady]);

  // Fetch graded discussions for the course for student view
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id || !user) return;
    const fetchStudentDiscussions = async () => {
      try {
        const token = getMemoryAuthToken();
        const res = await axios.get(`${API_URL}/api/threads/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const gradedDiscussions = (res.data.data || [])
          .filter((thread: any) => thread.isGraded)
          .map((thread: any) => {
            const userId = user?._id;
            let studentGradeObj: {
              grade?: number;
              feedback?: string;
              gradeVisibility?: { scoreVisible?: boolean };
            } | null = null;
            let hasSubmitted = false;

            // Check if student has replied to the thread
            if (Array.isArray(thread.replies)) {
              hasSubmitted = thread.replies.some((reply: any) => 
                reply.author && (reply.author._id === userId || reply.author === userId)
              );
            }

            if (Array.isArray(thread.studentGrades)) {
              studentGradeObj = thread.studentGrades.find(
                (g: any) => normalizeMongoIdRef(g.student) === normalizeMongoIdRef(userId)
              );
            }

            const gradeVisible = thread.gradeVisibility?.scoreVisible === true;

            return {
              ...thread,
              isDiscussion: true,
              grade: gradeVisible
                ? typeof thread.grade === 'number'
                  ? thread.grade
                  : (typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : null)
                : null,
              gradeVisibility: thread.gradeVisibility ?? studentGradeObj?.gradeVisibility,
              feedback: gradeVisible && typeof studentGradeObj?.feedback === 'string' ? studentGradeObj.feedback : '',
              hasSubmitted: hasSubmitted || thread.hasPosted === true,
              hasPosted: thread.hasPosted === true || hasSubmitted,
              studentReplyCreatedAt: thread.studentReplyCreatedAt ?? null,
              replies: thread.replies || []
            };
          });
        setStudentDiscussions(gradedDiscussions);
      } catch (err) {
        setStudentDiscussions([]);
      }
    };
    fetchStudentDiscussions();
  }, [activeSection, isInstructor, isAdmin, course?._id, user, setStudentDiscussions]);

  // Fetch group assignments for the course for student view
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id || !user) return;
    const fetchStudentGroupAssignments = async () => {
      try {
        const token = getMemoryAuthToken();
        const res = await axios.get(`${API_URL}/api/assignments/course/${course._id}/group-assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentGroupAssignments(res.data);
      } catch (err) {
        setStudentGroupAssignments([]);
      }
    };
    fetchStudentGroupAssignments();
  }, [activeSection, isInstructor, isAdmin, course?._id, user, setStudentGroupAssignments]);
};





