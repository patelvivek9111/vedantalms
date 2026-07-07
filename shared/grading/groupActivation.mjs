/**
 * Canvas-style assignment group activation (current + projected final grade modes).
 * ESM twin of groupActivation.cjs — keep in sync.
 */
import { isExcusedGrade } from './gradeValues.mjs';
import { applyLatePenaltyToEarned } from './latePenalty.mjs';
import { isExtraCreditAssignment, assignmentBonusPoints } from './extraCredit.mjs';
import { resolveEffectivePolicyForAssignment } from './policyApplication.mjs';

const SUPPORTED_GRADE_MODES = new Set(['current', 'final']);

export function assignmentMaxPoints(assignment) {
  if (assignment.questions?.length) {
    return assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  }
  return assignment.totalPoints || 0;
}

export function isUnpublished(assignment) {
  return (
    (assignment.isDiscussion && assignment.published === false) ||
    (!assignment.isDiscussion && !assignment.published)
  );
}

export function hasSubmissionForAssignment(assignment, submissions, assignmentId) {
  return assignment.isDiscussion
    ? assignment.hasSubmitted === true
    : submissions[assignmentId] !== undefined;
}

export function createGroupTotals() {
  return { earned: 0, possible: 0, extraCreditEarned: 0, hasGradedAssignments: false };
}

export function isAssignmentGroupActive(totals, gradeMode = 'current') {
  if (gradeMode === 'final') {
    return totals.possible > 0;
  }
  return totals.hasGradedAssignments === true && totals.possible > 0;
}

function assignmentContributesToGradeCurrent(
  assignment,
  studentId,
  grades,
  submissions,
  now,
  policy,
  courseGroups = [],
  gradeMode = 'current'
) {
  const assignmentId = String(assignment._id);
  const grade = grades[studentId]?.[assignmentId];
  const submission = submissions[assignmentId];
  const effectivePolicy = resolveEffectivePolicyForAssignment(
    policy,
    submission,
    assignment,
    gradeMode
  );
  const max = assignmentMaxPoints(assignment);
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isEC = isExtraCreditAssignment(assignment, courseGroups);

  if (isUnpublished(assignment)) return null;
  if (isExcusedGrade(grade, submission)) return null;

  const hasSubmission = hasSubmissionForAssignment(assignment, submissions, assignmentId);
  const missingMode = effectivePolicy?.missingAssignment?.mode || 'count_as_zero';

  if (typeof grade === 'number' && Number.isFinite(grade)) {
    let earned = grade;
    earned = applyLatePenaltyToEarned(
      earned,
      submission,
      assignment,
      effectivePolicy?.latePenalty
    );
    earned += assignmentBonusPoints(assignment);
    return { earned, possible: isEC ? 0 : max, isExtraCredit: isEC };
  }

  if (isEC) return null;

  // Canvas Current: submitted but not yet graded — exclude from denominator.
  if (hasSubmission) return null;

  if (missingMode === 'count_as_zero' && dueDate && now > dueDate) {
    return { earned: 0, possible: max, isExtraCredit: false };
  }

  return null;
}

function assignmentContributesToGradeFinal(
  assignment,
  studentId,
  grades,
  submissions,
  now,
  policy,
  courseGroups = []
) {
  const assignmentId = String(assignment._id);
  const grade = grades[studentId]?.[assignmentId];
  const submission = submissions[assignmentId];
  const effectivePolicy = resolveEffectivePolicyForAssignment(
    policy,
    submission,
    assignment,
    'final'
  );
  const max = assignmentMaxPoints(assignment);
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isEC = isExtraCreditAssignment(assignment, courseGroups);

  if (isUnpublished(assignment)) return null;
  if (isExcusedGrade(grade, submission)) return null;

  const missingMode = effectivePolicy?.missingAssignment?.mode || 'count_as_zero';

  if (typeof grade === 'number' && Number.isFinite(grade)) {
    let earned = grade;
    earned = applyLatePenaltyToEarned(
      earned,
      submission,
      assignment,
      effectivePolicy?.latePenalty
    );
    earned += assignmentBonusPoints(assignment);
    return { earned, possible: isEC ? 0 : max, isExtraCredit: isEC };
  }

  if (isEC) return null;

  // Canvas Final: past-due missing and submitted-ungraded count as zero when policy requires.
  if (missingMode === 'count_as_zero' && dueDate && now > dueDate) {
    return { earned: 0, possible: max, isExtraCredit: false };
  }

  return null;
}

export function assignmentContributesToGrade(
  assignment,
  studentId,
  grades,
  submissions,
  now,
  policy,
  gradeMode = 'current',
  courseGroups = []
) {
  if (!SUPPORTED_GRADE_MODES.has(gradeMode)) {
    throw new Error(`Unsupported gradeMode: ${gradeMode}`);
  }

  if (gradeMode === 'final') {
    return assignmentContributesToGradeFinal(
      assignment,
      studentId,
      grades,
      submissions,
      now,
      policy,
      courseGroups
    );
  }

  return assignmentContributesToGradeCurrent(
    assignment,
    studentId,
    grades,
    submissions,
    now,
    policy,
    courseGroups,
    gradeMode
  );
}

function applyContributionToTotals(contribution, totals) {
  if (contribution.isExtraCredit) {
    totals.extraCreditEarned += contribution.earned;
  } else {
    totals.earned += contribution.earned;
    totals.possible += contribution.possible;
  }
  totals.hasGradedAssignments = true;
}

export function applyAssignmentToGroupTotals(
  assignment,
  studentId,
  grades,
  submissions,
  now,
  totals,
  policy,
  gradeMode = 'current',
  courseGroups = []
) {
  const contribution = assignmentContributesToGrade(
    assignment,
    studentId,
    grades,
    submissions,
    now,
    policy,
    gradeMode,
    courseGroups
  );
  if (!contribution) return;

  applyContributionToTotals(contribution, totals);
}

export function applyContributionToTotalsForTest(contribution, totals) {
  applyContributionToTotals(contribution, totals);
}
