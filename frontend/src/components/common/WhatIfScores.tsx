import React, { useState, useEffect } from 'react';
import {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade as getCourseLetterGrade,
} from '../../utils/gradeUtils';

interface WhatIfScoresProps {
  course: any;
  assignments: any[];
  currentGrades: any;
  studentId: string;
  onSaveWhatIf: (scores: { [key: string]: number }) => void;
  onClose: () => void;
}

const WhatIfScores: React.FC<WhatIfScoresProps> = ({
  course,
  assignments,
  currentGrades,
  studentId,
  onSaveWhatIf,
  onClose
}) => {
  const [whatIfScores, setWhatIfScores] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const initialScores = { ...currentGrades[studentId] || {} };
    setWhatIfScores(initialScores);
  }, [currentGrades, studentId]);

  const calculateWeightedGrade = (scores: { [key: string]: number }) => {
    const grades = { [studentId]: scores };
    return calculateFinalGradeWithWeightedGroups(studentId, course, assignments, grades, {});
  };

  const handleScoreChange = (assignmentId: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue)) {
      setWhatIfScores(prev => ({
        ...prev,
        [assignmentId]: numValue
      }));
    }
  };

  const currentWeightedGrade = calculateWeightedGrade(whatIfScores);
  const currentLetterGrade = getCourseLetterGrade(currentWeightedGrade, course?.gradeScale);

  const renderAssignmentRow = (assignment: any, mobile = false) => {
    const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
    const currentScore = currentGrades[studentId]?.[assignment._id];

    if (mobile) {
      return (
        <div key={assignment._id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 font-medium text-gray-900 dark:text-gray-100">{assignment.title}</div>
          {assignment.group && (
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">{assignment.group}</div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Current</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {typeof currentScore === 'number' ? currentScore : '-'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">What-If</div>
              <input
                type="number"
                id={`what-if-score-mobile-${assignment._id}`}
                min="0"
                max={maxPoints}
                step="0.01"
                value={whatIfScores[assignment._id] === 0 ? '' : whatIfScores[assignment._id] ?? ''}
                onChange={(e) => handleScoreChange(assignment._id, e.target.value)}
                className="mx-auto mt-1 min-h-[44px] w-full max-w-[5rem] rounded border border-gray-300 bg-white px-2 py-2 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Max</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{maxPoints}</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <tr key={assignment._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td className="px-2 py-2 text-xs text-gray-800 dark:text-gray-200 sm:px-4 sm:text-sm">{assignment.title}</td>
        <td className="hidden px-2 py-2 text-xs text-gray-600 dark:text-gray-400 sm:table-cell sm:px-4 sm:text-sm">{assignment.group || 'Ungrouped'}</td>
        <td className="px-2 py-2 text-center text-xs text-gray-600 dark:text-gray-400 sm:px-4 sm:text-sm">
          {typeof currentScore === 'number' ? currentScore : '-'}
        </td>
        <td className="px-2 py-2 text-center text-xs sm:px-4 sm:text-sm">
          <input
            type="number"
            id={`what-if-score-${assignment._id}`}
            min="0"
            max={maxPoints}
            step="0.01"
            value={whatIfScores[assignment._id] === 0 ? '' : whatIfScores[assignment._id] ?? ''}
            onChange={(e) => handleScoreChange(assignment._id, e.target.value)}
            className="mx-auto min-h-[44px] w-20 rounded border border-gray-300 bg-white px-2 py-2 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </td>
        <td className="px-2 py-2 text-center text-xs text-gray-600 dark:text-gray-400 sm:px-4 sm:text-sm">{maxPoints}</td>
      </tr>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:max-h-[90vh] sm:rounded-lg">
        <div className="flex-shrink-0 border-b p-4 dark:border-gray-700 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 sm:text-xl">What-If Scores</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close what-if scores"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
            Simulate different scores to see how they affect your final grade
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 rounded-lg border bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20 sm:mb-6 sm:p-4">
            <div className="text-base font-semibold text-blue-800 dark:text-blue-200 sm:text-lg">
              Projected Grade: {currentWeightedGrade.toFixed(2)}% [{currentLetterGrade}]
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {assignments.map((assignment) => renderAssignmentRow(assignment, true))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full border border-gray-200 dark:border-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Assignment</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">Group</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">Current</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">What-If</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {assignments.map((assignment) => renderAssignmentRow(assignment))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900 sm:gap-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatIfScores;
