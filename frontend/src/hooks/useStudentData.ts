import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseStudentDataProps {
  course: any;
  modules: any[];
  user: any;
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
}

export const useStudentData = ({
  course,
  modules,
  user,
  activeSection,
  isInstructor,
  isAdmin,
}: UseStudentDataProps) => {
  const [studentSubmissions, setStudentSubmissions] = useState<any[]>([]);
  const [studentGradebookData, setStudentGradebookData] = useState<any>({
    students: [],
    assignments: [],
    grades: {},
    submissionMap: {},
  });
  const [studentTotalGrade, setStudentTotalGrade] = useState<number | null>(null);
  const [studentLetterGrade, setStudentLetterGrade] = useState<string | null>(null);
  const [studentDiscussions, setStudentDiscussions] = useState<any[]>([]);
  const [studentGroupAssignments, setStudentGroupAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch student submissions and grades for the student as soon as course/modules are loaded
  useEffect(() => {
    const studentId = user?._id;
    if (!course?._id || !studentId || user?.role !== 'student') return;
    
    const fetchStudentSubmissions = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/submissions/student/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Build submissionMap and grades
        const newSubmissionMap: { [key: string]: string } = {};
        const newGrades: { [studentId: string]: { [assignmentId: string]: number | string } } = { [String(studentId)]: {} };
        setStudentSubmissions(res.data); // Save full submissions for use in table
        
        res.data.forEach((submission: any) => {
          if (submission.assignment && submission._id) {
            // For group assignments, treat as submitted for all group members
            if (submission.assignment.isGroupAssignment && submission.group && submission.group.members) {
              if (submission.group.members.some((m: any) => m.toString() === String(studentId) || m._id?.toString() === String(studentId))) {
                newSubmissionMap[`${String(studentId)}_${String(submission.assignment._id)}`] = submission._id;
                // Check for individual member grades first
                if (submission.useIndividualGrades && submission.memberGrades) {
                  const memberGrade = submission.memberGrades.find(
                    (mg: any) => mg.student && (mg.student.toString() === String(studentId) || mg.student._id?.toString() === String(studentId))
                  );
                  if (memberGrade && typeof memberGrade.grade === 'number') {
                    newGrades[String(studentId)][String(submission.assignment._id)] = memberGrade.grade;
                  } else if (typeof submission.grade === 'number') {
                    newGrades[String(studentId)][String(submission.assignment._id)] = submission.grade;
                  }
                } else if (typeof submission.grade === 'number') {
                  // Use group grade for all members
                  newGrades[String(studentId)][String(submission.assignment._id)] = submission.grade;
                }
              }
            } else if (submission.student && (submission.student.toString() === String(studentId) || submission.student._id?.toString() === String(studentId))) {
              newSubmissionMap[`${String(studentId)}_${String(submission.assignment._id)}`] = submission._id;
              if (typeof submission.grade === 'number') {
                newGrades[String(studentId)][String(submission.assignment._id)] = submission.grade;
              }
            }
          }
        });
        
        setStudentGradebookData((prev: any) => ({ ...prev, grades: newGrades, submissionMap: newSubmissionMap }));
      } catch (err) {
        setStudentGradebookData((prev: any) => ({ ...prev, grades: {}, submissionMap: {} }));
        setStudentSubmissions([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudentSubmissions();
  }, [course?._id, user, modules, isInstructor, isAdmin, activeSection]);

  // Update grades when student discussions are loaded
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !user || !studentDiscussions.length) return;
    
    setStudentGradebookData((prev: any) => {
      const updatedGrades = { ...prev.grades };
      if (!updatedGrades[String(user._id)]) updatedGrades[String(user._id)] = {};
      
      // Add discussion grades
      for (const discussion of studentDiscussions) {
        if (typeof discussion.grade === 'number') {
          updatedGrades[String(user._id)][String(discussion._id)] = discussion.grade;
        }
      }
      
      return { ...prev, grades: updatedGrades };
    });
  }, [activeSection, isInstructor, isAdmin, user, studentDiscussions]);

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
  }, [activeSection, isInstructor, isAdmin, course?._id]);

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
  }, [activeSection, isInstructor, isAdmin, course?._id, user]);

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
  }, [activeSection, isInstructor, isAdmin, course?._id, user]);

  return {
    studentSubmissions,
    studentGradebookData,
    setStudentGradebookData,
    studentTotalGrade,
    studentLetterGrade,
    studentDiscussions,
    studentGroupAssignments,
    loading,
  };
};
























