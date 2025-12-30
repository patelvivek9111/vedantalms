import React from 'react';
import GradebookTable from './GradebookTable';
import GradebookMobileView from './GradebookMobileView';
import GradebookActions from './GradebookActions';

interface GradebookProps {
  courseId: string;
  course: any;
  gradebookData: {
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
    submissionMap?: { [key: string]: string };
  };
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  isInstructor: boolean;
  isAdmin: boolean;
  expandedStudents: Set<string>;
  setExpandedStudents: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingGrade: { studentId: string; assignmentId: string } | null;
  setEditingGrade: React.Dispatch<React.SetStateAction<{ studentId: string; assignmentId: string } | null>>;
  editingValue: string;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  savingGrade: { studentId: string; assignmentId: string } | null;
  gradeError: string;
  setGradeError: React.Dispatch<React.SetStateAction<string>>;
  handleGradeCellClick: (studentId: string, assignmentId: string, currentGrade: number | string) => void;
  handleGradeUpdate: (studentId: string, assignmentId: string, newGrade: string) => Promise<void>;
  exportGradebookCSV: () => void;
  handleOpenGradeScaleModal: () => void;
  handleOpenGroupModal: () => void;
  setShowGroupModal: React.Dispatch<React.SetStateAction<boolean>>;
  showGroupModal: boolean;
  editGroups: any[];
  handleGroupChange: (idx: number, field: string, value: any) => void;
  handleRemoveGroupRow: (idx: number) => void;
  handleAddGroupRow: () => void;
  handleResetToDefaults: () => void;
  handleSaveGroups: () => Promise<void>;
  savingGroups: boolean;
  groupError: string;
  setShowGradeScaleModal: React.Dispatch<React.SetStateAction<boolean>>;
  showGradeScaleModal: boolean;
  editGradeScale: any[];
  handleGradeScaleChange: (idx: number, field: string, value: any) => void;
  handleRemoveGradeScaleRow: (idx: number) => void;
  handleSaveGradeScale: () => Promise<void>;
  savingGradeScale: boolean;
  gradeScaleError: string;
  setEditGradeScale: React.Dispatch<React.SetStateAction<any[]>>;
  setGradeScaleError: React.Dispatch<React.SetStateAction<string>>;
}

