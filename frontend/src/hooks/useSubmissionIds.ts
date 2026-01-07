import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseSubmissionIdsProps {
  gradebookData: {
    assignments: any[];
    students: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  };
  isInstructor: boolean;
  isAdmin: boolean;
  course: any;
  user: any;
  studentDiscussions: any[];
  setSubmissionMap: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
}

export const useSubmissionIds = ({
  gradebookData,
  isInstructor,
  isAdmin,
  course,
  user,
  studentDiscussions,
  setSubmissionMap,
  setGradebookData,
}: UseSubmissionIdsProps) => {
  useEffect(() => {
    const fetchSubmissionIds = async () => {
      if (!gradebookData.assignments?.length || !gradebookData.students?.length) return;
      if (!isInstructor && !isAdmin) return; // Only fetch if user is instructor or admin
      
      const newSubmissionMap: { [key: string]: string } = {};
      const newGrades: { [studentId: string]: { [assignmentId: string]: number | string } } = { [String(user._id)]: {} };
      const token = localStorage.getItem('token');
      
      try {
        // For each assignment, fetch submissions
        for (const assignment of gradebookData.assignments) {
          // Skip if assignment._id is missing
          if (!assignment._id) continue;
          
          if (assignment.isDiscussion) {
            // For discussions, check if students have replies (participation)
            if (assignment.replies && Array.isArray(assignment.replies)) {
              assignment.replies.forEach((reply: any) => {
                const studentId = reply.author?._id || reply.author;
                if (studentId) {
                  const key = `${String(studentId)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = reply._id; // Use reply ID as submission ID
                }
              });
            }
            continue;
          }
          
          try {
            const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            // Map student submissions and grades
            const submissionsData = Array.isArray(res.data) ? res.data : [];
            submissionsData.forEach((submission: any) => {
              if (assignment.isGroupAssignment && submission.group && submission.group.members) {
                // For group assignments, create entries for all group members
                submission.group.members.forEach((member: any) => {
                  const memberId = member._id || member;
                  const key = `${String(user._id)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = submission._id;
                  
                  // Check for individual member grades first
                  if (submission.useIndividualGrades && submission.memberGrades) {
                    const memberGrade = submission.memberGrades.find(
                      (mg: any) => mg.student && (mg.student.toString() === String(memberId) || mg.student._id?.toString() === String(memberId))
                    );
                    if (memberGrade && typeof memberGrade.grade === 'number') {
                      if (!newGrades[String(memberId)]) newGrades[String(memberId)] = {};
                      newGrades[String(memberId)][String(assignment._id)] = memberGrade.grade;
                    } else if (typeof submission.grade === 'number') {
                      if (!newGrades[String(memberId)]) newGrades[String(memberId)] = {};
                      newGrades[String(memberId)][String(assignment._id)] = submission.grade;
                    }
                  } else if (typeof submission.grade === 'number') {
                    // Use group grade for all members
                    if (!newGrades[String(memberId)]) newGrades[String(memberId)] = {};
                    newGrades[String(memberId)][String(assignment._id)] = submission.grade;
                  }
                });
              } else {
                // For regular assignments
                const key = `${String(submission.student._id)}_${String(assignment._id)}`;
                newSubmissionMap[key] = submission._id;
                if (typeof submission.grade === 'number') {
                  if (!newGrades[String(submission.student._id)]) newGrades[String(submission.student._id)] = {};
                  newGrades[String(submission.student._id)][String(assignment._id)] = submission.grade;
                }
              }
            });
          } catch (err: any) {
            if (err.response && err.response.status === 404) {
              // Assignment not found, skip
              continue;
            }
          }
        }
        // Fetch graded discussions and merge their grades
        if (course?._id) {
          const discussionRes = await axios.get(`${API_URL}/api/threads/course/${course._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const discussionsData = discussionRes.data.data || discussionRes.data;
          const discussionsArray = Array.isArray(discussionsData) ? discussionsData : [];
          const gradedDiscussions = discussionsArray.filter((thread: any) => thread.isGraded);
          for (const discussion of gradedDiscussions) {
            for (const student of gradebookData.students) {
              if (!newGrades[String(student._id)]) newGrades[String(student._id)] = {};
              const studentGradeObj = discussion.studentGrades.find(
                (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
              );
              newGrades[String(student._id)][String(discussion._id)] =
                typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : '-';
            }
          }
        }
        setSubmissionMap(newSubmissionMap);
        
        // Merge all grades (both regular assignments and discussions)
        const allGrades = { ...newGrades };
        for (const discussion of studentDiscussions) {
          if (typeof discussion.grade === 'number') {
            if (!allGrades[String(user._id)]) allGrades[String(user._id)] = {};
            allGrades[String(user._id)][String(discussion._id)] = discussion.grade;
          }
        }
        
        setGradebookData((prev: any) => ({ 
          ...prev, 
          grades: { ...prev.grades, ...allGrades }
        }));
      } catch (err) {
      }
    };
    
    fetchSubmissionIds();
  }, [gradebookData.assignments, gradebookData.students, isInstructor, isAdmin, course?._id, user._id, studentDiscussions, setSubmissionMap, setGradebookData]);
};





