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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Assignments</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">View and manage course assignments</p>
          </div>
          {(isInstructor || isAdmin) && (
            <>
              {modules.length > 0 ? (
                <button
                  onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create`)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm text-sm sm:text-base"
                >
                  <span className="text-base sm:text-lg">+</span>
                  <span>Create Assignment</span>
                </button>
              ) : (
                <div className="w-full sm:w-auto text-xs sm:text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-3 sm:px-4 py-2 rounded-md text-center sm:text-left">
                  Create a module first to add assignments
                </div>
              )}
            </>
          )}
        </div>
        {/* Render the new AssignmentList table UI for all assignments and discussions */}
        {discussionsLoading ? (
          <div className="text-center text-gray-500 py-8">Loading discussions...</div>
        ) : modules.length > 0 ? (
          <AssignmentList assignments={deduplicatedList} userRole={user?.role} studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined} studentId={user?._id} submissionMap={user?.role === 'student' ? submissionMap : undefined} courseId={course?._id} />
        ) : (
          <div className="text-center text-gray-500 py-8">No modules available. Please create a module to add assignments.</div>
        )}
      </div>
    </div>
  );
};

export default AssignmentsSection;





