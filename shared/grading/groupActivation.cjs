/**
 * Canvas-style assignment group activation (current + projected final grade modes).
 */
const { isExcusedGrade } = require('./gradeValues.cjs');
const { applyLatePenaltyToEarned } = require('./latePenalty.cjs');
const { isExtraCreditAssignment, assignmentBonusPoints } = require('./extraCredit.cjs');
const { resolveEffectivePolicyForAssignment } = require('./policyApplication.cjs');

const SUPPORTED_GRADE_MODES = new Set(['current', 'final']);

function assignmentMaxPoints(assignment) {
  if (assignment.questions && assignment.questions.length > 0) {
    return assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  }
  return assignment.totalPoints || 0;
}

function isUnpublished(assignment) {
  return (
    (assignment.isDiscussion && assignment.published === false) ||
    (!assignment.isDiscussion && !assignment.published)
  );
}

function hasSubmissionForAssignment(assignment, submissions, assignmentId) {
  return assignment.isDiscussion
    ? assignment.hasSubmitted === true
    : submissions[assignmentId] !== undefined;
}

function createGroupTotals() {
  return { earned: 0, possible: 0, extraCreditEarned: 0, hasGradedAssignments: false };
}

/**
 * Current: graded or past-due missing work activates the group.
 * Final: any published non-excused assignment in the denominator activates the group.
 */
function isAssignmentGroupActive(totals, gradeMode = 'current') {
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

function assignmentContributesToGrade(
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

function applyAssignmentToGroupTotals(
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

module.exports = {
  assignmentMaxPoints,
  isUnpublished,
  hasSubmissionForAssignment,
  createGroupTotals,
  isAssignmentGroupActive,
  assignmentContributesToGrade,
  assignmentContributesToGradeCurrent,
  assignmentContributesToGradeFinal,
  applyContributionToTotals,
  applyAssignmentToGroupTotals,
};
