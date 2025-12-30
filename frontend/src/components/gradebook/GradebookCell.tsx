import React from 'react';
import { useNavigate } from 'react-router-dom';

interface GradebookCellProps {
  courseId: string;
  studentId: string;
  assignment: any;
  grade: number | string | undefined;
  hasSubmission: boolean;
  submittedAt: Date | null;
  dueDate: Date | null;
  rowBg: string;
  isInstructor: boolean;
  isAdmin: boolean;
  editingGrade: { studentId: string; assignmentId: string } | null;
  setEditingGrade: React.Dispatch<React.SetStateAction<{ studentId: string; assignmentId: string } | null>>;
  editingValue: string;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  savingGrade: { studentId: string; assignmentId: string } | null;
  gradeError: string;
  setGradeError: React.Dispatch<React.SetStateAction<string>>;
  handleGradeCellClick: (studentId: string, assignmentId: string, currentGrade: number | string) => void;
  handleGradeUpdate: (studentId: string, assignmentId: string, newGrade: string) => Promise<void>;
}

const GradebookCell: React.FC<GradebookCellProps> = ({
  courseId,
  studentId,
  assignment,
  grade,
  hasSubmission,
  submittedAt,
  dueDate,
  rowBg,
  isInstructor,
  isAdmin,
  editingGrade,
  setEditingGrade,
  editingValue,
  setEditingValue,
  savingGrade,
  gradeError,
  setGradeError,
  handleGradeCellClick,
  handleGradeUpdate,
}) => {
  const navigate = useNavigate();
  const now = new Date();
  const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;

  let cellContent: React.ReactNode;
  let cellBg = '';
  
  if (!assignment.isDiscussion && !assignment.published) {
    cellContent = <span className="text-gray-500 dark:text-gray-400 italic">Not Published</span>;
    cellBg = 'bg-gray-100 dark:bg-gray-800';
  } else if (typeof grade === 'number') {
    const percentage = (grade / maxPoints) * 100;
    let gradeBg = 'bg-green-100 dark:bg-green-900/20';
    if (percentage < 60) gradeBg = 'bg-red-100 dark:bg-red-900/20';
    else if (percentage < 70) gradeBg = 'bg-orange-100 dark:bg-orange-900/20';
    else if (percentage < 80) gradeBg = 'bg-yellow-100 dark:bg-yellow-900/20';
    
    cellContent = (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gradeBg} ${percentage < 60 ? 'text-red-700 dark:text-red-300' : percentage < 70 ? 'text-orange-700 dark:text-orange-300' : percentage < 80 ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>
        {Number.isInteger(grade) ? grade : Number(grade).toFixed(2)}
      </div>
    );
  } else if (hasSubmission) {
    if (dueDate && submittedAt && submittedAt.getTime() > dueDate.getTime()) {
      cellContent = (
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Late
        </div>
      );
    } else {
      cellContent = (
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Not Graded
        </div>
      );
    }
  } else if (assignment.isOfflineAssignment) {
    cellContent = (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Add Grade
      </div>
    );
  } else if (dueDate && now.getTime() > dueDate.getTime()) {
    cellContent = (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        0 (MA)
      </div>
    );
  } else {
    cellContent = (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        No Submission
      </div>
    );
  }

  const handleCellClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('input')) {
      return;
    }

    if ((isInstructor || isAdmin) && (hasSubmission || assignment.isOfflineAssignment)) {
      handleGradeCellClick(studentId, assignment._id, grade?.toString() || '');
    } else {
      if (assignment.isDiscussion) {
        navigate(`/courses/${courseId}/threads/${assignment._id}`);
      } else {
        navigate(`/assignments/${assignment._id}/view`);
      }
    }
  };

  const isEditing = editingGrade?.studentId === studentId && editingGrade?.assignmentId === assignment._id;
  const isSaving = savingGrade?.studentId === studentId && savingGrade?.assignmentId === assignment._id;

  return (
    <td
      className={`px-4 py-4 text-center whitespace-nowrap relative ${rowBg} ${cellBg} transition-all duration-150 ${hasSubmission || assignment.published || assignment.isOfflineAssignment ? 'cursor-pointer' : ''}`}
      onClick={handleCellClick}
    >
      {isEditing ? (
        <div className="relative">
          <input
            type="number"
            id={`grade-input-${studentId}-${assignment._id}`}
            name={`grade-${studentId}-${assignment._id}`}
            step="0.01"
            min="0"
            max={maxPoints}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleGradeUpdate(studentId, assignment._id, editingValue);
              } else if (e.key === 'Escape') {
                setEditingGrade(null);
                setGradeError('');
              }
            }}
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>
      ) : (
        <div
          className={`${(isInstructor || isAdmin) && hasSubmission ? 'cursor-pointer hover:scale-105 transform transition-transform duration-150' : ''} ${isSaving ? 'opacity-50' : ''}`}
        >
          {isSaving ? (
            <div className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </div>
          ) : null}
          {cellContent}
        </div>
      )}
    </td>
  );
};

export default GradebookCell;
























