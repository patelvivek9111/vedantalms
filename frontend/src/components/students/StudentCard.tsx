import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
  /** Render as a row inside a divided list (no outer border/radius). */
  listItem?: boolean;
}

const StudentCard: React.FC<StudentCardProps> = ({
  student,
  isInstructor,
  isAdmin,
  handleUnenroll,
  isInstructorCard,
  listItem = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const initials =
    student.firstName && student.lastName
      ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
      : 'U';

  const showRemove = !isInstructorCard && (isInstructor || isAdmin) && handleUnenroll;

  return (
    <div
      className={
        listItem
          ? 'flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5 sm:py-3'
          : 'flex items-center gap-2.5 rounded-lg border border-gray-200/90 bg-white px-3 py-2.5 transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 sm:gap-3 sm:px-3.5 sm:py-3'
      }
    >
      {student.profilePicture && !imgError ? (
        <img
          src={
            student.profilePicture.startsWith('http')
              ? student.profilePicture
              : getImageUrl(student.profilePicture)
          }
          alt={`${student.firstName} ${student.lastName}`}
          className="h-9 w-9 shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-600"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[11px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
          {student.firstName} {student.lastName}
        </div>
        <div className="truncate text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
          {student.email}
        </div>
      </div>
      {showRemove && (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          onClick={() => handleUnenroll(student._id)}
          title="Remove student"
          aria-label={`Remove ${student.firstName} ${student.lastName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default StudentCard;
