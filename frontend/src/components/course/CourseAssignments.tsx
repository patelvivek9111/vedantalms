import React from 'react';
import { useNavigate } from 'react-router-dom';
import AssignmentList from '../assignments/AssignmentList';
import { SectionDividerHeading } from '../common/SectionDividerHeading';

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
      availableFrom: d.availableFrom ?? d.available_from ?? null,
      attachments: [],
      createdBy: d.author || { firstName: '', lastName: '' },
      type: 'discussion',
      group: d.group || 'Discussions',
      totalPoints: d.totalPoints || 0,
      published: true,
      studentGrades: d.studentGrades || [],
      replies: d.replies || [],
      hasSubmitted: d.hasSubmitted ?? d.hasPosted ?? false,
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Assignments</h2>
        {(isInstructor || isAdmin) && (
          modules.length > 0 ? (
            <button
              onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create`)}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Create Assignment
            </button>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">Create a module first to add assignments</div>
          )
        )}
      </div>
      {discussionsLoading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading discussions...</div>
      ) : modules.length > 0 ? (
        <section aria-labelledby="assignments-heading">
          <SectionDividerHeading id="assignments-heading">Assignments</SectionDividerHeading>
          <AssignmentList
          assignments={deduplicatedList}
          userRole={user?.role}
          studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined}
          studentId={user?._id}
          submissionMap={user?.role === 'student' ? submissionMap : undefined}
          courseId={course?._id}
        />
        </section>
      ) : (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">No modules available. Please create a module to add assignments.</div>
      )}
    </div>
  );
};

export default CourseAssignments;










