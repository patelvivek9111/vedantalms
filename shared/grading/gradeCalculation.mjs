import { isExcusedGrade } from './gradeValues.mjs';
import { DEFAULT_GRADING_POLICY } from './policyDefaults.mjs';
import { applyLatePenaltyToEarned } from './latePenalty.mjs';
import { getDroppedAssignmentIds } from './dropLowest.mjs';

function safeWeight(w) {
  const n = Number(w);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function assignmentMaxPoints(assignment) {
  if (assignment.questions?.length) {
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

function getEffectivePolicy(course, policyOverride) {
  if (policyOverride && typeof policyOverride === 'object') return policyOverride;
  if (course?.gradingPolicy && typeof course.gradingPolicy === 'object') {
    return course.gradingPolicy;
  }
  return DEFAULT_GRADING_POLICY;
}

function applyAssignmentToGroupTotals(
  assignment,
  studentId,
  grades,
  submissions,
  now,
  totals,
  policy
) {
  const assignmentId = String(assignment._id);
  const grade = grades[studentId]?.[assignmentId];
  const submission = submissions[assignmentId];
  const max = assignmentMaxPoints(assignment);
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;

  if (isUnpublished(assignment)) return;
  if (isExcusedGrade(grade, submission)) return;

  const hasSubmission = hasSubmissionForAssignment(assignment, submissions, assignmentId);
  const missingMode = policy?.missingAssignment?.mode || 'count_as_zero';

  if (typeof grade === 'number' && Number.isFinite(grade)) {
    let earned = applyLatePenaltyToEarned(grade, submission, assignment, policy?.latePenalty);
    totals.earned += earned;
    totals.possible += max;
    totals.hasGradedAssignments = true;
  } else if (missingMode === 'count_as_zero' && dueDate && now > dueDate && !hasSubmission) {
    totals.earned += 0;
    totals.possible += max;
    totals.hasGradedAssignments = true;
  }
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

export function calculateFinalGradeWithWeightedGroups(
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

  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    assignments
      .filter((a) => a.group === group.name)
      .forEach((a) => groupedAssignmentIds.add(String(a._id)));
  });

  const groupsWithGrades = [];
  const groupsWithoutGrades = [];

  courseGroups.forEach((group) => {
    let groupAssignments = assignments.filter((a) => a.group === group.name);
    const droppedIds = getDroppedAssignmentIds(
      groupAssignments,
      sid,
      grades,
      submissions,
      policy.dropLowest,
      group.name
    );
    if (droppedIds.size > 0) {
      groupAssignments = groupAssignments.filter((a) => !droppedIds.has(String(a._id)));
    }

    const totals = { earned: 0, possible: 0, hasGradedAssignments: false };

    groupAssignments.forEach((assignment) => {
      applyAssignmentToGroupTotals(assignment, sid, grades, submissions, now, totals, policy);
    });

    if (totals.hasGradedAssignments && totals.possible > 0) {
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
    const totals = { earned: 0, possible: 0, hasGradedAssignments: false };
    otherAssignments.forEach((assignment) => {
      applyAssignmentToGroupTotals(assignment, sid, grades, submissions, now, totals, policy);
    });
    otherEarned = totals.earned;
    otherPossible = totals.possible;
    otherGroupHasGrades = totals.hasGradedAssignments;
  }

  const weightToRedistribute = groupsWithoutGrades.reduce((sum, g) => sum + safeWeight(g.weight), 0);

  if (groupsWithGrades.length === 0 && !otherGroupHasGrades) return 0;

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

  if (totalAdjustedWeight === 0) return 0;
  return weightedSum / totalAdjustedWeight;
}

/** @deprecated */
export function getWeightedGradeForStudent(studentId, course, assignments, grades, submissions = {}) {
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
    const totals = { earned: 0, possible: 0, hasGradedAssignments: false };
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
    const totals = { earned: 0, possible: 0, hasGradedAssignments: false };
    otherAssignments.forEach((assignment) => {
      applyAssignmentToGroupTotals(assignment, sid, grades, submissions, now, totals, policy);
    });
    if (totals.possible > 0) {
      const remainingWeight = 100 - totalWeight;
      weightedSum += (totals.earned / totals.possible) * 100 * remainingWeight;
      totalWeight += remainingWeight;
    }
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

export function getLetterGrade(percent, gradeScale) {
  const scale =
    gradeScale?.length > 0
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
