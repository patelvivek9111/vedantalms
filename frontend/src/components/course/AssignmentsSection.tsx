import React from 'react';
import { useNavigate } from 'react-router-dom';
import AssignmentList from '../assignments/AssignmentList';

interface AssignmentsSectionProps {
  modules: any[];
  groupAssignments: any[];
  discussions: any[];
  isInstructor: boolean;
  isAdmin: boolean;
  discussionsLoading: boolean;
  user: any;
  studentSubmissions: any[];
  submissionMap: { [key: string]: string };
  course: any;
}

const AssignmentsSection: React.FC<AssignmentsSectionProps> = ({
  modules,
  groupAssignments,
  discussions,
  isInstructor,
  isAdmin,
  discussionsLoading,
  user,
  studentSubmissions,
  submissionMap,
  course,
}) => {
  const navigate = useNavigate();

  // Gather all assignments from all modules
  const allAssignments = modules.flatMap((module: any) => module.assignments || []);
  // Add group assignments with isGroupAssignment: true and correct totalPoints
  const allGroupAssignments = groupAssignments.map((a: any) => ({
    ...a,
    isGroupAssignment: true,
    totalPoints: a.totalPoints || (Array.isArray(a.questions) ? a.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : 0)
  }));
  
  // Deduplicate: Remove group assignments from module assignments to avoid showing them twice
  const moduleAssignmentsOnly = allAssignments.filter(assignment => !assignment.isGroupAssignment);
  
  // Combine assignments, group assignments, and discussions
  const combinedList = [
    ...moduleAssignmentsOnly,
    ...allGroupAssignments,
    ...discussions.map(d => ({
      _id: d._id,
      title: d.title,
      dueDate: d.dueDate || d.due_date || d.discussionDueDate || null,
      attachments: [],
      createdBy: d.author || { firstName: '', lastName: '' },
      type: 'discussion',
      group: d.group || 'Discussions',
      totalPoints: d.totalPoints || 0,
      published: true, // Always treat discussions as published
      studentGrades: d.studentGrades || [],
      replies: d.replies || [],
      hasSubmitted: d.hasSubmitted ?? d.hasPosted ?? false,
    }))
  ];
  
  // Final deduplication by ID to ensure no duplicates exist
  const seenIds = new Set<string>();
  const deduplicatedList = combinedList.filter(item => {
    const id = item._id;
    if (seenIds.has(id)) {
      return false;
    }
    seenIds.add(id);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-5">
          {(isInstructor || isAdmin) && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Create and manage assignments and discussions for this course</p>
              {modules.length > 0 ? (
                <button
                  onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create`)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  + Create Assignment
                </button>
              ) : (
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Create a module first to add assignments
                </div>
              )}
            </div>
          )}

          {/* Render the assignment table UI for assignments and discussions */}
          {discussionsLoading ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading discussions...</div>
          ) : modules.length > 0 ? (
            <AssignmentList assignments={deduplicatedList} userRole={user?.role} studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined} studentId={user?._id} submissionMap={user?.role === 'student' ? submissionMap : undefined} courseId={course?._id} />
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">No modules available. Please create a module to add assignments.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentsSection;






