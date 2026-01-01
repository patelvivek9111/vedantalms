import React from 'react';

interface AssignmentCardProps {
  assignment: {
    _id: string;
    title: string;
    description?: string;
    moduleTitle?: string;
    group?: string;
    dueDate?: string | Date;
    totalPoints?: number;
    questions?: Array<{ points?: number }>;
    hasSubmission?: boolean;
    isOverdue?: boolean;
  };
  isInstructor: boolean;
  isAdmin: boolean;
  navigate: (path: string) => void;
}

const AssignmentCard: React.FC<AssignmentCardProps> = ({ 
  assignment, 
  isInstructor, 
  isAdmin, 
  navigate 
}) => {
  const totalPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
  // Ensure dueDate is a Date object
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1 line-clamp-2">
              {assignment.title}
            </h3>
            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full">
              {assignment.moduleTitle}
            </span>
          </div>
          {assignment.group && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 rounded-full">
              {assignment.group}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {assignment.description}
        </p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={assignment.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
              Due: {dueDate ? `${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'No due date'}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Points: {totalPoints}</span>
          </div>
          {assignment.hasSubmission && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Submitted</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => navigate(`/assignments/${assignment._id}/view`)}
            className="flex-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-colors text-sm font-medium"
          >
            View
          </button>
          {(isInstructor || isAdmin) && (
            <button
              onClick={() => navigate(`/assignments/${assignment._id}/grade`)}
              className="flex-1 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/70 transition-colors text-sm font-medium"
            >
              Grade
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { AssignmentCard };
export default AssignmentCard;

