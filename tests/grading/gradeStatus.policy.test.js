/**
 * Phase 4 — canonical grade status enum.
 */
const {
  GRADE_STATUS,
  resolveSubmissionGradeStatus,
  gradebookCellFromStatus,
  hasSubmissionScore,
  isScoreReleased,
  mapWorkflowStateToGradeStatus,
  mapGradeStatusToWorkflowState,
  getGradeStatusLabel,
} = require('../../shared/grading/gradeStatus.cjs');
const { getGradebookCellForExport } = require('../../shared/grading/gradebookCell.cjs');
const { resolveAssignmentWorkflowState } = require('../../services/assignmentWorkflow.service');
const { resolveStudentGradeVisibility } = require('../../services/gradeRelease.service');
const {
  POLICY_NOW,
  PAST_DUE,
  LATE_SUBMIT_AT,
  FUTURE_DUE,
  STUDENT_ID,
  buildAssignment,
  buildGrades,
  EXCUSED_GRADE,
  case5Excused,
} = require('./fixtures');

describe('gradeStatus — enum', () => {
  it('defines all documented statuses', () => {
    expect(Object.keys(GRADE_STATUS)).toHaveLength(12);
    expect(GRADE_STATUS.GRADED).toBe('GRADED');
    expect(GRADE_STATUS.MANUAL_POST).toBe('MANUAL_POST');
  });

  it('labels every status', () => {
    for (const status of Object.values(GRADE_STATUS)) {
      expect(getGradeStatusLabel(status)).toBeTruthy();
    }
  });
});

describe('gradeStatus — resolveSubmissionGradeStatus', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns EXCUSED for excused submission', () => {
    const assignment = buildAssignment({ id: 'gs-exc', group: 'G' });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { excused: true },
      grade: EXCUSED_GRADE,
    });
    expect(result.status).toBe(GRADE_STATUS.EXCUSED);
  });

  it('returns GRADED for instructor numeric grade', () => {
    const assignment = buildAssignment({ id: 'gs-graded', group: 'G' });
    const result = resolveSubmissionGradeStatus({
      assignment,
      grade: 85,
      perspective: 'instructor',
    });
    expect(result.status).toBe(GRADE_STATUS.GRADED);
    expect(result.score).toBe(85);
  });

  it('returns MISSING for past-due without submission', () => {
    const assignment = buildAssignment({ id: 'gs-miss', group: 'G', dueDate: PAST_DUE });
    const result = resolveSubmissionGradeStatus({ assignment });
    expect(result.status).toBe(GRADE_STATUS.MISSING);
  });

  it('returns SUBMITTED for on-time ungraded submission', () => {
    const assignment = buildAssignment({ id: 'gs-sub', group: 'G', dueDate: FUTURE_DUE });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { _id: 'sub-1', submittedAt: POLICY_NOW },
      hasSubmission: true,
    });
    expect(result.status).toBe(GRADE_STATUS.SUBMITTED);
  });

  it('returns LATE for late ungraded submission', () => {
    const assignment = buildAssignment({ id: 'gs-late', group: 'G', dueDate: PAST_DUE });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { _id: 'sub-late', submittedAt: LATE_SUBMIT_AT },
      hasSubmission: true,
      submittedAt: LATE_SUBMIT_AT,
    });
    expect(result.status).toBe(GRADE_STATUS.LATE);
  });

  it('returns HIDDEN for student when grade not released', () => {
    const assignment = buildAssignment({ id: 'gs-hidden', group: 'G' });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { grade: 90, gradeHidden: true },
      grade: 90,
      perspective: 'student',
    });
    expect(result.status).toBe(GRADE_STATUS.HIDDEN);
  });

  it('returns MANUAL_POST for student manual release pending', () => {
    const assignment = buildAssignment({
      id: 'gs-manual',
      group: 'G',
      gradeReleaseMode: 'manual',
    });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { grade: 90 },
      grade: 90,
      perspective: 'student',
    });
    expect(result.status).toBe(GRADE_STATUS.MANUAL_POST);
  });

  it('returns PENDING_REVIEW for autoGrade awaiting approval', () => {
    const assignment = buildAssignment({ id: 'gs-review', group: 'G' });
    const result = resolveSubmissionGradeStatus({
      assignment,
      submission: { autoGrade: 70, teacherApproved: false },
      perspective: 'instructor',
    });
    expect(result.status).toBe(GRADE_STATUS.PENDING_REVIEW);
  });

  it('returns UNPUBLISHED for unpublished assignment', () => {
    const assignment = buildAssignment({ id: 'gs-unpub', group: 'G', published: false });
    const result = resolveSubmissionGradeStatus({ assignment });
    expect(result.status).toBe(GRADE_STATUS.UNPUBLISHED);
  });
});

