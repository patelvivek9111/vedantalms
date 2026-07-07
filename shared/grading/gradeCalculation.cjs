/**
 * CANONICAL GRADING: calculateFinalGradeWithWeightedGroups + getLetterGrade
 * @deprecated getWeightedGradeForStudent — do not use in gradebook, exports, transcripts, or reports.
 * CI blocks new references via scripts/checkDeprecatedGradingCalculator.js
 */
const { DEFAULT_GRADING_POLICY } = require('./policyDefaults.cjs');
const { filterAssignmentsForDropRules } = require('./dropRules.cjs');
const {
  createGroupTotals,
  isAssignmentGroupActive,
  applyAssignmentToGroupTotals,
} = require('./groupActivation.cjs');
const { applyExtraCreditToCourseTotal } = require('./extraCredit.cjs');

function safeWeight(w) {
  const n = Number(w);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getEffectivePolicy(course, policyOverride) {
  if (policyOverride && typeof policyOverride === 'object') return policyOverride;
  if (course?.gradingPolicy && typeof course.gradingPolicy === 'object') {
    return course.gradingPolicy;
  }
  return DEFAULT_GRADING_POLICY;
}

function getCappedWeight(groupName, adjustedWeight, policy) {
  if (!policy?.categoryCaps?.enabled || !Array.isArray(policy.categoryCaps.caps)) {
    return adjustedWeight;
  }
  const capRule = policy.categoryCaps.caps.find((c) => c && c.groupName === groupName);
  if (!capRule) return adjustedWeight;
  const cap = Number(capRule.maxWeightPercent);
  if (!Number.isFinite(cap)) return adjustedWeight;
  return Math.min(adjustedWeight, cap);
}

function filterGroupAssignments(groupAssignments, sid, grades, submissions, policy, groupName) {
  return filterAssignmentsForDropRules(
    groupAssignments,
    sid,
    grades,
    submissions,
    policy,
    groupName
  );
}

function accumulateGroupTotals(
  assignments,
  sid,
  grades,
  submissions,
  now,
  policy,
  gradeMode,
  courseGroups
) {
  const totals = createGroupTotals();
  assignments.forEach((assignment) => {
    applyAssignmentToGroupTotals(
      assignment,
      sid,
      grades,
      submissions,
      now,
      totals,
      policy,
      gradeMode,
      courseGroups
    );
  });
  return totals;
}

function calculateCurrentGradeWithWeightedGroups(
  studentId,
  course,
  assignments,
  grades,
  submissions = {},
  policyOverride = null
) {
  const sid = String(studentId);
  const policy = getEffectivePolicy(course, policyOverride);
  const courseGroups = course.groups || [];
  const now = new Date();
  const gradeMode = 'current';

  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    assignments
      .filter((a) => a.group === group.name)
      .forEach((a) => groupedAssignmentIds.add(String(a._id)));
  });

  const groupsWithGrades = [];
  const groupsWithoutGrades = [];
  let courseExtraCreditEarned = 0;
  let courseRegularPossible = 0;

  courseGroups.forEach((group) => {
    const groupAssignments = filterGroupAssignments(
      assignments.filter((a) => a.group === group.name),
      sid,
      grades,
      submissions,
      policy,
      group.name
    );

    const totals = accumulateGroupTotals(
      groupAssignments,
      sid,
      grades,
      submissions,
      now,
      policy,
      gradeMode,
      courseGroups
    );
    courseExtraCreditEarned += totals.extraCreditEarned;
    courseRegularPossible += totals.possible;

    if (isAssignmentGroupActive(totals, gradeMode)) {
      groupsWithGrades.push({
        ...group,
        originalWeight: safeWeight(group.weight),
        earned: totals.earned,
        possible: totals.possible,
        percent: (totals.earned / totals.possible) * 100,
      });
    } else {
      groupsWithoutGrades.push(group);
    }
  });

  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(String(a._id)));
  let otherGroupHasGrades = false;
  let otherEarned = 0;
  let otherPossible = 0;

  if (otherAssignments.length > 0) {
    const totals = accumulateGroupTotals(
      otherAssignments,
      sid,
      grades,
      submissions,
      now,
      policy,
      gradeMode,
      courseGroups
    );
    courseExtraCreditEarned += totals.extraCreditEarned;
    courseRegularPossible += totals.possible;
    otherEarned = totals.earned;
    otherPossible = totals.possible;
    otherGroupHasGrades = isAssignmentGroupActive(totals, gradeMode);
  }

  const weightToRedistribute = groupsWithoutGrades.reduce((sum, g) => sum + safeWeight(g.weight), 0);

  if (groupsWithGrades.length === 0 && !otherGroupHasGrades) {
    return 0;
  }

  let totalAdjustedWeight = 0;
  let weightedSum = 0;

  if (groupsWithGrades.length > 0) {
    const totalWeightWithGrades = groupsWithGrades.reduce(
      (sum, g) => sum + safeWeight(g.originalWeight),
      0
    );

    groupsWithGrades.forEach((group) => {
      const ow = safeWeight(group.originalWeight);
      const redistributionRatio = totalWeightWithGrades > 0 ? ow / totalWeightWithGrades : 0;
      const redistributedWeight = weightToRedistribute * redistributionRatio;
      let adjustedWeight = ow + redistributedWeight;
      adjustedWeight = getCappedWeight(group.name, adjustedWeight, policy);

      weightedSum += group.percent * adjustedWeight;
      totalAdjustedWeight += adjustedWeight;
    });
  }

  if (otherGroupHasGrades && otherPossible > 0) {
    const otherPercent = (otherEarned / otherPossible) * 100;
    const otherWeight = 100 - totalAdjustedWeight;

    if (otherWeight > 0) {
      weightedSum += otherPercent * otherWeight;
      totalAdjustedWeight += otherWeight;
    }
  }

  if (totalAdjustedWeight === 0) {
    return 0;
  }

  const basePercent = weightedSum / totalAdjustedWeight;
  return applyExtraCreditToCourseTotal(
    basePercent,
    courseExtraCreditEarned,
    courseRegularPossible,
    policy
  );
}

