const Todo = require('../../models/todo.model');
const { startOfWeek, endOfWeek, isWithinInterval } = require('date-fns');
const todoQueryService = require('./todoQuery.service');
const {
  isPlannerMissingAssignmentsEnabled,
} = require('../notification/academicNotificationExpansion.service');
const {
  getActiveStateMapForUser,
  filterItemsByUxState,
} = require('./plannerUxState.service');
const { rankPlannerItems, applyFeedCap } = require('./plannerPriority.service');
const observability = require('../workflowObservability.service');

const SUBTYPE_RANK = { overdue: 3, missing: 2 };

function dedupeAssignmentPlannerItems(items = []) {
  const assignmentById = new Map();
  const otherItems = [];

  for (const item of items) {
    const isAssignment = item.type === 'assignment' || item.itemType === 'Assignment';
    const entityId = item._id || item.id;
    if (!isAssignment || !entityId) {
      otherItems.push(item);
      continue;
    }

    const key = String(entityId);
    const existing = assignmentById.get(key);
    if (!existing) {
      assignmentById.set(key, item);
      continue;
    }

    const existingRank = SUBTYPE_RANK[existing.subType] || 1;
    const nextRank = SUBTYPE_RANK[item.subType] || 1;
    if (nextRank > existingRank) {
      assignmentById.set(key, item);
    }
  }

  return [...otherItems, ...assignmentById.values()];
}

async function getPersonalTodosThisWeek(userId) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const todos = await Todo.find({ user: userId, completed: false })
    .sort({ dueDate: 1 })
    .lean();

  return todos.filter((todo) => {
    if (!todo.dueDate) return false;
    const due = new Date(todo.dueDate);
    return isWithinInterval(due, { start: weekStart, end: weekEnd });
  });
}

function logPlannerBranchFailure(branch, error) {
  const message = error?.message || String(error);
  console.error('planner_branch_failed', { branch, message });
  observability.metric('planner_branch_failed', {
    branch,
    message,
  });
}

/**
 * Resolve planner branch results with partial-failure isolation.
 * Returns branch values; failed branches yield fallbackValue (default []).
 * Throws only when every branch rejects.
 */
async function resolvePlannerBranches(branches, { fallbackValue = [] } = {}) {
  const settled = await Promise.allSettled(branches.map((branch) => branch.run()));

  const values = [];
  const failures = [];

  settled.forEach((result, index) => {
    const branch = branches[index];
    if (result.status === 'fulfilled') {
      values.push(result.value);
      return;
    }

    failures.push({ branch: branch.name, error: result.reason });
    logPlannerBranchFailure(branch.name, result.reason);
    values.push(fallbackValue);
  });

  if (failures.length === settled.length) {
    throw failures[0]?.error || new Error('All planner branches failed');
  }

  return { values, failures };
}

async function buildPlannerFeedForUser(userId, role) {
  const started = Date.now();
  let items = [];
  let branchFailures = [];

  if (role === 'teacher' || role === 'admin') {
    const { values, failures } = await resolvePlannerBranches([
      { name: 'teacher_ungraded', run: () => todoQueryService.getTeacherUngradedTodoItems(userId) },
      { name: 'personal', run: () => getPersonalTodosThisWeek(userId) },
    ]);
    branchFailures = failures;
    const [ungraded, personal] = values;
    items = [...ungraded, ...personal];
  } else {
    const plannerContext = await todoQueryService.buildStudentPlannerContext(userId);

    const branches = [
      {
        name: 'due_soon',
        run: () =>
          todoQueryService.getStudentDueAllItemsThisWeek(userId, { plannerContext }),
      },
      { name: 'personal', run: () => getPersonalTodosThisWeek(userId) },
    ];

    if (isPlannerMissingAssignmentsEnabled()) {
      branches.push({
        name: 'missing_overdue',
        run: () =>
          todoQueryService.getStudentMissingAndOverdueAssignments(userId, { plannerContext }),
      });
    }

    const { values, failures } = await resolvePlannerBranches(branches);
    branchFailures = failures;

    const dueAll = values[0];
    const personal = values[1];
    const missingOverdue = isPlannerMissingAssignmentsEnabled() ? values[2] : [];
    items = dedupeAssignmentPlannerItems([...dueAll, ...missingOverdue, ...personal]);
  }

  const stateMap = await getActiveStateMapForUser(userId);
  const visible = filterItemsByUxState(items, stateMap);
  const ranked = rankPlannerItems(visible);
  const { items: capped, capped: wasCapped, totalBeforeCap } = applyFeedCap(ranked);

  observability.metric('planner_feed_completed', {
    role: role || 'unknown',
    itemCount: capped.length,
    totalBeforeCap,
    capped: wasCapped,
    hiddenCount: items.length - visible.length,
    branchFailureCount: branchFailures.length,
    durationMs: Date.now() - started,
  });

  return {
    items: capped,
    meta: {
      capped: wasCapped,
      totalBeforeCap,
      hiddenByUx: items.length - visible.length,
    },
  };
}

module.exports = {
  buildPlannerFeedForUser,
  getPersonalTodosThisWeek,
  resolvePlannerBranches,
};
