/**
 * Automatic grading-period assignment.
 *
 * Grading periods carry an optional [startDate, endDate] range. Assignments and
 * graded discussions are slotted into the period whose range contains their due
 * date. Items with no due date (or whose due date falls outside every range) go
 * to the last grading period (chronologically latest).
 */
const CourseGradingPeriod = require('../models/courseGradingPeriod.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const GroupSet = require('../models/GroupSet');
const Thread = require('../models/thread.model');

function toTime(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** End-of-day (local) so a due date on the period's last day still counts. */
function endOfDayTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Chronological order: by startDate, then endDate, then position, then createdAt.
 * Periods without dates fall to the end so a dated "current" period stays before
 * an undated catch-all when possible.
 */
function sortPeriodsChronologically(periods) {
  return [...periods].sort((a, b) => {
    const aKey = toTime(a.startDate) ?? toTime(a.endDate);
    const bKey = toTime(b.startDate) ?? toTime(b.endDate);
    if (aKey != null && bKey != null && aKey !== bKey) return aKey - bKey;
    if (aKey != null && bKey == null) return -1;
    if (aKey == null && bKey != null) return 1;
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    if (posA !== posB) return posA - posB;
    return toTime(a.createdAt) - toTime(b.createdAt);
  });
}

/**
 * Pick the grading period a due date belongs to.
 * @param {Array} periods raw period docs (unsorted ok)
 * @param {Date|string|null} dueDate
 * @returns {string|null} period id, or null when there are no periods
 */
function resolvePeriodIdForDueDate(periods, dueDate) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const sorted = sortPeriodsChronologically(periods);

  const due = toTime(dueDate);
  if (due != null) {
    for (const p of sorted) {
      const start = toTime(p.startDate);
      const end = endOfDayTime(p.endDate);
      const afterStart = start == null || due >= start;
      const beforeEnd = end == null || due <= end;
      if (afterStart && beforeEnd) return String(p._id);
    }
  }

  // No due date, or due date outside every configured range → last period.
  return String(sorted[sorted.length - 1]._id);
}

/** Load periods for a course and resolve the target for a single due date. */
async function resolvePeriodIdForCourseDueDate(courseId, dueDate) {
  if (!courseId) return null;
  const periods = await CourseGradingPeriod.find({ course: courseId }).lean();
  return resolvePeriodIdForDueDate(periods, dueDate);
}

/**
 * Canvas "current grading period" default:
 * 1. The period whose [startDate, endDate] contains today.
 * 2. Else the most recent period that has already ended.
 * 3. Else the earliest upcoming period.
 * 4. Else the last period (or null when none exist).
 * @returns {string|null} period id
 */
function resolveCurrentPeriodId(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const sorted = sortPeriodsChronologically(periods);
  const now = Date.now();

  for (const p of sorted) {
    const start = toTime(p.startDate);
    const end = endOfDayTime(p.endDate);
    const afterStart = start == null || now >= start;
    const beforeEnd = end == null || now <= end;
    if (afterStart && beforeEnd) return String(p._id);
  }

  const ended = sorted.filter((p) => {
    const end = endOfDayTime(p.endDate);
    return end != null && now > end;
  });
  if (ended.length) return String(ended[ended.length - 1]._id);

  const upcoming = sorted.filter((p) => {
    const start = toTime(p.startDate);
    return start != null && now < start;
  });
  if (upcoming.length) return String(upcoming[0]._id);

  return String(sorted[sorted.length - 1]._id);
}

/** A period is locked for grade edits when explicitly closed or its close date has passed. */
function isPeriodClosed(period) {
  if (!period) return false;
  if (period.closed === true) return true;
  const close = toTime(period.closeDate);
  return close != null && Date.now() > close;
}

/**
 * Throws (409) when the given assignment/thread belongs to a closed grading period.
 * Safe no-op when the item has no period or the period is open.
 */
async function assertGradingPeriodEditable(courseId, gradingPeriodId) {
  if (!courseId || !gradingPeriodId) return;
  const period = await CourseGradingPeriod.findOne({
    _id: gradingPeriodId,
    course: courseId,
  }).lean();
  if (isPeriodClosed(period)) {
    const err = new Error(
      `Grading period "${period.name}" is closed. Grades can no longer be edited.`
    );
    err.statusCode = 409;
    throw err;
  }
}

async function loadCourseAssignmentRefs(courseId) {
  const modules = await Module.find({ course: courseId }).select('_id').lean();
  const moduleIds = modules.map((m) => m._id);
  const groupSets = await GroupSet.find({ course: courseId }).select('_id').lean();
  const groupSetIds = groupSets.map((g) => g._id);

  const or = [];
  if (moduleIds.length) or.push({ module: { $in: moduleIds } });
  if (groupSetIds.length) or.push({ isGroupAssignment: true, groupSet: { $in: groupSetIds } });
  if (or.length === 0) return [];

  return Assignment.find({ $or: or }).select('_id dueDate gradingPeriodId').lean();
}

/**
 * Re-slot every assignment and graded discussion in a course into the grading
 * period matching its due date. Called when periods are created or their dates
 * change. Returns counts of updated docs.
 */
async function countItemsInPeriod(courseId, periodId) {
  const pid = String(periodId);
  const assignments = await loadCourseAssignmentRefs(courseId);
  const assignmentCount = assignments.filter((a) => String(a.gradingPeriodId || '') === pid).length;

  const discussionCount = await Thread.countDocuments({
    course: courseId,
    gradingPeriodId: periodId,
  });

  return { assignmentCount, discussionCount };
}

/**
 * Canvas-style: assignments/discussions in a deleted period become unassigned (null).
 * Grades and submissions are never deleted.
 */
async function unassignItemsFromPeriod(courseId, periodId) {
  const pid = String(periodId);

  const assignments = await loadCourseAssignmentRefs(courseId);
  const assignmentOps = [];
  for (const a of assignments) {
    if (String(a.gradingPeriodId || '') === pid) {
      assignmentOps.push({
        updateOne: { filter: { _id: a._id }, update: { $set: { gradingPeriodId: null } } },
      });
    }
  }
  if (assignmentOps.length) await Assignment.bulkWrite(assignmentOps);

  const threadResult = await Thread.updateMany(
    { course: courseId, gradingPeriodId: periodId },
    { $set: { gradingPeriodId: null } }
  );

  return {
    assignmentsUnassigned: assignmentOps.length,
    discussionsUnassigned: threadResult.modifiedCount || 0,
  };
}

async function reconcileCoursePeriodAssignments(courseId) {
  const periods = await CourseGradingPeriod.find({ course: courseId }).lean();
  if (!periods.length) return { assignmentsUpdated: 0, discussionsUpdated: 0 };
  const sorted = sortPeriodsChronologically(periods);

  const assignments = await loadCourseAssignmentRefs(courseId);
  const assignmentOps = [];
  for (const a of assignments) {
    const target = resolvePeriodIdForDueDate(sorted, a.dueDate);
    if (String(a.gradingPeriodId || '') !== String(target || '')) {
      assignmentOps.push({
        updateOne: { filter: { _id: a._id }, update: { $set: { gradingPeriodId: target } } },
      });
    }
  }
  if (assignmentOps.length) await Assignment.bulkWrite(assignmentOps);

  const threads = await Thread.find({ course: courseId })
    .select('_id dueDate gradingPeriodId')
    .lean();
  const threadOps = [];
  for (const t of threads) {
    const target = resolvePeriodIdForDueDate(sorted, t.dueDate);
    if (String(t.gradingPeriodId || '') !== String(target || '')) {
      threadOps.push({
        updateOne: { filter: { _id: t._id }, update: { $set: { gradingPeriodId: target } } },
      });
    }
  }
  if (threadOps.length) await Thread.bulkWrite(threadOps);

  return { assignmentsUpdated: assignmentOps.length, discussionsUpdated: threadOps.length };
}

module.exports = {
  sortPeriodsChronologically,
  resolvePeriodIdForDueDate,
  resolvePeriodIdForCourseDueDate,
  resolveCurrentPeriodId,
  isPeriodClosed,
  assertGradingPeriodEditable,
  countItemsInPeriod,
  unassignItemsFromPeriod,
  reconcileCoursePeriodAssignments,
};