const Gradebook: React.FC<GradebookProps> = ({
  courseId,
  course,
  gradebookData,
  submissionMap,
  studentSubmissions,
  isInstructor,
  isAdmin,
  expandedStudents,
  setExpandedStudents,
  editingGrade,
  setEditingGrade,
  editingValue,
  setEditingValue,
  savingGrade,
  gradeError,
  setGradeError,
  handleGradeCellClick,
  handleGradeUpdate,
  exportGradebookCSV,
  handleOpenGradeScaleModal,
  handleOpenGroupModal,
  setShowGroupModal,
  showGroupModal,
  editGroups,
  handleGroupChange,
  handleRemoveGroupRow,
  handleAddGroupRow,
  handleResetToDefaults,
  handleSaveGroups,
  savingGroups,
  groupError,
  setShowGradeScaleModal,
  showGradeScaleModal,
  editGradeScale,
  handleGradeScaleChange,
  handleRemoveGradeScaleRow,
  handleSaveGradeScale,
  savingGradeScale,
  gradeScaleError,
  setEditGradeScale,
  setGradeScaleError,
}) => {
  const { students, assignments, grades, submissionMap: gradebookSubmissionMap } = gradebookData;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 sm:p-3">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Gradebook</h2>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mt-1">Track student performance and manage grades</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 sm:px-4 py-2 border border-gray-200 dark:border-gray-700 text-center flex-1 sm:flex-none">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Students</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{students.length}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 sm:px-4 py-2 border border-gray-200 dark:border-gray-700 text-center flex-1 sm:flex-none">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Assignments</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{assignments.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Card View for Gradebook */}
      <GradebookMobileView
        courseId={courseId}
        course={course}
        students={students}
        assignments={assignments}
        grades={grades}
        submissionMap={gradebookSubmissionMap || submissionMap}
        expandedStudents={expandedStudents}
        setExpandedStudents={setExpandedStudents}
      />

      {/* Desktop Gradebook Table */}
      <GradebookTable
        courseId={courseId}
        course={course}
        students={students}
        assignments={assignments}
        grades={grades}
        submissionMap={gradebookSubmissionMap || submissionMap}
        studentSubmissions={studentSubmissions}
        isInstructor={isInstructor}
        isAdmin={isAdmin}
        editingGrade={editingGrade}
        setEditingGrade={setEditingGrade}
        editingValue={editingValue}
        setEditingValue={setEditingValue}
        savingGrade={savingGrade}
        gradeError={gradeError}
        setGradeError={setGradeError}
        handleGradeCellClick={handleGradeCellClick}
        handleGradeUpdate={handleGradeUpdate}
      />

      {/* Action Buttons */}
      <GradebookActions
        isInstructor={isInstructor}
        isAdmin={isAdmin}
        exportGradebookCSV={exportGradebookCSV}
        handleOpenGradeScaleModal={handleOpenGradeScaleModal}
      />

      {/* Assignment Group Weights Display & Edit Button */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2 flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Assignment Weights</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Configure how different assignment types contribute to final grades</p>
              </div>
            </div>
            {(isInstructor || isAdmin) && (
              <button
                onClick={handleOpenGroupModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Groups</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-3">
          {(course.groups || []).map((group: any, idx: number) => (
            <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.weight}%</div>
              </div>
            </div>
          ))}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-blue-900 dark:text-blue-100">Total</div>
              <div className="text-sm font-bold text-blue-900 dark:text-blue-100">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</div>
            </div>
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block p-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignment Group</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {(course.groups || []).map((group: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">{group.weight}%</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                  <td className="px-6 py-4 text-sm font-bold text-blue-900 dark:text-blue-100">Total</td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-900 dark:text-blue-100 text-right">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
            <h2 className="text-xl font-bold mb-4">Edit Assignment Groups</h2>
            <table className="min-w-full mb-4">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Group Name</th>
                  <th className="px-2 py-1 text-left">Weight (%)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {editGroups.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        id={`group-name-${idx}`}
                        name={`groupName-${idx}`}
                        value={row.name}
                        onChange={e => handleGroupChange(idx, 'name', e.target.value)}
                        className="border rounded px-2 py-1 w-32"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        id={`group-weight-${idx}`}
                        name={`groupWeight-${idx}`}
                        value={row.weight}
                        onChange={e => handleGroupChange(idx, 'weight', Number(e.target.value))}
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveGroupRow(idx)}
                        title="Remove row"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="mb-4 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              onClick={handleAddGroupRow}
            >
              + Add Group
            </button>
            <button
              className="mb-4 ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              onClick={handleResetToDefaults}
            >
              Reset to Defaults
            </button>
            {groupError && <div className="text-red-600 mb-2">{groupError}</div>}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => setShowGroupModal(false)}
                disabled={savingGroups}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSaveGroups}
                disabled={savingGroups}
              >
                {savingGroups ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Scale Modal */}
      {showGradeScaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
            <h2 className="text-xl font-bold mb-4">Edit Grade Scale</h2>
            <table className="min-w-full mb-4">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Letter</th>
                  <th className="px-2 py-1 text-left">Min %</th>
                  <th className="px-2 py-1 text-left">Max %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {editGradeScale.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        id={`grade-letter-${idx}`}
                        name={`gradeLetter-${idx}`}
                        value={row.letter}
                        onChange={e => handleGradeScaleChange(idx, 'letter', e.target.value)}
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        id={`grade-min-${idx}`}
                        name={`gradeMin-${idx}`}
                        value={row.min}
                        onChange={e => handleGradeScaleChange(idx, 'min', Number(e.target.value))}
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        id={`grade-max-${idx}`}
                        name={`gradeMax-${idx}`}
                        value={row.max}
                        onChange={e => handleGradeScaleChange(idx, 'max', Number(e.target.value))}
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveGradeScaleRow(idx)}
                        title="Remove row"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="mb-4 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              onClick={() => {
                if (editGradeScale.length === 0) {
                  setEditGradeScale([
                    { letter: 'A', min: 94, max: 100 },
                    { letter: 'A-', min: 90, max: 93 },
                    { letter: 'B+', min: 87, max: 89 },
                    { letter: 'B', min: 84, max: 86 },
                    { letter: 'B-', min: 80, max: 83 },
                    { letter: 'C+', min: 77, max: 79 },
                    { letter: 'C', min: 74, max: 76 },
                    { letter: 'D', min: 64, max: 73 },
                    { letter: 'F', min: 0, max: 63 }
                  ]);
                  setGradeScaleError('Auto-filled with default scale.');
                  return;
                }
                // Sort by min descending
                const sorted = [...editGradeScale].sort((a, b) => b.min - a.min);
                if (sorted.length > 0) {
                  sorted[0].max = 100;
                  for (let i = 1; i < sorted.length; i++) {
                    sorted[i].max = sorted[i - 1].min - 1;
                  }
                }
                setEditGradeScale(sorted);
                setGradeScaleError('Auto-fixed scale for contiguous whole numbers.');
              }}
            >
              Auto-Fix
            </button>
            {gradeScaleError && <div className="text-red-600 mb-2">{gradeScaleError}</div>}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => setShowGradeScaleModal(false)}
                disabled={savingGradeScale}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSaveGradeScale}
                disabled={savingGradeScale}
              >
                {savingGradeScale ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gradebook;

