const mongoose = require('mongoose');
const { startOfWeek, endOfWeek } = require('date-fns');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const Group = require('../../models/Group');
const Thread = require('../../models/thread.model');
const discussionReplyService = require('../discussionReply.service');
const observability = require('../workflowObservability.service');

const UNGRADED_MATCH = {
  $or: [{ grade: null }, { grade: { $exists: false } }],
};

const DEFAULT_PLANNER_MISSING_LOOKBACK_DAYS = 90;

function resolvePlannerMissingLookbackDays() {
  const raw = process.env.PLANNER_MISSING_LOOKBACK_DAYS;
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_PLANNER_MISSING_LOOKBACK_DAYS;
  }

  const parsed = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PLANNER_MISSING_LOOKBACK_DAYS;
  }

  return parsed;
}

function buildMissingOverdueAssignmentFilter(now = new Date()) {
  const lookbackDays = resolvePlannerMissingLookbackDays();
  const lookbackStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  return {
    published: true,
    dueDate: { $lt: now, $gte: lookbackStart },
    availableFrom: { $lte: now },
  };
}

function recordTodoQueryMetric(endpoint, { queryCount, resultCount, durationMs }) {
  observability.metric('todo_query_completed', {
    endpoint,
    queryCount,
    resultCount,
    durationMs,
  });
}

async function getStudentSubmittedAssignmentIds(userId, options = {}) {
  const individualSubmissions = await Submission.find({
    student: userId,
    group: { $exists: false },
  }).distinct('assignment');

  let userGroupIds;
  if (Array.isArray(options.userGroups)) {
    userGroupIds = options.userGroups.map((group) => group._id);
  } else {
    userGroupIds = await Group.find({ members: userId }).distinct('_id');
  }

  const groupSubmissions = userGroupIds.length
    ? await Submission.find({ group: { $in: userGroupIds } }).distinct('assignment')
    : [];

  return new Set([
    ...individualSubmissions.map((id) => String(id)),
    ...groupSubmissions.map((id) => String(id)),
  ]);
}

async function loadStudentEnrolledPlannerContext(userId) {
  const courses = await Course.find({ students: userId, published: true }).select('_id title').lean();
  if (!courses.length) return null;

  const courseIds = courses.map((course) => course._id);
  const [modules, userGroups] = await Promise.all([
    Module.find({ course: { $in: courseIds }, published: true }).select('_id course').lean(),
    Group.find({ members: userId, course: { $in: courseIds } }).select('_id groupSet course').lean(),
  ]);

  const userGroupSetIds = [
    ...new Set(userGroups.map((group) => String(group.groupSet)).filter(Boolean)),
  ];

  return {
    courses,
    courseIds,
    modules,
    moduleIds: modules.map((module) => module._id),
    userGroups,
    userGroupSetIds,
  };
}

/**
 * Shared student planner context — enrollment, groups, and submitted assignment IDs.
 * Loaded once per planner feed request and reused across query branches.
 */
async function buildStudentPlannerContext(userId) {
  const enrolled = await loadStudentEnrolledPlannerContext(userId);
  if (!enrolled) return null;

  const submittedAssignmentIds = await getStudentSubmittedAssignmentIds(userId, {
    userGroups: enrolled.userGroups,
  });

  return {
    ...enrolled,
    submittedAssignmentIds,
  };
}

function isGroupAssignmentVisibleToStudent(assignment, userGroupSetIds) {
  if (!assignment?.isGroupAssignment) return true;
  const groupSetId = assignment.groupSet?._id || assignment.groupSet;
  if (!groupSetId) return false;
  return userGroupSetIds.includes(String(groupSetId));
}

function isDiscussionVisibleToStudent(discussion, ctx) {
  if (!discussion?.groupSet) return true;
  return ctx.userGroups.some((group) => {
    if (discussion.groupId) {
      return String(group._id) === String(discussion.groupId);
    }
    return String(group.groupSet) === String(discussion.groupSet);
  });
}

async function findModuleAssignmentsForPlanner(filter, moduleIds) {
  if (!moduleIds.length) return [];
  return Assignment.find({ ...filter, module: { $in: moduleIds } })
    .populate({
      path: 'module',
      populate: { path: 'course', select: 'title' },
    })
    .sort({ dueDate: 1 })
    .lean();
}

