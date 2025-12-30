import React from 'react';

interface GradebookActionsProps {
  isInstructor: boolean;
  isAdmin: boolean;
  exportGradebookCSV: () => void;
  handleOpenGradeScaleModal: () => void;
}

const GradebookActions: React.FC<GradebookActionsProps> = ({
  isInstructor,
  isAdmin,
  exportGradebookCSV,
  handleOpenGradeScaleModal,
}) => {
  if (!isInstructor && !isAdmin) {
    return null;
  }

  return (
    <div className="flex justify-end space-x-4">
      <div className="flex space-x-3">
        <button
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          onClick={exportGradebookCSV}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
        <button
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          onClick={handleOpenGradeScaleModal}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Grade Scale
        </button>
      </div>
    </div>
  );
};

export default GradebookActions;
























