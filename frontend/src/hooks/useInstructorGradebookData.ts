import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseInstructorGradebookDataProps {
  activeSection: string;
  isInstructor: boolean;
  course: any;
  modules: any[];
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
}

export const useInstructorGradebookData = ({
  activeSection,
  isInstructor,
  course,
  modules,
  setGradebookData,
}: UseInstructorGradebookDataProps) => {
  useEffect(() => {
    const fetchInstructorGradebookData = async () => {
      if (activeSection !== 'gradebook' || !isInstructor) return;
      try {
        const token = localStorage.getItem('token');
        // 1. Get all students
        const students = course?.students || [];
        
        // 2. Get all assignments (across all modules)
        const allAssignments = modules.flatMap((module: any) =>
          (module.assignments || []).map((assignment: any) => ({
            ...assignment,
            moduleTitle: module.title
          }))
        );

        // 3. Get all group assignments for the course
        const groupAssignmentsResponse = await axios.get(`${API_URL}/api/assignments/course/${course?._id}/group-assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const groupAssignments = Array.isArray(groupAssignmentsResponse.data) 
          ? groupAssignmentsResponse.data.map((assignment: any) => ({
              ...assignment,
              moduleTitle: 'Group Assignments'
            }))
          : [];

        // 4. Get all graded discussions
        const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${course?._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const threadsData = threadsResponse.data?.data || threadsResponse.data || [];
        const gradedDiscussions = Array.isArray(threadsData)
          ? threadsData
              .filter((thread: any) => thread.isGraded)
              .map((thread: any) => ({
                _id: thread._id,
                title: thread.title,
                totalPoints: thread.totalPoints,
                group: thread.group,
                moduleTitle: 'Discussions',
                isDiscussion: true,
                studentGrades: thread.studentGrades || [],
                dueDate: thread.dueDate,
                replies: thread.replies || []
              }))
          : [];

        // 5. Get all submissions for assignments (both regular and group assignments)
        let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
        const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];
        for (const assignment of allAssignmentsWithGroups) {
          const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Map: { studentId: grade }
          const submissions = Array.isArray(res.data) ? res.data : [];
          for (const submission of submissions) {
            if (assignment.isGroupAssignment && submission.group && submission.group.members) {
              // For group assignments, create grades for all group members
              submission.group.members.forEach((member: any) => {
                const memberId = member._id || member;
                if (!grades[String(memberId)]) grades[String(memberId)] = {};
                
                // Check for individual member grades first
                if (submission.useIndividualGrades && submission.memberGrades) {
                  const memberGrade = submission.memberGrades.find(
                    (mg: any) => mg.student && (mg.student.toString() === String(memberId) || mg.student._id?.toString() === String(memberId))
                  );
                  if (memberGrade && typeof memberGrade.grade === 'number') {
                    grades[String(memberId)][String(assignment._id)] = memberGrade.grade;
                  } else if (typeof submission.grade === 'number') {
                    grades[String(memberId)][String(assignment._id)] = submission.grade;
                  } else {
                    grades[String(memberId)][String(assignment._id)] = '-';
                  }
                } else if (typeof submission.grade === 'number') {
                  // Use group grade for all members
                  grades[String(memberId)][String(assignment._id)] = submission.grade;
                } else {
                  grades[String(memberId)][String(assignment._id)] = '-';
                }
              });
            } else if (submission.student) {
              // For regular assignments
              const studentId = submission.student._id || submission.student;
              if (!grades[String(studentId)]) grades[String(studentId)] = {};
              grades[String(studentId)][String(assignment._id)] = submission.grade ?? '-';
            }
          }
        }

        // 6. Add discussion grades
        for (const discussion of gradedDiscussions) {
          for (const student of students) {
            if (!grades[String(student._id)]) grades[String(student._id)] = {};
            const studentGradeObj = discussion.studentGrades.find(
              (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
            );
            grades[String(student._id)][String(discussion._id)] =
              typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : '-';
          }
        }

        // Deduplicate for instructor view as well
        const combined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
        const byIdInstructor = combined.filter((a, i, arr) => i === arr.findIndex(b => b._id === a._id));
        const seenInstructor = new Set<string>();
        const uniqueInstructor = byIdInstructor.filter(a => {
          const type = a.isDiscussion ? 'discussion' : 'assignment';
          const key = `${String(a.title || '').trim().toLowerCase()}|${type}`;
          if (seenInstructor.has(key)) return false;
          seenInstructor.add(key);
          return true;
        });

        // Sort assignments by creation date (oldest first, newest last)
        // Use createdAt if available, otherwise use dueDate, otherwise use current date as fallback
        uniqueInstructor.sort((a: any, b: any) => {
          const getDate = (item: any) => {
            if (item.createdAt) return new Date(item.createdAt).getTime();
            if (item.dueDate) return new Date(item.dueDate).getTime();
            return 0; // Put items without dates at the end
          };
          
          const dateA = getDate(a);
          const dateB = getDate(b);
          
          // If both have dates, sort oldest first
          if (dateA > 0 && dateB > 0) {
            return dateA - dateB;
          }
          // If only one has a date, prioritize it
          if (dateA > 0 && dateB === 0) return -1;
          if (dateA === 0 && dateB > 0) return 1;
          // If neither has a date, maintain original order
          return 0;
        });

        setGradebookData({ 
          students, 
          assignments: uniqueInstructor, 
          grades 
        });
      } catch (err) {
        setGradebookData({ students: [], assignments: [], grades: {} });
      }
    };
    fetchInstructorGradebookData();
  }, [activeSection, isInstructor, course, modules, setGradebookData]);
};





