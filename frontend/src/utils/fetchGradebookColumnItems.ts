import axios from 'axios';
import { API_URL } from '../config';

/**
 * Same assignable columns as the instructor gradebook: module assignments,
 * course group assignments, and graded discussions, with id + title|type dedupe.
 */
export async function fetchGradebookColumnItems(
  courseId: string,
  modules: any[],
  token: string
): Promise<any[]> {
  const headers = { Authorization: `Bearer ${token}` };

  const allAssignments = modules.flatMap((module: any) =>
    (module.assignments || []).map((assignment: any) => ({
      ...assignment,
      moduleTitle: module.title,
    }))
  );

  const groupAssignmentsResponse = await axios.get(
    `${API_URL}/api/assignments/course/${courseId}/group-assignments`,
    { headers }
  );
  const groupAssignments = Array.isArray(groupAssignmentsResponse.data)
    ? groupAssignmentsResponse.data.map((assignment: any) => ({
        ...assignment,
        moduleTitle: 'Group Assignments',
      }))
    : [];

  const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${courseId}`, {
    headers,
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
          replies: thread.replies || [],
        }))
    : [];

  const combined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
  const byId = combined.filter((a, i, arr) => i === arr.findIndex((b) => b._id === a._id));
  const seenKeys = new Set<string>();
  return byId.filter((a) => {
    const type = a.isDiscussion ? 'discussion' : 'assignment';
    const key = `${String(a.title || '').trim().toLowerCase()}|${type}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}
