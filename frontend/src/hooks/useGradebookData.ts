import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseGradebookDataProps {
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  course: any;
  modules: any[];
  user: any;
  gradebookRefresh: number;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
}

export const useGradebookData = ({
  activeSection,
  isInstructor,
  isAdmin,
  course,
  modules,
  user,
  gradebookRefresh,
  setGradebookData,
}: UseGradebookDataProps) => {
  useEffect(() => {
    const fetchGradebookData = async () => {
      if ((activeSection !== 'gradebook') || (!isInstructor && !isAdmin)) return;
      try {
        const token = localStorage.getItem('token');
        // 1. Get students
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
        let groupAssignments = groupAssignmentsResponse.data.map((assignment: any) => ({
          ...assignment,
          moduleTitle: 'Group Assignments'
        }));

        // Remove group assignments that are also present in regular assignments (same title)
        const normalizeTitle = (t: any) => String(t || '').trim().toLowerCase();
        const regularTitles = new Set((allAssignments || []).map((a: any) => normalizeTitle(a.title)));
        groupAssignments = groupAssignments.filter((ga: any) => !regularTitles.has(normalizeTitle(ga.title)));

        // 4. Get all graded discussions
        const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${course?._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const gradedDiscussions = threadsResponse.data.data
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
            replies: thread.replies || [] // <-- add replies
          }));

        // 5. Get all submissions for assignments (both regular and group assignments)
        let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
        const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];
        
        // Get student's submissions for the course
        const studentSubmissionsResponse = await axios.get(`${API_URL}/api/submissions/student/course/${course?._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        
        // Process student's submissions to build grades object
        for (const submission of studentSubmissionsResponse.data) {
          const assignment = allAssignmentsWithGroups.find(a => a._id === submission.assignment);
          if (assignment) {
            if (assignment.isGroupAssignment && submission.group && submission.group.members) {
              // For group assignments, check if student is a member
              const isMember = submission.group.members.some((member: any) => 
                (member._id || member) === user._id
              );
              if (isMember) {
                if (!grades[user._id]) grades[user._id] = {};
                
                // Check for individual member grades first
                if (submission.useIndividualGrades && submission.memberGrades) {
                  const memberGrade = submission.memberGrades.find(
                    (mg: any) => mg.student && (mg.student.toString() === user._id.toString() || mg.student._id?.toString() === user._id.toString())
                  );
                  if (memberGrade && typeof memberGrade.grade === 'number') {
                    grades[user._id][assignment._id] = memberGrade.grade;
                  } else if (typeof submission.grade === 'number') {
                    grades[user._id][assignment._id] = submission.grade;
                  } else {
                    grades[user._id][assignment._id] = '-';
                  }
                } else if (typeof submission.grade === 'number') {
                  // Use group grade for all members
                  grades[user._id][assignment._id] = submission.grade;
                } else {
                  grades[user._id][assignment._id] = '-';
                }
              }
            } else {
              // For regular assignments
              if (!grades[user._id]) grades[user._id] = {};
              grades[user._id][assignment._id] = submission.grade ?? '-';
            }
          }
        }

        // 6. Add discussion grades
        for (const discussion of gradedDiscussions) {
          for (const student of students) {
            if (!grades[student._id]) grades[student._id] = {};
            const studentGradeObj = discussion.studentGrades.find(
              (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
            );
            grades[student._id][discussion._id] =
              typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : '-';
          }
        }

        // Deduplicate assignments to avoid duplicate columns in the gradebook
        // 1) First pass: by _id
        const allAssignmentsCombined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
        const byId = allAssignmentsCombined.filter((assignment, index, self) =>
          index === self.findIndex((a) => a._id === assignment._id)
        );
        // 2) Second pass: collapse items that share the same normalized title and type (covers duplicates from different sources)
        const seenKeys = new Set<string>();
        const uniqueAssignments = byId.filter(a => {
          const type = a.isDiscussion ? 'discussion' : 'assignment';
          const normalizedTitle = String(a.title || '').trim().toLowerCase();
          const key = `${normalizedTitle}|${type}`;
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });

        // Sort assignments by creation date (oldest first, newest last)
        // Use createdAt if available, otherwise use dueDate, otherwise use current date as fallback
        uniqueAssignments.sort((a: any, b: any) => {
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
          assignments: uniqueAssignments, 
          grades 
        });
      } catch (err) {
        setGradebookData({ students: [], assignments: [], grades: {} });
      }
    };
    fetchGradebookData();
  }, [activeSection, isInstructor, isAdmin, course, modules, gradebookRefresh, user, setGradebookData]);
};