async function findGroupAssignmentsForPlanner(filter, userGroupSetIds) {
  if (!userGroupSetIds.length) return [];
  const groupSetIds = userGroupSetIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!groupSetIds.length) return [];

  return Assignment.find({
    ...filter,
    isGroupAssignment: true,
    groupSet: { $in: groupSetIds },
  })
    .populate({
      path: 'groupSet',
      select: 'name course',
      populate: { path: 'course', select: 'title' },
    })
    .sort({ dueDate: 1 })
    .lean();
}

function dedupeAssignmentsById(assignments = []) {
  const seen = new Set();
  return assignments.filter((assignment) => {
    const id = String(assignment._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function mapGroupAssignmentForFeed(assignment) {
  const course = assignment.groupSet?.course;
  return {
    ...assignment,
    module: assignment.module || (course ? { course } : undefined),
  };
}

/**
 * Teacher/admin ungraded todo feed — bulk aggregation instead of per-assignment counts.
 */
async function getTeacherUngradedTodoItems(instructorId) {
  const started = Date.now();
  let queryCount = 0;

  const courses = await Course.find({ instructor: instructorId }).select('_id title').lean();
  queryCount += 1;
  if (!courses.length) {
    recordTodoQueryMetric('teacher_ungraded', { queryCount, resultCount: 0, durationMs: Date.now() - started });
    return [];
  }

  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const courseIds = courses.map((c) => c._id);

  const modules = await Module.find({ course: { $in: courseIds } }).select('_id course').lean();
  queryCount += 1;
  if (!modules.length) {
    recordTodoQueryMetric('teacher_ungraded', { queryCount, resultCount: 0, durationMs: Date.now() - started });
    return [];
  }

  const moduleById = new Map(modules.map((m) => [String(m._id), m]));
  const moduleIds = modules.map((m) => m._id);

  const assignments = await Assignment.find({ module: { $in: moduleIds } })
    .select('_id title module')
    .lean();
  queryCount += 1;
  if (!assignments.length) {
    recordTodoQueryMetric('teacher_ungraded', { queryCount, resultCount: 0, durationMs: Date.now() - started });
    return [];
  }

  const assignmentIds = assignments.map((a) => a._id);
  const assignmentById = new Map(assignments.map((a) => [String(a._id), a]));

  const ungradedRows = await Submission.aggregate([
    {
      $match: {
        assignment: { $in: assignmentIds },
        ...UNGRADED_MATCH,
      },
    },
    { $group: { _id: '$assignment', ungradedCount: { $sum: 1 } } },
  ]);
  queryCount += 1;

  const results = [];
  for (const row of ungradedRows) {
    if (!row.ungradedCount) continue;
    const assignment = assignmentById.get(String(row._id));
    if (!assignment) continue;
    const module = moduleById.get(String(assignment.module));
    if (!module) continue;
    const course = courseById.get(String(module.course));
    if (!course) continue;
    results.push({
      id: assignment._id,
      title: assignment.title,
      course: { id: course._id, title: course.title },
      ungradedCount: row.ungradedCount,
    });
  }

  recordTodoQueryMetric('teacher_ungraded', {
    queryCount,
    resultCount: results.length,
    durationMs: Date.now() - started,
  });

  return results;
}

/**
 * Student due-all (assignments + discussions) for current week — enrollment-scoped.
 */
async function getStudentDueAllItemsThisWeek(userId, options = {}) {
  const started = Date.now();
  let queryCount = 0;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const sharedContext = options.plannerContext;
  const ctx = sharedContext || (await loadStudentEnrolledPlannerContext(userId));
  if (!sharedContext) {
    queryCount += 3;
  }
  if (!ctx) {
    recordTodoQueryMetric('student_due_all', {
      queryCount,
      resultCount: 0,
      durationMs: Date.now() - started,
    });
    return [];
  }

  const assignmentFilter = {
    dueDate: { $gte: weekStart, $lte: weekEnd },
    published: true,
    availableFrom: { $lte: now },
  };

  const submittedIdsPromise = sharedContext?.submittedAssignmentIds
    ? Promise.resolve(sharedContext.submittedAssignmentIds)
    : getStudentSubmittedAssignmentIds(userId, { userGroups: ctx.userGroups });

  const [moduleAssignments, groupAssignments, discussions, submittedIds] = await Promise.all([
    findModuleAssignmentsForPlanner(assignmentFilter, ctx.moduleIds),
    findGroupAssignmentsForPlanner(assignmentFilter, ctx.userGroupSetIds),
    Thread.find({
      course: { $in: ctx.courseIds },
      dueDate: { $gte: weekStart, $lte: weekEnd },
      published: true,
    })
      .populate({
        path: 'module',
        populate: { path: 'course', select: 'title' },
      })
      .populate('course', 'title')
      .sort({ dueDate: 1 })
      .lean(),
    submittedIdsPromise,
  ]);
  queryCount += sharedContext?.submittedAssignmentIds ? 3 : 4;

  const visibleGroupAssignments = groupAssignments
    .filter((assignment) => isGroupAssignmentVisibleToStudent(assignment, ctx.userGroupSetIds))
    .map(mapGroupAssignmentForFeed);

  const assignments = dedupeAssignmentsById([...moduleAssignments, ...visibleGroupAssignments]);
  const filteredAssignments = assignments.filter((a) => !submittedIds.has(String(a._id)));

  const visibleDiscussions = discussions.filter((discussion) =>
    isDiscussionVisibleToStudent(discussion, ctx)
  );

  const repliedThreadIds = await discussionReplyService.batchThreadIdsRepliedByUser(
    visibleDiscussions.map((d) => d._id),
    userId
  );
  queryCount += 2;

  const filteredDiscussions = visibleDiscussions.filter(
    (discussion) => !repliedThreadIds.has(String(discussion._id))
  );

  const allItems = [
    ...filteredAssignments.map((item) => ({
      ...item,
      type: 'assignment',
      itemType: 'Assignment',
    })),
    ...filteredDiscussions.map((item) => ({
      ...item,
      type: 'discussion',
      itemType: 'Discussion',
      module: item.module || { course: item.course },
    })),
  ].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  recordTodoQueryMetric('student_due_all', {
    queryCount,
    resultCount: allItems.length,
    durationMs: Date.now() - started,
  });

  return allItems;
}

const OVERDUE_THRESHOLD_HOURS = 24;

/**
 * Published assignments past due without submission — missing (<24h) or overdue (>=24h).
 */
async function getStudentMissingAndOverdueAssignments(userId, options = {}) {
  const started = Date.now();
  let queryCount = 0;
  const now = new Date();

  const sharedContext = options.plannerContext;
  const ctx = sharedContext || (await loadStudentEnrolledPlannerContext(userId));
  if (!sharedContext) {
    queryCount += 3;
  }
  if (!ctx) {
    recordTodoQueryMetric('student_missing_overdue', {
      queryCount,
      resultCount: 0,
      durationMs: Date.now() - started,
    });
    return [];
  }

  const submittedIds = sharedContext?.submittedAssignmentIds
    ? sharedContext.submittedAssignmentIds
    : await getStudentSubmittedAssignmentIds(userId, { userGroups: ctx.userGroups });
  if (!sharedContext?.submittedAssignmentIds) {
    queryCount += 2;
  }

  const assignmentFilter = buildMissingOverdueAssignmentFilter(now);

  const [moduleAssignments, groupAssignments] = await Promise.all([
    findModuleAssignmentsForPlanner(assignmentFilter, ctx.moduleIds),
    findGroupAssignmentsForPlanner(assignmentFilter, ctx.userGroupSetIds),
  ]);
  queryCount += 2;

  const visibleGroupAssignments = groupAssignments
    .filter((assignment) => isGroupAssignmentVisibleToStudent(assignment, ctx.userGroupSetIds))
    .map(mapGroupAssignmentForFeed);

  const assignments = dedupeAssignmentsById([...moduleAssignments, ...visibleGroupAssignments]);

  const items = [];
  for (const assignment of assignments) {
    if (submittedIds.has(String(assignment._id))) continue;
    const hoursPastDue = (now - new Date(assignment.dueDate)) / (1000 * 60 * 60);
    const subType = hoursPastDue >= OVERDUE_THRESHOLD_HOURS ? 'overdue' : 'missing';
    items.push({
      ...assignment,
      type: 'assignment',
      itemType: 'Assignment',
      subType,
    });
  }

  recordTodoQueryMetric('student_missing_overdue', {
    queryCount,
    resultCount: items.length,
    durationMs: Date.now() - started,
  });

  return items;
}

module.exports = {
  getTeacherUngradedTodoItems,
  getStudentSubmittedAssignmentIds,
  getStudentDueAllItemsThisWeek,
  getStudentMissingAndOverdueAssignments,
  loadStudentEnrolledPlannerContext,
  buildStudentPlannerContext,
  recordTodoQueryMetric,
  resolvePlannerMissingLookbackDays,
  buildMissingOverdueAssignmentFilter,
};
