import React from 'react';
import {
  resolveSubmissionGradeStatus,
  shouldShowStudentStatusBadge,
  getGradeStatusLabel,
  GRADE_STATUS,
  type GradeStatus,
} from '@lms-shared/grading';
import { normalizeMongoIdRef } from '../../utils/mongoId';
import {
  findStudentDiscussionGradeRow,
  isDiscussionGradePendingRelease,
  resolveStudentDiscussionEarnedScore,
} from '../../utils/discussionGradeDisplay';

const BADGE_CLASSES: Record<string, string> = {
  [GRADE_STATUS.SUBMITTED]:
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  [GRADE_STATUS.LATE]:
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  [GRADE_STATUS.MISSING]:
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  [GRADE_STATUS.EXCUSED]:
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  [GRADE_STATUS.UNPUBLISHED]:
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  [GRADE_STATUS.OFFLINE_PENDING]:
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export interface StudentGradeRowContext {
  assignment: any;
  submission?: any | null;
  grade?: number | string | null;
  studentId: string;
  hasSubmission?: boolean;
  submittedAt?: Date | null;
  now?: Date;
  /** When exclude_until_graded, missing rows show — not 0 (they do not affect totals). */
  missingAssignmentMode?: 'count_as_zero' | 'exclude_until_graded';
}

export interface StudentGradeRowDisplay {
  grade: number | string | null | undefined;
  scoreCell: string;
  status: GradeStatus;
  showStatusBadge: boolean;
  scoreHidden: boolean;
}

export function resolveStudentGradeRowDisplay(ctx: StudentGradeRowContext): StudentGradeRowDisplay {
  const {
    assignment,
    submission = null,
    studentId,
    hasSubmission,
    submittedAt,
    now = new Date(),
  } = ctx;

  let grade = ctx.grade;
  let resolvedSubmittedAt = submittedAt ?? null;
  let resolvedHasSubmission = hasSubmission;

  if (assignment.isDiscussion) {
    if (!resolvedHasSubmission && (assignment.hasPosted || assignment.hasSubmitted)) {
      resolvedHasSubmission = true;
    }
    if (!resolvedHasSubmission && Array.isArray(assignment.replies)) {
      const reply = assignment.replies.find(
        (r: any) => normalizeMongoIdRef(r.author) === normalizeMongoIdRef(studentId)
      );
      if (reply?.createdAt) {
        resolvedSubmittedAt = new Date(reply.createdAt);
        resolvedHasSubmission = true;
      }
    }
    if (!resolvedSubmittedAt && assignment.studentReplyCreatedAt) {
      const fromField = new Date(assignment.studentReplyCreatedAt);
      if (!Number.isNaN(fromField.getTime())) {
        resolvedSubmittedAt = fromField;
      }
    }

    if (isDiscussionGradePendingRelease(assignment)) {
      const status =
        assignment.discussionReleaseMode === 'manual'
          ? GRADE_STATUS.MANUAL_POST
          : GRADE_STATUS.HIDDEN;
      return {
        grade: null,
        scoreCell: 'Hidden',
        status,
        showStatusBadge: false,
        scoreHidden: true,
      };
    }

    grade = resolveStudentDiscussionEarnedScore(assignment, studentId);
  }

  const statusResult = resolveSubmissionGradeStatus({
    assignment,
    submission,
    grade: typeof grade === 'number' ? grade : undefined,
    now,
    perspective: 'student',
    studentId,
    hasSubmission: resolvedHasSubmission,
    submittedAt: resolvedSubmittedAt,
  });

  const scoreHidden =
    statusResult.status === GRADE_STATUS.HIDDEN || statusResult.status === GRADE_STATUS.MANUAL_POST;

  let scoreCell = '-';
  if (scoreHidden) {
    scoreCell = 'Hidden';
  } else if (typeof grade === 'number') {
    scoreCell = Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2);
  } else if (statusResult.status === GRADE_STATUS.MISSING) {
    scoreCell = ctx.missingAssignmentMode === 'exclude_until_graded' ? '-' : '0';
  }

  return {
    grade,
    scoreCell,
    status: statusResult.status,
    showStatusBadge: shouldShowStudentStatusBadge(statusResult.status),
    scoreHidden,
  };
}

export function GradeStatusBadge({ status }: { status: GradeStatus }) {
  if (!shouldShowStudentStatusBadge(status)) return null;
  const className = BADGE_CLASSES[status];
  if (!className) return null;
  return <span className={className}>{getGradeStatusLabel(status)}</span>;
}
