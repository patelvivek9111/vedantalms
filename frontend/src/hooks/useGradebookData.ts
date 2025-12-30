import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseGradebookDataProps {
  course: any;
  modules: any[];
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  gradebookRefresh?: number; // Optional refresh trigger
}

export const useGradebookData = ({
  course,
  modules,
  activeSection,
  isInstructor,
  isAdmin,
  gradebookRefresh,
}: UseGradebookDataProps) => {
  const [gradebookData, setGradebookData] = useState<any>({
    students: [],
    assignments: [],
    grades: {},
    submissionMap: {},
  });

  useEffect(() => {
    const fetchGradebookData = async () => {
      if (activeSection !== 'gradebook' || (!isInstructor && !isAdmin)) return;
      
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
            replies: thread.replies || []
          }));

        // 5. Get all submissions for assignments (both regular and group assignments) - for ALL students
        let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
        const newSubmissionMap: { [key: string]: string } = {};
        const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];

        // Fetch submissions for each assignment to get grades for all students
        for (const assignment of allAssignmentsWithGroups) {
          if (!assignment._id) continue;

          try {
            const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            // Process submissions for this assignment
            for (const submission of res.data) {
              if (assignment.isGroupAssignment && submission.group && submission.group.members) {
                // For group assignments, create grades for all group members
                submission.group.members.forEach((member: any) => {
                  const memberId = member._id || member;
                  if (!grades[String(memberId)]) grades[String(memberId)] = {};
                  newSubmissionMap[`${String(memberId)}_${String(assignment._id)}`] = submission._id;

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
                newSubmissionMap[`${String(studentId)}_${String(assignment._id)}`] = submission._id;
                grades[String(studentId)][String(assignment._id)] = submission.grade ?? '-';
              }
            }
          } catch (err: any) {
            if (err.response && err.response.status === 404) {
              // Assignment not found, skip
              continue;
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

            // Also build submission map for discussions (using reply ID as submission ID)
            if (discussion.replies && Array.isArray(discussion.replies)) {
              discussion.replies.forEach((reply: any) => {
                const studentId = reply.author?._id || reply.author;
                if (studentId === student._id) {
                  const key = `${String(studentId)}_${String(discussion._id)}`;
                  newSubmissionMap[key] = reply._id;
                }
              });
            }
          }
        }

        // Deduplicate assignments to avoid duplicate columns in the gradebook
        // 1) First pass: by _id
        const allAssignmentsCombined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
        const byId = allAssignmentsCombined.filter((assignment, index, self) =>
          index === self.findIndex((a) => a._id === assignment._id)
        );
        // 2) Second pass: collapse items that share the same normalized title and type
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
        uniqueAssignments.sort((a: any, b: any) => {
          const getDate = (item: any) => {
            if (item.createdAt) return new Date(item.createdAt).getTime();
            if (item.dueDate) return new Date(item.dueDate).getTime();
            return 0;
          };

          const dateA = getDate(a);
          const dateB = getDate(b);

          if (dateA > 0 && dateB > 0) {
            return dateA - dateB;
          }
          if (dateA > 0 && dateB === 0) return -1;
          if (dateA === 0 && dateB > 0) return 1;
          return 0;
        });

        // Set both gradebook data and submission map together atomically
        setGradebookData({
          students,
          assignments: uniqueAssignments,
          grades,
          submissionMap: newSubmissionMap
        });
      } catch (err) {
        setGradebookData({ students: [], assignments: [], grades: {}, submissionMap: {} });
      }
    };
    fetchGradebookData();
  }, [activeSection, isInstructor, isAdmin, course, modules, gradebookRefresh]);

  return gradebookData;
};
























