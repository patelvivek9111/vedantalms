const { getSemesterFromCourse } = require('../utils/semesterUtils');

function getGradeLifecycleService() {
  // Lazy-load to avoid circular dependency snapshotting an empty exports object.
  return require('./gradeLifecycle.service');
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isArchivedCourse(course) {
  return course?.operationalStatus === 'archived';
}

async function getCourseLifecycle(course) {
  if (!course?._id) return null;
  const { term, year } = getSemesterFromCourse(course);
  const gradeLifecycleService = getGradeLifecycleService();
  if (typeof gradeLifecycleService.getLifecycle !== 'function') return null;
  return gradeLifecycleService.getLifecycle(course._id, term, year);
}

async function isCourseFinalized(course) {
  const gradeLifecycleService = getGradeLifecycleService();
  const lifecycle = await getCourseLifecycle(course);
  if (!gradeLifecycleService?.FINALIZED_STATUSES) return false;
  return Boolean(lifecycle && gradeLifecycleService.FINALIZED_STATUSES.has(lifecycle.status));
}

/**
 * Explicit false => unpublished. true / undefined / null => published (legacy rows omitted `published`).
 */
function isDiscussionPublished(thread) {
  if (thread?.published === false) return false;
  return true;
}

function isDiscussionAvailable(thread, now = new Date()) {
  if (!isDiscussionPublished(thread)) return false;
  const availableFrom = normalizeDate(thread?.availableFrom);
  return !availableFrom || now >= availableFrom;
}

function isDiscussionLocked(thread, course, now = new Date(), finalized = false) {
  if (thread?.locked === true) return true;
  if (thread?.archivedAt) return true;
  if (isArchivedCourse(course)) return true;
  if (finalized) return true;
  const dueDate = normalizeDate(thread?.dueDate);
  return Boolean(thread?.lockAfterDue && dueDate && now > dueDate);
}

function isDiscussionGradeReleased(thread) {
  if (thread?.gradeHidden === true) return false;
  const mode = thread?.discussionReleaseMode || 'immediate';
  if (mode === 'hidden') return false;
  if (thread?.gradesReleasedAt) return true;
  return mode === 'immediate';
}

function deriveDiscussionWorkflowState(thread, { course, module, now = new Date(), finalized = false } = {}) {
  const dueDate = normalizeDate(thread?.dueDate);
  const available = isDiscussionAvailable(thread, now);
  const locked = isDiscussionLocked(thread, course, now, finalized);
  const released = isDiscussionGradeReleased(thread);

  return {
    draft: thread?.published === false,
    published: isDiscussionPublished(thread),
    available,
    locked,
    due: Boolean(dueDate && now > dueDate),
    graded: thread?.isGraded === true,
    released,
    archived: Boolean(thread?.archivedAt || isArchivedCourse(course)),
    modulePublished: module ? module.published !== false : true,
    availableFrom: thread?.availableFrom || null,
    dueDate: thread?.dueDate || null,
    lockAfterDue: thread?.lockAfterDue === true,
    finalized: Boolean(finalized),
  };
}

module.exports = {
  deriveDiscussionWorkflowState,
  getCourseLifecycle,
  isArchivedCourse,
  isCourseFinalized,
  isDiscussionAvailable,
  isDiscussionGradeReleased,
  isDiscussionLocked,
  isDiscussionPublished,
};
