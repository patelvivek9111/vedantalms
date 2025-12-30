import axios from 'axios';
import { API_URL } from '../config';

export interface GradebookData {
  students: any[];
  assignments: any[];
  grades: { [studentId: string]: { [assignmentId: string]: number | string } };
}

export interface GradebookOptions {
  courseId: string;
  modules: any[];
  course?: any;
  userId?: string;
  isInstructor?: boolean;
}

/**
 * Normalize title for deduplication
 */
const normalizeTitle = (t: any): string => String(t || '').trim().toLowerCase();

/**
 * Sort assignments by creation date (oldest first, newest last)
 */
const sortAssignments = (assignments: any[]): any[] => {
  return [...assignments].sort((a: any, b: any) => {
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
};

/**
 * Deduplicate assignments to avoid duplicate columns in the gradebook
 */
const deduplicateAssignments = (assignments: any[]): any[] => {
  // 1) First pass: by _id
  const byId = assignments.filter((assignment, index, self) =>
    index === self.findIndex((a) => a._id === assignment._id)
  );
  
  // 2) Second pass: collapse items that share the same normalized title and type
  const seenKeys = new Set<string>();
  const unique = byId.filter(a => {
    const type = a.isDiscussion ? 'discussion' : 'assignment';
    const normalizedTitle = normalizeTitle(a.title);
    const key = `${normalizedTitle}|${type}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  
  return sortAssignments(unique);
};

/**
 * Fetch gradebook data for instructor/admin view
 * Returns data for all students in the course
 */
export const fetchInstructorGradebookData = async (options: GradebookOptions): Promise<GradebookData> => {
  const { courseId, modules, course } = options;
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }

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
  const groupAssignmentsResponse = await axios.get(`${API_URL}/api/assignments/course/${courseId}/group-assignments`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const groupAssignments = groupAssignmentsResponse.data.map((assignment: any) => ({
    ...assignment,
    moduleTitle: 'Group Assignments'
  }));

  // 4. Get all graded discussions
  const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${courseId}`, {
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

  // 5. Get all submissions for assignments (both regular and group assignments)
  let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
  const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];
  
  for (const assignment of allAssignmentsWithGroups) {
    const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Map: { studentId: grade }
    for (const submission of res.data) {
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

  // Deduplicate assignments
  const allAssignmentsCombined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
  const uniqueAssignments = deduplicateAssignments(allAssignmentsCombined);

  return {
    students,
    assignments: uniqueAssignments,
    grades
  };
};

/**
 * Fetch gradebook data for student view
 * Returns data for the current student only
 */
export const fetchStudentGradebookData = async (options: GradebookOptions): Promise<GradebookData> => {
  const { courseId, modules, course, userId } = options;
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  if (!userId) {
    throw new Error('User ID is required for student gradebook data');
  }

  // 1. Get students (only current student for student view)
  const students = course?.students || [];
  
  // 2. Get all assignments (across all modules)
  const allAssignments = modules.flatMap((module: any) =>
    (module.assignments || []).map((assignment: any) => ({
      ...assignment,
      moduleTitle: module.title
    }))
  );

  // 3. Get all group assignments for the course
  const groupAssignmentsResponse = await axios.get(`${API_URL}/api/assignments/course/${courseId}/group-assignments`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let groupAssignments = groupAssignmentsResponse.data.map((assignment: any) => ({
    ...assignment,
    moduleTitle: 'Group Assignments'
  }));

  // Remove group assignments that are also present in regular assignments (same title)
  const regularTitles = new Set((allAssignments || []).map((a: any) => normalizeTitle(a.title)));
  groupAssignments = groupAssignments.filter((ga: any) => !regularTitles.has(normalizeTitle(ga.title)));

  // 4. Get all graded discussions
  const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${courseId}`, {
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

  // 5. Get all submissions for assignments (both regular and group assignments)
  let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
  const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];
  
  // Get student's submissions for the course
  const studentSubmissionsResponse = await axios.get(`${API_URL}/api/submissions/student/course/${courseId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Process student's submissions to build grades object
  for (const submission of studentSubmissionsResponse.data) {
    const assignment = allAssignmentsWithGroups.find(a => a._id === submission.assignment);
    if (assignment) {
      if (assignment.isGroupAssignment && submission.group && submission.group.members) {
        // For group assignments, check if student is a member
        const isMember = submission.group.members.some((member: any) => 
          (member._id || member) === userId
        );
        if (isMember) {
          if (!grades[userId]) grades[userId] = {};
          
          // Check for individual member grades first
          if (submission.useIndividualGrades && submission.memberGrades) {
            const memberGrade = submission.memberGrades.find(
              (mg: any) => mg.student && (mg.student.toString() === userId.toString() || mg.student._id?.toString() === userId.toString())
            );
            if (memberGrade && typeof memberGrade.grade === 'number') {
              grades[userId][assignment._id] = memberGrade.grade;
            } else if (typeof submission.grade === 'number') {
              grades[userId][assignment._id] = submission.grade;
            } else {
              grades[userId][assignment._id] = '-';
            }
          } else if (typeof submission.grade === 'number') {
            // Use group grade for all members
            grades[userId][assignment._id] = submission.grade;
          } else {
            grades[userId][assignment._id] = '-';
          }
        }
      } else {
        // For regular assignments
        if (!grades[userId]) grades[userId] = {};
        grades[userId][assignment._id] = submission.grade ?? '-';
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

  // Deduplicate assignments
  const allAssignmentsCombined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
  const uniqueAssignments = deduplicateAssignments(allAssignmentsCombined);

  return {
    students,
    assignments: uniqueAssignments,
    grades
  };
};
























