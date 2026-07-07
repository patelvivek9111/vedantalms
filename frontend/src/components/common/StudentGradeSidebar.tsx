import React, { useMemo, useState } from 'react';
import WhatIfScores from './WhatIfScores';
import { getLetterGrade, type ResolvedGradingPolicy } from '../../utils/gradeUtils';
import {
  computeStudentCurrentPercent,
  computeStudentProjectedFinalPercent,
  normalizeResolvedPolicyForCourse,
} from '../../utils/gradebookCompute';

interface StudentGradeSidebarProps {
  course: any;
  studentId: string;
  grades: any;
  assignments: any[];
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  backendTotalGrade?: number | null;
  backendLetterGrade?: string | null;
  backendFinalGrade?: number | null;
  backendFinalLetterGrade?: string | null;
  resolvedGradingPolicy?: ResolvedGradingPolicy | null;
  /** When false, do not show a client-calculated total (avoids flash before the server total arrives). */
  summaryReady?: boolean;
}

const GRADE_DIFF_EPSILON = 0.005;

const StudentGradeSidebar: React.FC<StudentGradeSidebarProps> = ({
  course,
  studentId,
  grades,
  assignments,
  submissionMap,
  studentSubmissions,
  backendTotalGrade,
  backendLetterGrade,
  backendFinalGrade,
  backendFinalLetterGrade,
  resolvedGradingPolicy = null,
  summaryReady = true,
}) => {
  const [showWhatIfScores, setShowWhatIfScores] = useState(false);
  /** Canvas-style: checked = current grade (graded assignments only). */
  const [gradedOnly, setGradedOnly] = useState(true);

  const effectiveGradingPolicy = useMemo(
    () => normalizeResolvedPolicyForCourse(course, resolvedGradingPolicy, assignments),
    [course, resolvedGradingPolicy, assignments]
  );

  const clientCurrent = useMemo(() => {
    if (!summaryReady || !course?.groups?.length) return null;
    return computeStudentCurrentPercent(
      studentId,
      course,
      assignments,
      grades,
      submissionMap,
      studentSubmissions,
      effectiveGradingPolicy
    );
  }, [
    summaryReady,
    studentId,
    course,
    assignments,
    grades,
    submissionMap,
    studentSubmissions,
    effectiveGradingPolicy,
  ]);

  const clientFinal = useMemo(() => {
    if (!summaryReady || !course?.groups?.length) return null;
    return computeStudentProjectedFinalPercent(
      studentId,
      course,
      assignments,
      grades,
      submissionMap,
      studentSubmissions,
      effectiveGradingPolicy
    );
  }, [
    summaryReady,
    studentId,
    course,
    assignments,
    grades,
    submissionMap,
    studentSubmissions,
    effectiveGradingPolicy,
  ]);

  const currentPercent =
    backendTotalGrade ?? clientCurrent ?? null;
  // Prefer client final — stale API cache can return final === current.
  const finalPercent = clientFinal ?? backendFinalGrade ?? null;

  const currentLetter =
    currentPercent == null
      ? '…'
      : backendLetterGrade || getLetterGrade(currentPercent, course?.gradeScale);
  const finalLetter =
    finalPercent == null
      ? null
      : backendFinalLetterGrade || getLetterGrade(finalPercent, course?.gradeScale);

  const canToggleGradeMode =
    summaryReady &&
    currentPercent != null &&
    finalPercent != null &&
    Math.abs(finalPercent - currentPercent) > GRADE_DIFF_EPSILON;

  const displayPercent = canToggleGradeMode && !gradedOnly ? finalPercent : currentPercent;
  const displayLetter =
    canToggleGradeMode && !gradedOnly
      ? finalLetter || getLetterGrade(finalPercent ?? 0, course?.gradeScale)
      : currentLetter;

  return (
    <div className="w-full md:w-64 flex-shrink-0">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4 border border-gray-200 dark:border-gray-700">
        <div className="space-y-2 sm:space-y-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {canToggleGradeMode && !gradedOnly ? 'Final grade' : 'Current grade'}
            </div>
            <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
              {!summaryReady ? (
                <span className="text-gray-400 dark:text-gray-500 font-medium animate-pulse">
                  Loading…
                </span>
              ) : (
                <>
                  {(displayPercent ?? 0).toFixed(2)}% [{displayLetter}]
                </>
              )}
            </div>
          </div>
          {canToggleGradeMode && (
            <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
              <input
                type="checkbox"
                checked={gradedOnly}
                onChange={(e) => setGradedOnly(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <span>
                Show current grade only
                <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-500">
                  Uncheck to view final grade (all groups at full weight)
                </span>
              </span>
            </label>
          )}
        </div>
        <div className="space-y-2 mt-3 sm:mt-4">
          <button
            type="button"
            onClick={() => setShowWhatIfScores(true)}
            className="min-h-[44px] w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-200 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            What-If Scores
          </button>
        </div>

        {course.groups && course.groups.length > 0 && (
          <div className="mt-3 sm:mt-4">
            <div className="font-semibold mb-2 text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Assignment Weighting</div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-800 sm:p-3">
              <div className="space-y-2 md:hidden">
                {(course.groups || []).map((group: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{group.name}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.weight}%</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border-2 border-gray-300 bg-white px-3 py-2 font-bold dark:border-gray-600 dark:bg-gray-900">
                  <span className="text-sm text-gray-900 dark:text-gray-100">Total</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%
                  </span>
                </div>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-1 py-1 text-left font-medium text-gray-700 dark:text-gray-300 sm:px-2">Group</th>
                      <th className="px-1 py-1 text-right font-medium text-gray-700 dark:text-gray-300 sm:px-2">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(course.groups || []).map((group: any, idx: number) => (
                      <tr key={idx} className="transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <td className="px-1 py-1 text-left text-gray-600 dark:text-gray-400 sm:px-2">{group.name}</td>
                        <td className="px-1 py-1 text-right font-semibold text-gray-900 dark:text-gray-100 sm:px-2">{group.weight}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 font-bold dark:border-gray-600">
                      <td className="px-1 py-1 text-left text-gray-900 dark:text-gray-100 sm:px-2">Total</td>
                      <td className="px-1 py-1 text-right text-gray-900 dark:text-gray-100 sm:px-2">
                        {(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      {showWhatIfScores && (
        <WhatIfScores
          course={course}
          assignments={assignments}
          currentGrades={grades}
          studentId={studentId}
          submissionMap={submissionMap}
          studentSubmissions={studentSubmissions}
          resolvedGradingPolicy={resolvedGradingPolicy}
          onSaveWhatIf={() => {}}
          onClose={() => setShowWhatIfScores(false)}
        />
      )}
    </div>
  );
};

export default StudentGradeSidebar;