/**
 * Canvas Final Grade — all assignment groups at nominal weight.
 * Empty or inactive groups contribute 0% at their configured weight (no redistribution).
 * Assignment inclusion follows the same rules as current grade (policy-based missing/late).
 */
function calculateProjectedFinalGradeWithWeightedGroups(
  studentId,
  course,
  assignments,
  grades,
  submissions = {},
  policyOverride = null
) {
  const sid = String(studentId);
  const policy = getEffectivePolicy(course, policyOverride);
  const courseGroups = course.groups || [];
  const now = new Date();
  const gradeMode = 'final';

  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    assignments
      .filter((a) => a.group === group.name)
      .forEach((a) => groupedAssignmentIds.add(String(a._id)));
  });

  let courseExtraCreditEarned = 0;
  let courseRegularPossible = 0;
  let weightedSum = 0;
  let totalNominalWeight = 0;

  courseGroups.forEach((group) => {
    const nominalWeight = safeWeight(group.weight);
    if (nominalWeight <= 0) return;

    const cappedWeight = getCappedWeight(group.name, nominalWeight, policy);
    totalNominalWeight += cappedWeight;

    const groupAssignments = filterGroupAssignments(
      assignments.filter((a) => a.group === group.name),
      sid,
      grades,
      submissions,
      policy,
      group.name
    );

    const totals = accumulateGroupTotals(
      groupAssignments,
      sid,
      grades,
      submissions,
      now,
      policy,
      gradeMode,
      courseGroups
    );
    courseExtraCreditEarned += totals.extraCreditEarned;
    courseRegularPossible += totals.possible;

    const groupPercent = totals.possible > 0 ? (totals.earned / totals.possible) * 100 : 0;
    weightedSum += groupPercent * cappedWeight;
  });

  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(String(a._id)));
  if (otherAssignments.length > 0) {
    const totals = accumulateGroupTotals(
      otherAssignments,
      sid,
      grades,
      submissions,
      now,
      policy,
      gradeMode,
      courseGroups
    );
    courseExtraCreditEarned += totals.extraCreditEarned;
    courseRegularPossible += totals.possible;

    if (totals.possible > 0) {
      const otherPercent = (totals.earned / totals.possible) * 100;
      const otherWeight = Math.max(0, 100 - totalNominalWeight);
      if (otherWeight > 0) {
        weightedSum += otherPercent * otherWeight;
        totalNominalWeight += otherWeight;
      }
    }
  }

  if (totalNominalWeight === 0) {
    return 0;
  }

  const basePercent = weightedSum / totalNominalWeight;
  return applyExtraCreditToCourseTotal(
    basePercent,
    courseExtraCreditEarned,
    courseRegularPossible,
    policy
  );
}

