import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentGradeSidebar from '../common/StudentGradeSidebar';
import { computeAssignmentGroupStats, normalizeResolvedPolicyForCourse } from '../../utils/gradebookCompute';
import {
  buildStudentVisibleGradesMap,
  discussionHasSubmissionForStudent,
  resolveStudentDiscussionEarnedScore,
  resolveStudentDiscussionFeedback,
  resolveStudentDiscussionSubmittedAt,
} from '../../utils/discussionGradeDisplay';
import { normalizeMongoIdRef } from '../../utils/mongoId';
import {
  GradeStatusBadge,
  resolveStudentGradeRowDisplay,
  type StudentGradeRowDisplay,
} from './GradeStatusBadge';

interface StudentGradesViewProps {
  course: any;
  modules: any[];
  user: any;
  studentGroupAssignments: any[];
  studentDiscussions: any[];
  gradebookData: {
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  };
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  studentTotalGrade: number | null;
  studentLetterGrade: string | null;
  studentFinalGrade?: number | null;
  studentFinalLetterGrade?: string | null;
  studentGradeSummaryReady: boolean;
  resolvedGradingPolicy?: import('../../utils/gradeUtils').ResolvedGradingPolicy | null;
  gradingPolicyLoading?: boolean;
}

function normalizeAssignmentCategoryName(v: unknown): string {
  return String(v ?? '').trim();
}

function getStudentGradeItemPath(courseId: string, assignment: any): string {
  if (assignment.isDiscussion) {
    return `/courses/${courseId}/threads/${assignment._id}`;
  }
  return `/assignments/${assignment._id}/view`;
}

function assignmentMaxPoints(assignment: any): number {
  return (
    assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) ||
    assignment.totalPoints ||
    0
  );
}

