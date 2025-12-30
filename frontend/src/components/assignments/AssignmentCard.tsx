import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, FileText, Lock, Unlock } from 'lucide-react';

interface AssignmentCardProps {
  assignment: {
    _id: string;
    title: string;
    description?: string;
    dueDate?: string;
    published?: boolean;
    totalPoints?: number;
    isGroupAssignment?: boolean;
  };
  isInstructor?: boolean;
  isAdmin?: boolean;
}

const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment, isInstructor, isAdmin }) => {
  const canEdit = isInstructor || isAdmin;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {assignment.published ? (
              <Unlock className="w-4 h-4 text-green-600" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {assignment.title}
            </h3>
          </div>
          {assignment.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
              {assignment.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
        {assignment.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
          </div>
        )}
        {assignment.totalPoints !== undefined && (
          <span className="font-medium">{assignment.totalPoints} points</span>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          to={`/assignments/${assignment._id}/view`}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center text-sm"
        >
          View
        </Link>
        {canEdit && (
          <Link
            to={`/assignments/${assignment._id}/edit`}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            Edit
          </Link>
        )}
      </div>
    </div>
  );
};

export default AssignmentCard;