/** @deprecated Name retained for backwards compatibility — equals current grade mode. */
function calculateFinalGradeWithWeightedGroups(
  studentId,
  course,
  assignments,
  grades,
  submissions = {},
  policyOverride = null
) {
  return calculateCurrentGradeWithWeightedGroups(
    studentId,
    course,
    assignments,
    grades,
    submissions,
    policyOverride
  );
}

/**
 * @deprecated Do not use for gradebook, exports, transcripts, or reports.
 */
function getWeightedGradeForStudent(studentId, course, assignments, grades, submissions = {}) {
  const sid = String(studentId);
  let weightedSum = 0;
  let totalWeight = 0;
  const courseGroups = course.groups || [];
  const now = new Date();
  const policy = DEFAULT_GRADING_POLICY;

  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    assignments
      .filter((a) => a.group === group.name)
      .forEach((a) => groupedAssignmentIds.add(String(a._id)));
  });

  let sumWeights = courseGroups.reduce((sum, g) => sum + safeWeight(g.weight), 0);
  let normalizedGroups = courseGroups;
  if (sumWeights !== 100 && sumWeights > 0) {
    normalizedGroups = courseGroups.map((g) => ({
      ...g,
      weight: (safeWeight(g.weight) / sumWeights) * 100,
    }));
    sumWeights = 100;
  }

  normalizedGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    if (groupAssignments.length === 0) return;
    const totals = createGroupTotals();

    groupAssignments.forEach((assignment) => {
      applyAssignmentToGroupTotals(assignment, sid, grades, submissions, now, totals, policy);
    });

    if (totals.possible > 0) {
      const percent = (totals.earned / totals.possible) * 100;
      const gw = safeWeight(group.weight);
      weightedSum += percent * gw;
      totalWeight += gw;
    }
  });

  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(String(a._id)));
  if (otherAssignments.length > 0) {
    const totals = createGroupTotals();
    otherAssignments.forEach((assignment) => {
      applyAssignmentToGroupTotals(assignment, sid, grades, submissions, now, totals, policy);
    });
    if (totals.possible > 0) {
      const remainingWeight = 100 - totalWeight;
      const percent = (totals.earned / totals.possible) * 100;
      weightedSum += percent * remainingWeight;
      totalWeight += remainingWeight;
    }
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

function computeGroupPointTotals(
  studentId,
  groupAssignments,
  grades,
  submissions = {},
  policy = null,
  groupName = null,
  gradeMode = 'current',
  courseGroups = []
) {
  const sid = String(studentId);
  const now = new Date();
  const effectivePolicy = policy || DEFAULT_GRADING_POLICY;
  let assignments = groupAssignments;

  if (
    groupName &&
    (effectivePolicy?.dropLowest?.enabled || effectivePolicy?.dropHighest?.enabled)
  ) {
    assignments = filterAssignmentsForDropRules(
      assignments,
      sid,
      grades,
      submissions,
      effectivePolicy,
      groupName
    );
  }

  const totals = { ...createGroupTotals(), includedCount: 0 };

  for (const assignment of assignments) {
    const before = totals.possible;
    applyAssignmentToGroupTotals(
      assignment,
      sid,
      grades,
      submissions,
      now,
      totals,
      effectivePolicy,
      gradeMode,
      courseGroups
    );
    if (totals.possible > before) totals.includedCount += 1;
  }

  const contributesToGrade = isAssignmentGroupActive(totals, gradeMode);

  return {
    totalEarned: totals.earned,
    totalPossible: totals.possible,
    includedCount: totals.includedCount,
    totalInGroup: assignments.length,
    contributesToGrade,
    percentage: contributesToGrade ? (totals.earned / totals.possible) * 100 : null,
  };
}

function getLetterGrade(percent, gradeScale) {
  const scale =
    gradeScale && gradeScale.length > 0
      ? gradeScale
      : [
          { letter: 'A', min: 90, max: 100 },
          { letter: 'B', min: 80, max: 89 },
          { letter: 'C', min: 70, max: 79 },
          { letter: 'D', min: 60, max: 69 },
          { letter: 'F', min: 0, max: 59 },
        ];
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const s of sorted) {
    if (percent >= s.min) return s.letter;
  }
  return 'F';
}

module.exports = {
  calculateFinalGradeWithWeightedGroups,
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  computeGroupPointTotals,
  getWeightedGradeForStudent,
  getLetterGrade,
};
