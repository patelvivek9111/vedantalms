import React, { useState, useMemo, useCallback } from 'react';
import { getLetterGrade as getCourseLetterGrade, type ResolvedGradingPolicy } from '../../utils/gradeUtils';
import {
  computeStudentProjectedFinalPercent,
} from '../../utils/gradebookCompute';
import { normalizeMongoIdRef } from '../../utils/mongoId';
import { resolveStudentGradeRowDisplay } from '../grades/GradeStatusBadge';
import { discussionHasSubmissionForStudent, resolveStudentDiscussionSubmittedAt } from '../../utils/discussionGradeDisplay';
import { formatWhatIfCurrentFromRow } from '../../utils/whatIfCurrentDisplay';

interface WhatIfScoresProps {
  course: any;
  assignments: any[];
  currentGrades: any;
  studentId: string;
  submissionMap?: { [key: string]: string };
  studentSubmissions?: any[];
  resolvedGradingPolicy?: ResolvedGradingPolicy | null;
  onSaveWhatIf: (scores: { [key: string]: number }) => void;
  onClose: () => void;
}

function normalizeScoreMap(scores: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[String(key)] = value;
    }
  }
  return out;
}

const WhatIfScores: React.FC<WhatIfScoresProps> = ({
  course,
  assignments,
  currentGrades,
  studentId,
  submissionMap = {},
  studentSubmissions = [],
  resolvedGradingPolicy = null,
  onSaveWhatIf,
  onClose,
}) => {
  const sid = String(studentId);

  const [whatIfScores, setWhatIfScores] = useState<Record<string, number>>(() =>
    normalizeScoreMap((currentGrades[sid] || currentGrades[studentId] || {}) as Record<string, unknown>)
  );

  const missingMode = useMemo(() => {
    return (
      resolvedGradingPolicy?.missingAssignment?.mode ??
      course?.gradingPolicy?.missingAssignment?.mode ??
      'count_as_zero'
    );
  }, [course, resolvedGradingPolicy]);

  const calculateProjectedGrade = (scores: Record<string, number>) => {
    const grades = { [sid]: normalizeScoreMap(scores) };
    return computeStudentProjectedFinalPercent(
      sid,
      course,
      assignments,
      grades,
      submissionMap,
      studentSubmissions,
      resolvedGradingPolicy
    );
  };

  const handleScoreChange = (assignmentId: string, value: string) => {
    const aid = String(assignmentId);
    if (value === '') {
      setWhatIfScores((prev) => {
        const next = { ...prev };
        delete next[aid];
        return next;
      });
      return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setWhatIfScores((prev) => ({
        ...prev,
        [aid]: numValue,
      }));
    }
  };

  const whatIfInputValue = (assignmentId: string) => {
    const score = whatIfScores[String(assignmentId)];
    return score === undefined || score === null ? '' : score;
  };

  const currentScoreDisplay = useCallback(
    (assignment: any) => {
      const aid = String(assignment._id);
      const submissionKey = `${sid}_${aid}`;
      const submission = studentSubmissions.find(
        (s) => s.assignment && normalizeMongoIdRef(s.assignment._id) === normalizeMongoIdRef(assignment._id)
      );
      const rawGrade =
        currentGrades[sid]?.[aid] ?? currentGrades[studentId]?.[assignment._id];
      const hasSubmission = assignment.isDiscussion
        ? discussionHasSubmissionForStudent(assignment, sid)
        : Boolean(submissionMap[submissionKey]);
      const row = resolveStudentGradeRowDisplay({
        assignment,
        submission: submission ?? null,
        grade: typeof rawGrade === 'number' ? rawGrade : undefined,
        studentId: sid,
        hasSubmission,
        submittedAt: assignment.isDiscussion
          ? resolveStudentDiscussionSubmittedAt(assignment, sid)
          : submission?.submittedAt
            ? new Date(submission.submittedAt)
            : undefined,
        missingAssignmentMode: missingMode,
      });

      return formatWhatIfCurrentFromRow(row, missingMode);
    },
    [sid, studentId, currentGrades, submissionMap, studentSubmissions, missingMode]
  );

  const projectedGrade = calculateProjectedGrade(whatIfScores);
  const projectedLetterGrade = getCourseLetterGrade(projectedGrade, course?.gradeScale);

  const renderAssignmentRow = (assignment: any, mobile = false) => {
    const aid = String(assignment._id);
    const maxPoints =
      assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) ||
      assignment.totalPoints ||
      0;
    const currentLabel = currentScoreDisplay(assignment);

    if (mobile) {
      return (
        <div key={aid} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 font-medium text-gray-900 dark:text-gray-100">{assignment.title}</div>
          {assignment.group && (
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">{assignment.group}</div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Current</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{currentLabel}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">What-If</div>
              <input
                type="number"
                id={`what-if-score-mobile-${aid}`}
                min="0"
                max={maxPoints}
                step="0.01"
                value={whatIfInputValue(aid)}
                onChange={(e) => handleScoreChange(aid, e.target.value)}
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
      <tr key={aid} className="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td className="px-2 py-2 text-xs text-gray-800 dark:text-gray-200 sm:px-4 sm:text-sm">{assignment.title}</td>
        <td className="hidden px-2 py-2 text-xs text-gray-600 dark:text-gray-400 sm:table-cell sm:px-4 sm:text-sm">{assignment.group || 'Ungrouped'}</td>
        <td className="px-2 py-2 text-center text-xs text-gray-600 dark:text-gray-400 sm:px-4 sm:text-sm">
          {currentLabel}
        </td>
        <td className="px-2 py-2 text-center text-xs sm:px-4 sm:text-sm">
          <input
            type="number"
            id={`what-if-score-${aid}`}
            min="0"
            max={maxPoints}
            step="0.01"
            value={whatIfInputValue(aid)}
            onChange={(e) => handleScoreChange(aid, e.target.value)}
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
            Simulate scores against your <strong>projected final grade</strong> (all published
            assignments; ungraded work counts as zero). This matches the total when you uncheck
            &ldquo;Calculate based only on graded assignments&rdquo; on My Grades.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 rounded-lg border bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20 sm:mb-6 sm:p-4">
            <div className="text-base font-semibold text-blue-800 dark:text-blue-200 sm:text-lg">
              Projected Final: {projectedGrade.toFixed(2)}% [{projectedLetterGrade}]
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
