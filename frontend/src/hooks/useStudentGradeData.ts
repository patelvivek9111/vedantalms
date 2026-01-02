import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseStudentGradeDataProps {
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  course: any;
  user: any;
  setStudentTotalGrade: React.Dispatch<React.SetStateAction<number | null>>;
  setStudentLetterGrade: React.Dispatch<React.SetStateAction<string | null>>;
  setStudentDiscussions: React.Dispatch<React.SetStateAction<any[]>>;
  setStudentGroupAssignments: React.Dispatch<React.SetStateAction<any[]>>;
}

export const useStudentGradeData = ({
  activeSection,
  isInstructor,
  isAdmin,
  course,
  user,
  setStudentTotalGrade,
  setStudentLetterGrade,
  setStudentDiscussions,
  setStudentGroupAssignments,
}: UseStudentGradeDataProps) => {
  // Fetch backend-calculated student grade when grades section is active
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id) return;
    const fetchStudentGrade = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/grades/student/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentTotalGrade(res.data.totalPercent);
        setStudentLetterGrade(res.data.letterGrade);
      } catch (err) {
        setStudentTotalGrade(null);
        setStudentLetterGrade(null);
      }
    };
    fetchStudentGrade();
  }, [activeSection, isInstructor, isAdmin, course?._id, setStudentTotalGrade, setStudentLetterGrade]);

  // Fetch graded discussions for the course for student view
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id || !user) return;
    const fetchStudentDiscussions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/threads/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const gradedDiscussions = (res.data.data || [])
          .filter((thread: any) => thread.isGraded)
          .map((thread: any) => {
            const userId = user?._id;
            let studentGradeObj: { grade?: number; feedback?: string } | null = null;
            let hasSubmitted = false;

            // Check if student has replied to the thread
            if (Array.isArray(thread.replies)) {
              hasSubmitted = thread.replies.some((reply: any) => 
                reply.author && (reply.author._id === userId || reply.author === userId)
              );
            }

            if (Array.isArray(thread.studentGrades)) {
              studentGradeObj = thread.studentGrades.find(
                (g: any) => g.student && (g.student._id === userId || g.student === userId)
              );
            }

            return {
              ...thread,
              isDiscussion: true,
              grade: typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : null,
              feedback: typeof studentGradeObj?.feedback === 'string' ? studentGradeObj.feedback : '',
              hasSubmitted: hasSubmitted,
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
        const token = localStorage.getItem('token');
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


