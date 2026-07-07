/**
 * Phase 4 — canonical grade status enum (frontend mirror).
 */
import { describe, it, expect } from 'vitest';
import {
  GRADE_STATUS,
  resolveSubmissionGradeStatus,
  mapWorkflowStateToGradeStatus,
  getGradeStatusLabel,
  shouldShowStudentStatusBadge,
} from '@/utils/gradeUtils';
import { resolveAssignmentWorkflowStatus } from '@/utils/assignmentWorkflowStatus';
import { PAST_DUE, FUTURE_DUE, buildAssignment } from '@tests/fixtures/grading/fixtures';

describe('gradeStatus — enum (frontend)', () => {
  it('defines documented statuses', () => {
    expect(GRADE_STATUS.GRADED).toBe('GRADED');
    expect(GRADE_STATUS.MANUAL_POST).toBe('MANUAL_POST');
    expect(Object.keys(GRADE_STATUS)).toHaveLength(12);
  });

  it('labels every status', () => {
    for (const status of Object.values(GRADE_STATUS)) {
      expect(getGradeStatusLabel(status)).toBeTruthy();
    }
  });
});

describe('gradeStatus — resolveSubmissionGradeStatus (frontend)', () => {
  it('returns MISSING for past-due without submission', () => {
    const assignment = buildAssignment({ id: 'gs-miss-fe', group: 'G', dueDate: PAST_DUE });
    const result = resolveSubmissionGradeStatus({ assignment, now: new Date() });
    expect(result.status).toBe(GRADE_STATUS.MISSING);
  });

  it('returns SUBMITTED for on-time ungraded submission', () => {
    const assignment = buildAssignment({ id: 'gs-sub-fe', group: 'G', dueDate: FUTURE_DUE });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { _id: 'sub', submittedAt: new Date().toISOString() },
      hasSubmission: true,
      now: new Date(),
    });
    expect(result.status).toBe(GRADE_STATUS.SUBMITTED);
  });
});

describe('gradeStatus — workflow mirror (frontend)', () => {
  it('resolveAssignmentWorkflowStatus uses shared gradeStatus', () => {
    const assignment = buildAssignment({ id: 'wf-fe', group: 'G', dueDate: FUTURE_DUE });
    expect(
      resolveAssignmentWorkflowStatus({
        assignment,
        submission: { _id: 'sub', submittedAt: new Date().toISOString() },
        now: new Date(),
      })
    ).toBe('submitted');
  });

  it('maps workflow strings to grade status', () => {
    expect(mapWorkflowStateToGradeStatus('excused')).toBe(GRADE_STATUS.EXCUSED);
  });
});

describe('gradeStatus — student badge visibility (frontend)', () => {
  it('shows badge for submission states only', () => {
    expect(shouldShowStudentStatusBadge(GRADE_STATUS.SUBMITTED)).toBe(true);
    expect(shouldShowStudentStatusBadge(GRADE_STATUS.EXCUSED)).toBe(true);
    expect(shouldShowStudentStatusBadge(GRADE_STATUS.GRADED)).toBe(false);
    expect(shouldShowStudentStatusBadge(GRADE_STATUS.HIDDEN)).toBe(false);
  });
});
