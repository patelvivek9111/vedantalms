import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseStudentSubmissionsProps {
  course: any;
  user: any;
  modules: any[];
  setStudentSubmissions: React.Dispatch<React.SetStateAction<any[]>>;
  setSubmissionMap: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
}

export const useStudentSubmissions = ({
  course,
  user,
  modules,
  setStudentSubmissions,
  setSubmissionMap,
  setGradebookData,
}: UseStudentSubmissionsProps) => {
  useEffect(() => {
    const studentId = user?._id;
    if (!course?._id || !studentId || user?.role !== 'student') return;
    const fetchStudentSubmissions = async () => {
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
        setSubmissionMap(newSubmissionMap);
        setGradebookData((prev: any) => ({ ...prev, grades: newGrades }));
      } catch (err) {
        setSubmissionMap({});
        setGradebookData((prev: any) => ({ ...prev, grades: {} }));
        setStudentSubmissions([]);
      }
    };
    fetchStudentSubmissions();
  }, [course?._id, user, modules, setStudentSubmissions, setSubmissionMap, setGradebookData]);
};

