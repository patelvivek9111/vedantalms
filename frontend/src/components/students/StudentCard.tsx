import React, { useState } from 'react';
import { getImageUrl } from '../../services/api';

interface StudentCardProps {
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  };
  isInstructor?: boolean;
  isAdmin?: boolean;
  handleUnenroll?: ((studentId: string) => void) | null;
  isInstructorCard?: boolean;
}

const StudentCard: React.FC<StudentCardProps> = ({ 
  student, 
  isInstructor, 
  isAdmin, 
  handleUnenroll, 
  isInstructorCard 
}) => {
  const [imgError, setImgError] = useState(false);
  
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 sm:gap-4">
      {student.profilePicture && !imgError ? (
        <img
          src={student.profilePicture.startsWith('http')
            ? student.profilePicture
            : getImageUrl(student.profilePicture)}
          alt={student.firstName}
          className="h-10 w-10 flex-shrink-0 rounded-full border border-gray-200 object-cover sm:h-12 sm:w-12 dark:border-gray-600"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-base font-bold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 sm:h-12 sm:w-12 sm:text-xl">
          {student.firstName && student.lastName
            ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
            : ''}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate text-base font-semibold text-gray-800 dark:text-gray-200 sm:text-lg">
          {student.firstName} {student.lastName}
        </div>
        <div className="truncate text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          {student.email}
        </div>
      </div>
      {/* Only show Remove button for students, not instructor */}
      {!isInstructorCard && (isInstructor || isAdmin) && handleUnenroll && (
        <button
          className="ml-auto flex-shrink-0 rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
          onClick={() => handleUnenroll(student._id)}
          title="Remove student"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default StudentCard;

