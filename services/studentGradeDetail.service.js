const { computeGroupPointTotals } = require('../utils/gradeCalculation');
const { hasSubmissionScore, isScoreReleased } = require('../shared/grading/gradeStatus.cjs');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');

function buildAssignmentGroupBreakdown(
  studentId,
  courseContext,
  allAssignments,
  grades,
  submissionMap,
  resolved
) {
  const sid = String(studentId);
  const groups = courseContext.groups || [];
  const courseGroups = groups;

  return groups.map((group) => {
    const groupAssignments = allAssignments.filter((a) => a.group === group.name);
    const current = computeGroupPointTotals(
      sid,
      groupAssignments,
      grades,
      submissionMap,
      resolved,
      group.name,
      'current',
      courseGroups
    );
    const final = computeGroupPointTotals(
      sid,
      groupAssignments,
      grades,
      submissionMap,
      resolved,
      group.name,
      'final',
      courseGroups
    );
    return {
      name: group.name,
      weight: group.weight,
      currentPercent: current.percentage,
      finalPercent: final.percentage,
      earned: current.totalEarned,
      possible: current.totalPossible,
      active: current.contributesToGrade,
      includedCount: current.includedCount,
      totalInGroup: current.totalInGroup,
    };
  });
}

function countUnpostedAssignments(allAssignments, grades, submissionMap, studentId) {
  const sid = String(studentId);
  let count = 0;
  for (const assignment of allAssignments) {
    const assignmentId = String(assignment._id);
    const submission = submissionMap[assignmentId];
    if (!hasSubmissionScore(submission)) continue;
    const grade = grades[sid]?.[assignmentId];
    if (typeof grade === 'number' && !isScoreReleased(submission, assignment)) {
      count += 1;
    }
  }
  return count;
}

function buildPolicyMeta(resolved, gradeResult) {
  const snapshot = generateResolvedPolicySnapshot(resolved || gradeResult.resolved || {});
  return {
    policyVersion: snapshot.policyVersion,
    policyHash: snapshot.policyHash,
    gradingEngineVersion: gradeResult.gradingEngineVersion,
    mutedAssignmentsInTotals:
      resolved?.gradeVisibility?.mutedAssignmentsInTotals || 'exclude',
    sources: resolved?._meta?.sources || null,
  };
}

module.exports = {
  buildAssignmentGroupBreakdown,
  countUnpostedAssignments,
  buildPolicyMeta,
};