function formatDueDate(dueDate: unknown): string {
  if (!dueDate) return '-';
  return new Date(dueDate as string | Date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type StudentAssignmentRowModel = {
  assignment: any;
  rowDisplay: StudentGradeRowDisplay;
  maxPoints: number;
  assignmentFeedback: string;
  hasSubmission: boolean;
};

function buildStudentAssignmentRowModel(
  assignment: any,
  studentId: string,
  gradebookGrades: StudentGradesViewProps['gradebookData']['grades'],
  submissionMap: StudentGradesViewProps['submissionMap'],
  studentSubmissions: any[],
  missingAssignmentMode?: 'count_as_zero' | 'exclude_until_graded'
): StudentAssignmentRowModel {
  const sid = String(studentId);
  const submissionKey = `${sid}_${String(assignment._id)}`;
  const submission = studentSubmissions.find(
    (s) => s.assignment && normalizeMongoIdRef(s.assignment._id) === normalizeMongoIdRef(assignment._id)
  );

  const initialGrade = assignment.isDiscussion
    ? resolveStudentDiscussionEarnedScore(assignment, sid)
    : gradebookGrades[sid]?.[String(assignment._id)];

  const hasSubmission = assignment.isDiscussion
    ? discussionHasSubmissionForStudent(assignment, sid)
    : Boolean(submissionMap[submissionKey]);

  const rowDisplay = resolveStudentGradeRowDisplay({
    assignment,
    submission,
    grade: initialGrade,
    studentId: sid,
    hasSubmission,
    submittedAt: assignment.isDiscussion
      ? resolveStudentDiscussionSubmittedAt(assignment, sid)
      : submission?.submittedAt
        ? new Date(submission.submittedAt)
        : undefined,
    missingAssignmentMode,
  });

  const assignmentFeedback = assignment.isDiscussion
    ? resolveStudentDiscussionFeedback(assignment, sid)
    : typeof submission?.feedback === 'string'
      ? submission.feedback.trim()
      : '';

  return {
    assignment,
    rowDisplay,
    maxPoints: assignmentMaxPoints(assignment),
    assignmentFeedback,
    hasSubmission,
  };
}

function renderScoreDisplay(rowDisplay: StudentGradeRowDisplay, maxPoints: number): React.ReactNode {
  if (rowDisplay.scoreHidden) {
    return <span className="font-semibold text-gray-900 dark:text-gray-100">{rowDisplay.scoreCell}</span>;
  }
  return (
    <>
      <span className="font-semibold text-gray-900 dark:text-gray-100">{rowDisplay.scoreCell}</span>
      <span className="text-gray-500 dark:text-gray-400"> / {maxPoints}</span>
    </>
  );
}

const StudentGradesView: React.FC<StudentGradesViewProps> = ({
  course,
  modules,
  user,
  studentGroupAssignments,
  studentDiscussions,
  gradebookData,
  submissionMap,
  studentSubmissions,
  studentTotalGrade,
  studentLetterGrade,
  studentFinalGrade,
  studentFinalLetterGrade,
  studentGradeSummaryReady,
  resolvedGradingPolicy = null,
  gradingPolicyLoading = false,
}) => {
  const navigate = useNavigate();

  if (!user?._id) {
    return (
      <div className="text-center py-8 text-gray-500">
        {!user ? 'User not found.' : 'User ID not found.'}
      </div>
    );
  }

  const studentId = String(user._id);

  const studentAssignments = useMemo(() => {
    const moduleAssignments = modules.flatMap((module: any) =>
      (module.assignments || []).map((assignment: any) => {
        const dueDateRaw =
          assignment.dueDate || assignment.due_date || assignment.discussionDueDate || null;
        return {
          ...assignment,
          moduleTitle: module.title,
          isDiscussion: false,
          dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
        };
      })
    );

    const groupAssignments = studentGroupAssignments.map((assignment: any) => ({
      ...assignment,
      moduleTitle: 'Group Assignments',
      isDiscussion: false,
    }));

    const gradedDiscussions = studentDiscussions.map((discussion: any) => ({
      _id: discussion._id,
      title: discussion.title,
      totalPoints: discussion.totalPoints,
      group: discussion.group,
      moduleTitle: 'Discussions',
      isDiscussion: true,
      grade: discussion.grade ?? null,
      feedback: discussion.feedback ?? null,
      gradeVisibility: discussion.gradeVisibility,
      discussionReleaseMode: discussion.discussionReleaseMode,
      gradesReleasedAt: discussion.gradesReleasedAt,
      gradeHidden: discussion.gradeHidden,
      studentGrades: discussion.studentGrades || [],
      dueDate: discussion.dueDate || null,
      hasSubmitted: discussion.hasSubmitted || discussion.hasPosted || false,
      hasPosted: discussion.hasPosted || discussion.hasSubmitted || false,
      studentReplyCreatedAt: discussion.studentReplyCreatedAt ?? null,
      replies: discussion.replies || [],
      published: discussion.published !== false,
    }));

    return [...moduleAssignments, ...groupAssignments, ...gradedDiscussions];
  }, [modules, studentGroupAssignments, studentDiscussions]);

  const effectiveGradingPolicy = useMemo(
    () => normalizeResolvedPolicyForCourse(course, resolvedGradingPolicy, studentAssignments),
    [course, resolvedGradingPolicy, studentAssignments]
  );

  const missingAssignmentMode =
    effectiveGradingPolicy?.missingAssignment?.mode ?? 'count_as_zero';

  const gradingPolicyReady = !gradingPolicyLoading && Boolean(effectiveGradingPolicy);

  const studentVisibleGrades = useMemo(
    () => buildStudentVisibleGradesMap(studentId, studentAssignments, gradebookData.grades),
    [studentId, studentAssignments, gradebookData.grades]
  );

  const assignmentRows = useMemo(
    () =>
      studentAssignments.map((assignment) =>
        buildStudentAssignmentRowModel(
          assignment,
          studentId,
          studentVisibleGrades,
          submissionMap,
          studentSubmissions,
          gradingPolicyReady ? missingAssignmentMode : undefined
        )
      ),
    [
      studentAssignments,
      studentId,
      studentVisibleGrades,
      submissionMap,
      studentSubmissions,
      gradingPolicyReady,
      missingAssignmentMode,
    ]
  );

  const courseGroupsList = course.groups || [];
  const courseGroupNameSet = new Set(
    courseGroupsList.map((g: any) => normalizeAssignmentCategoryName(g.name)).filter(Boolean)
  );

  const assignmentsForNamedGroup = (groupName: string) =>
    studentAssignments.filter(
      (a: any) => normalizeAssignmentCategoryName(a.group) === normalizeAssignmentCategoryName(groupName)
    );

  const uncategorizedAssignmentsForSummary = studentAssignments.filter((a: any) => {
    const g = normalizeAssignmentCategoryName(a.group);
    return !g || !courseGroupNameSet.has(g);
  });

  type AssignmentGroupSummaryRow = {
    key: string;
    displayName: string;
    weightPercent: number | null;
    assignments: any[];
  };

  const assignmentGroupSummaryRows: AssignmentGroupSummaryRow[] = [
    ...courseGroupsList.map((g: any) => ({
      key: `cat-${normalizeAssignmentCategoryName(g.name) || 'row'}`,
      displayName: g.name,
      weightPercent: typeof g.weight === 'number' ? g.weight : Number(g.weight),
      assignments: assignmentsForNamedGroup(g.name),
    })),
    ...(uncategorizedAssignmentsForSummary.length > 0
      ? [
          {
            key: 'other-uncategorized',
            displayName: 'Other (uncategorized)',
            weightPercent: null,
            assignments: uncategorizedAssignmentsForSummary,
          },
        ]
      : []),
  ];

  const openAssignment = (assignment: any) => {
    navigate(getStudentGradeItemPath(course._id, assignment));
  };

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">My Grades</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Track your academic progress</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                Totals follow your course grading rules. Contact your instructor if a score looks incorrect.
              </p>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {assignmentRows.map(({ assignment, rowDisplay, maxPoints, assignmentFeedback }, idx) => (
              <div
                key={`student-assignment-mobile-${assignment._id}-${idx}`}
                role="button"
                tabIndex={0}
                onClick={() => openAssignment(assignment)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openAssignment(assignment);
                  }
                }}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                aria-label={`Open ${assignment.title}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">
                      {assignment.title}
                    </h3>
                    {assignment.group ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{assignment.group}</div>
                    ) : null}
                  </div>
                  {rowDisplay.showStatusBadge ? <GradeStatusBadge status={rowDisplay.status} /> : null}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Due Date</div>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {formatDueDate(assignment.dueDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score</div>
                    <div className="text-sm">{renderScoreDisplay(rowDisplay, maxPoints)}</div>
                  </div>
                </div>
                {assignmentFeedback ? (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150 text-sm font-medium flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssignment(assignment);
                      }}
                    >
                      <span className="mr-2">💬</span>
                      View Feedback
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Due
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Out of
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assignmentRows.map(({ assignment, rowDisplay, maxPoints, assignmentFeedback }, idx) => (
                  <tr
                    key={`student-assignment-${assignment._id}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 cursor-pointer"
                    onClick={() => openAssignment(assignment)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</div>
                      {assignment.group ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{assignment.group}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {formatDueDate(assignment.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {rowDisplay.showStatusBadge ? (
                        <GradeStatusBadge status={rowDisplay.status} />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {rowDisplay.scoreCell}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400">
                      {maxPoints}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignmentFeedback ? (
                        <button
                          type="button"
                          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150"
                          title="View feedback"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssignment(assignment);
                          }}
                        >
                          <span role="img" aria-label="Comment" className="text-sm">
                            💬
                          </span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {assignmentGroupSummaryRows.length > 0 ? (
          <div className="mt-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Performance by Assignment Group
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your scores broken down by weighted categories. Categories marked — are not in your total yet
                    (submitted work awaiting grades, or nothing graded in that group); their weight is redistributed.
                  </p>
                </div>
              </div>

              {!gradingPolicyLoading && !effectiveGradingPolicy ? (
                <div className="py-6 text-center text-sm text-amber-700 dark:text-amber-300">
                  Could not load grading policy. Refresh the page or contact your instructor.
                </div>
              ) : !gradingPolicyReady ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading category totals…
                </div>
              ) : (
                <>
              <div className="md:hidden space-y-3">
                {assignmentGroupSummaryRows.map((row) => {
                  const groupStats = computeAssignmentGroupStats(
                    studentId,
                    row.displayName,
                    row.assignments,
                    course,
                    studentVisibleGrades,
                    submissionMap,
                    studentSubmissions,
                    effectiveGradingPolicy
                  );
                  const { totalEarned, totalPossible, includedCount, totalInGroup, contributesToGrade, percentage } =
                    groupStats;
                  const percentageColor =
                    percentage == null
                      ? 'text-gray-500 dark:text-gray-400'
                      : percentage >= 90
                        ? 'text-green-600 dark:text-green-400'
                        : percentage >= 80
                          ? 'text-blue-600 dark:text-blue-400'
                          : percentage >= 70
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400';

                  return (
                    <div
                      key={row.key}
                      className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{row.displayName}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assignments</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {includedCount}/{totalInGroup}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weight</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {row.weightPercent != null && !Number.isNaN(row.weightPercent)
                              ? `${row.weightPercent}%`
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Points Earned</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {contributesToGrade ? totalEarned.toFixed(1) : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Points</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {contributesToGrade ? totalPossible.toFixed(1) : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Percentage</div>
                        <div className={`text-lg font-bold ${percentageColor}`}>
                          {percentage != null ? `${percentage.toFixed(1)}%` : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Assignment Group
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Assignments
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Points Earned
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Total Points
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Percentage
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Weight
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {assignmentGroupSummaryRows.map((row) => {
                      const groupStats = computeAssignmentGroupStats(
                        studentId,
                        row.displayName,
                        row.assignments,
                        course,
                        studentVisibleGrades,
                        submissionMap,
                        studentSubmissions,
                        effectiveGradingPolicy
                      );
                      const { totalEarned, totalPossible, includedCount, totalInGroup, contributesToGrade, percentage } =
                        groupStats;
                      const percentageColor =
                        percentage == null
                          ? 'text-gray-500 dark:text-gray-400'
                          : percentage >= 90
                            ? 'text-green-600 dark:text-green-400'
                            : percentage >= 80
                              ? 'text-blue-600 dark:text-blue-400'
                              : percentage >= 70
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400';

                      return (
                        <tr
                          key={row.key}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{row.displayName}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                            {includedCount}/{totalInGroup}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {contributesToGrade ? totalEarned.toFixed(1) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                            {contributesToGrade ? totalPossible.toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${percentageColor}`}>
                              {percentage != null ? `${percentage.toFixed(1)}%` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                            {row.weightPercent != null && !Number.isNaN(row.weightPercent)
                              ? `${row.weightPercent}%`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <StudentGradeSidebar
        course={course}
        studentId={studentId}
        grades={studentVisibleGrades}
        assignments={studentAssignments}
        submissionMap={submissionMap}
        studentSubmissions={studentSubmissions}
        backendTotalGrade={studentTotalGrade}
        backendLetterGrade={studentLetterGrade}
        backendFinalGrade={studentFinalGrade}
        backendFinalLetterGrade={studentFinalLetterGrade}
        resolvedGradingPolicy={effectiveGradingPolicy}
        summaryReady={studentGradeSummaryReady}
      />
    </div>
  );
};

export default StudentGradesView;