describe('gradeStatus — gradebookCell integration', () => {
  const student = { _id: STUDENT_ID };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('gradebookCellFromStatus matches export labels for missing', () => {
    const assignment = buildAssignment({ id: 'cell-miss', group: 'G', dueDate: PAST_DUE });
    const statusResult = resolveSubmissionGradeStatus({ assignment });
    const cell = gradebookCellFromStatus(statusResult, { assignment });
    const exportCell = getGradebookCellForExport(student, assignment, buildGrades(STUDENT_ID, {}), {});
    expect(cell.display).toBe(exportCell.display);
    expect(cell.marker).toBe(exportCell.marker);
  });

  it('gradebookCellFromStatus matches export labels for excused', () => {
    const scenario = case5Excused();
    const excused = scenario.assignments.find((a) => a._id === scenario.excusedCell.assignmentId);
    const statusResult = resolveSubmissionGradeStatus({
      assignment: excused,
      submission: { excused: true },
      grade: EXCUSED_GRADE,
    });
    const cell = gradebookCellFromStatus(statusResult, { grade: EXCUSED_GRADE, assignment: excused });
    expect(cell.display).toBe('Excused');
  });
});

describe('gradeStatus — workflow mapping', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('maps workflow states to grade status', () => {
    expect(mapWorkflowStateToGradeStatus('excused')).toBe(GRADE_STATUS.EXCUSED);
    expect(mapWorkflowStateToGradeStatus('graded_pending')).toBe(GRADE_STATUS.MANUAL_POST);
  });

  it('resolveAssignmentWorkflowState delegates to gradeStatus', () => {
    const assignment = buildAssignment({ id: 'wf-sub', group: 'G', dueDate: FUTURE_DUE });
    expect(
      resolveAssignmentWorkflowState({
        assignment,
        submission: { _id: 'sub', submittedAt: POLICY_NOW },
      })
    ).toBe('submitted');
  });

  it('returns late workflow when lockAfterDue is false and past due', () => {
    const assignment = buildAssignment({
      id: 'wf-late-lock',
      group: 'G',
      dueDate: PAST_DUE,
      lockAfterDue: false,
    });
    expect(resolveAssignmentWorkflowState({ assignment })).toBe('late');
  });
});

describe('gradeStatus — release visibility', () => {
  it('hasSubmissionScore detects numeric and excused scores', () => {
    expect(hasSubmissionScore({ grade: 80 })).toBe(true);
    expect(hasSubmissionScore({ excused: true })).toBe(true);
    expect(hasSubmissionScore({ submittedAt: new Date() })).toBe(false);
  });

  it('isScoreReleased respects manual release mode', () => {
    const assignment = { gradeReleaseMode: 'manual' };
    expect(isScoreReleased({ grade: 90 }, assignment)).toBe(false);
    expect(isScoreReleased({ grade: 90, gradesReleasedAt: new Date() }, assignment)).toBe(true);
  });

  it('resolveStudentGradeVisibility uses shared release rules', () => {
    const assignment = { gradeReleaseMode: 'immediate' };
    const visibility = resolveStudentGradeVisibility({ grade: 88 }, assignment);
    expect(visibility.scoreVisible).toBe(true);
  });
});

describe('gradeStatus — round trip workflow', () => {
  it('mapGradeStatusToWorkflowState inverts common cases', () => {
    expect(
      mapGradeStatusToWorkflowState({ status: GRADE_STATUS.MISSING }, { assignment: {} })
    ).toBe('missing');
    expect(
      mapGradeStatusToWorkflowState({ status: GRADE_STATUS.GRADED }, { assignment: {} })
    ).toBe('graded_released');
  });
});
