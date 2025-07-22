import React, { useState } from 'react';
import WhatIfScores from './WhatIfScores';
import { getWeightedGradeForStudent, getLetterGrade, calculateFinalGradeWithWeightedGroups } from '../utils/gradeUtils';

interface StudentGradeSidebarProps {
  course: any;
  studentId: string;
  grades: any;
  assignments: any[];
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  backendTotalGrade?: number | null;
  backendLetterGrade?: string | null;
}

const StudentGradeSidebar: React.FC<StudentGradeSidebarProps> = ({
  course,
  studentId,
  grades,
  assignments,
  submissionMap,
  studentSubmissions,
  backendTotalGrade,
  backendLetterGrade,
}) => {
  const [showWhatIfScores, setShowWhatIfScores] = useState(false);

  // Use backend grade if available, otherwise fall back to frontend calculation
  const weightedPercent = backendTotalGrade !== null ? backendTotalGrade : calculateFinalGradeWithWeightedGroups(studentId, course, assignments, grades);
  const letter = backendLetterGrade || getLetterGrade(weightedPercent || 0, course?.gradeScale);

  return (
    <div className="w-full md:w-64 flex-shrink-0">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-4 border border-gray-200 dark:border-gray-700">
        <div className="text-lg font-bold mb-3 text-gray-900 dark:text-gray-100">
          Total: {(weightedPercent || 0).toFixed(2)}% [{letter}]
        </div>
        <div className="space-y-2">
          <button 
            onClick={() => setShowWhatIfScores(true)}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 text-sm font-medium"
          >
            What-If Scores
          </button>
        </div>
        
        {course.groups && course.groups.length > 0 && (
          <div className="mt-4">
            <div className="font-semibold mb-2 text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Assignment Weighting</div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-1 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Group</th>
                    <th className="px-1 py-1 text-right font-medium text-gray-700 dark:text-gray-300">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(course.groups || []).map((group: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-1 py-1 text-left text-gray-600 dark:text-gray-400">{group.name}</td>
                      <td className="px-1 py-1 text-right font-semibold text-gray-900 dark:text-gray-100">{group.weight}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                    <td className="px-1 py-1 text-left text-gray-900 dark:text-gray-100">Total</td>
                    <td className="px-1 py-1 text-right text-gray-900 dark:text-gray-100">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {/* What-If Scores Modal */}
      {showWhatIfScores && (
        <WhatIfScores
          course={course}
          assignments={assignments}
          currentGrades={grades}
          studentId={studentId}
          onSaveWhatIf={(scores) => {
            // Here you would typically save the what-if scores to the backend
            console.log('Saving what-if scores:', scores);
          }}
          onClose={() => setShowWhatIfScores(false)}
        />
      )}
    </div>
  );
};

export default StudentGradeSidebar; 