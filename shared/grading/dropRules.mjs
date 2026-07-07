import { getDroppedAssignmentIds as getDropLowestIds } from './dropLowest.mjs';
import { getDroppedAssignmentIds as getDropHighestIds } from './dropHighest.mjs';

/** Apply drop-lowest and drop-highest rules for one assignment group. */
export function filterAssignmentsForDropRules(
  groupAssignments,
  studentId,
  grades,
  submissions,
  policy,
  groupName
) {
  let assignments = groupAssignments;
  const lowest = getDropLowestIds(
    assignments,
    studentId,
    grades,
    submissions,
    policy?.dropLowest,
    groupName
  );
  const highest = getDropHighestIds(
    assignments,
    studentId,
    grades,
    submissions,
    policy?.dropHighest,
    groupName
  );
  const dropped = new Set([...lowest, ...highest]);
  if (dropped.size === 0) return assignments;
  return assignments.filter((a) => !dropped.has(String(a._id)));
}
