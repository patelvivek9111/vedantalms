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
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center gap-3 sm:gap-4">
      {student.profilePicture && !imgError ? (
        <img
          src={student.profilePicture.startsWith('http')
            ? student.profilePicture
            : getImageUrl(student.profilePicture)}
          alt={student.firstName}
          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-full border flex-shrink-0"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base sm:text-xl font-bold text-gray-600 dark:text-gray-300 border flex-shrink-0">
          {student.firstName && student.lastName
            ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
            : ''}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200 truncate">
          {student.firstName} {student.lastName}
        </div>
        <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm truncate">
          {student.email}
        </div>
      </div>
      {/* Only show Remove button for students, not instructor */}
      {!isInstructorCard && (isInstructor || isAdmin) && handleUnenroll && (
        <button
          className="ml-auto flex-shrink-0 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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

