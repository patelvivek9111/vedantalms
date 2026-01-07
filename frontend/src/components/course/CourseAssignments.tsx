import React from 'react';
import { useNavigate } from 'react-router-dom';
import AssignmentList from '../assignments/AssignmentList';

interface CourseAssignmentsProps {
  course: {
    _id: string;
    title: string;
  };
  modules: Array<{
    _id: string;
    title?: string;
    assignments?: any[];
  }>;
  groupAssignments: any[];
  discussions: any[];
  discussionsLoading: boolean;
  user: {
    _id: string;
    role: string;
  };
  studentSubmissions: any[];
  submissionMap: Record<string, any>;
  isInstructor: boolean;
  isAdmin: boolean;
}

const CourseAssignments: React.FC<CourseAssignmentsProps> = ({
  course,
  modules,
  groupAssignments,
  discussions,
  discussionsLoading,
  user,
  studentSubmissions,
  submissionMap,
  isInstructor,
  isAdmin,
}) => {
  const navigate = useNavigate();

  // Gather all assignments from all modules
  const allAssignments = modules.flatMap((module: any) => module.assignments || []);
  
  // Add group assignments with isGroupAssignment: true
  const allGroupAssignments = groupAssignments.map((a: any) => ({
    ...a,
    isGroupAssignment: true,
  }));
  
  // Combine assignments, group assignments, and discussions
  const combinedList = [
    ...allAssignments.filter(assignment => !assignment.isGroupAssignment),
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
      published: true,
      studentGrades: d.studentGrades || [],
      replies: d.replies || [],
    })),
  ];
  
  // Deduplicate by ID
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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Assignments</h2>
          {(isInstructor || isAdmin) && (
            <>
              {modules.length > 0 ? (
                <button
                  onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Assignment
                </button>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Create a module first to add assignments
                </div>
              )}
            </>
          )}
        </div>
        {discussionsLoading ? (
          <div className="text-center text-gray-500 py-8">Loading discussions...</div>
        ) : modules.length > 0 ? (
          <AssignmentList
            assignments={deduplicatedList}
            userRole={user?.role}
            studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined}
            studentId={user?._id}
            submissionMap={user?.role === 'student' ? submissionMap : undefined}
            courseId={course?._id}
          />
        ) : (
          <div className="text-center text-gray-500 py-8">No modules available. Please create a module to add assignments.</div>
        )}
      </div>
    </div>
  );
};

export default CourseAssignments;





