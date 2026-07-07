const { isExcusedGrade } = require('./gradeValues.cjs');

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

function getDroppedAssignmentIds(
  groupAssignments,
  studentId,
  grades,
  submissions,
  dropHighest,
  groupName
) {
  if (!dropHighest?.enabled || !Array.isArray(dropHighest.rules)) return new Set();

  const rule = dropHighest.rules.find((r) => r && r.groupName === groupName);
  const dropCount = rule ? Math.max(0, Math.floor(Number(rule.count) || 0)) : 0;
  if (dropCount === 0) return new Set();

  const sid = String(studentId);
  const scorable = [];

  for (const assignment of groupAssignments) {
    const assignmentId = String(assignment._id);
    if (isUnpublished(assignment)) continue;

    const grade = grades[sid]?.[assignmentId];
    const submission = submissions[assignmentId];
    if (isExcusedGrade(grade, submission)) continue;

    if (typeof grade !== 'number' || !Number.isFinite(grade)) continue;

    const max = assignmentMaxPoints(assignment);
    if (max <= 0) continue;

    scorable.push({ assignmentId, percent: (grade / max) * 100 });
  }

  scorable.sort((a, b) => b.percent - a.percent);
  const dropped = new Set();
  for (let i = 0; i < Math.min(dropCount, scorable.length); i++) {
    dropped.add(scorable[i].assignmentId);
  }
  return dropped;
}

module.exports = { getDroppedAssignmentIds };
