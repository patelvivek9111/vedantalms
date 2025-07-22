import React, { useState, useEffect } from 'react';
import { calculateFinalGradeWithWeightedGroups, getLetterGrade } from '../utils/gradeUtils';

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

  // Initialize what-if scores with current grades
  useEffect(() => {
    const initialScores = { ...currentGrades[studentId] || {} };
    setWhatIfScores(initialScores);
  }, [currentGrades, studentId]);

  // Calculate weighted grade based on what-if scores using the new function
  const calculateWeightedGrade = (scores: { [key: string]: number }) => {
    // Create a grades object in the format expected by the function
    const grades = { [studentId]: scores };
    return calculateFinalGradeWithWeightedGroups(studentId, course, assignments, grades);
  };

  // Get letter grade from percentage
  const getLetterGrade = (percent: number) => {
    const scale = course.gradeScale || [
      { letter: 'A', min: 94, max: 100 },
      { letter: 'A-', min: 90, max: 93 },
      { letter: 'B+', min: 87, max: 89 },
      { letter: 'B', min: 84, max: 86 },
      { letter: 'B-', min: 80, max: 83 },
      { letter: 'C+', min: 77, max: 79 },
      { letter: 'C', min: 74, max: 76 },
      { letter: 'D', min: 64, max: 73 },
      { letter: 'F', min: 0, max: 63 }
    ];
    const found = scale.find((s: any) => percent >= s.min && percent <= s.max);
    return found ? found.letter : 'F';
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
  const currentLetterGrade = getLetterGrade(currentWeightedGrade);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">What-If Scores</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Simulate different scores to see how they affect your final grade
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Current Grade Display */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="text-lg font-semibold text-blue-800">
              Projected Grade: {currentWeightedGrade.toFixed(2)}% [{currentLetterGrade}]
            </div>
          </div>

          {/* Assignment Scores Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Assignment</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Group</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">Current Score</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">What-If Score</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">Max Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((assignment) => {
                  const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                  const currentScore = currentGrades[studentId]?.[assignment._id];
                  return (
                    <tr key={assignment._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-800">{assignment.title}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{assignment.group || 'Ungrouped'}</td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600">
                        {typeof currentScore === 'number' ? currentScore : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-center">
                        <input
                          type="number"
                          id={`what-if-score-${assignment._id}`}
                          name={`whatIfScore-${assignment._id}`}
                          min="0"
                          max={maxPoints}
                          step="0.01"
                          value={whatIfScores[assignment._id] === 0 ? '' : whatIfScores[assignment._id] ?? ''}
                          onFocus={e => {
                            if (whatIfScores[assignment._id] === 0) {
                              e.target.value = '';
                            }
                          }}
                          onChange={(e) => handleScoreChange(assignment._id, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600">{maxPoints}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatIfScores; 