const mongoose = require('mongoose');

function normalizeGroups(groups = [], existingGroups = []) {
  const existingByName = new Map((existingGroups || []).map((group) => [group.name, group]));
  return (groups || []).map((group) => ({
    ...group,
    id:
      group.id ||
      group._id?.toString?.() ||
      existingByName.get(group.name)?.id ||
      existingByName.get(group.name)?._id?.toString?.() ||
      new mongoose.Types.ObjectId().toString(),
  }));
}

function resolveGroupByName(course, name) {
  if (!course || !name) return null;
  return (course.groups || []).find((group) => group.name === name) || null;
}

function resolveGroupById(course, id) {
  if (!course || !id) return null;
  return (course.groups || []).find((group) => String(group.id || group._id) === String(id)) || null;
}

function applyAssignmentGroupSelection(assignment, course, { group, groupId } = {}) {
  let resolved = null;
  if (groupId) resolved = resolveGroupById(course, groupId);
  if (!resolved && group) resolved = resolveGroupByName(course, group);

  if (resolved) {
    assignment.groupId = String(resolved.id || resolved._id);
    assignment.group = resolved.name;
  } else if (group !== undefined) {
    assignment.group = group;
    assignment.groupId = undefined;
  }
  return assignment;
}

module.exports = {
  normalizeGroups,
  resolveGroupByName,
  resolveGroupById,
  applyAssignmentGroupSelection,
};
