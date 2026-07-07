const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const Thread = require('../models/thread.model');
const {
  isCourseGradingStaff,
  isCourseInstructor,
  isCourseTeachingAssistant,
  isEnrolledStudent,
} = require('../middleware/academicPermissions');
const discussionWorkflow = require('./discussionWorkflow.service');
const discussionGradeVisibility = require('./discussionGradeVisibility.service');
const observability = require('./workflowObservability.service');

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function accessError(message, statusCode, code, details = {}) {
  observability.metric('discussion_access_denied', { code, statusCode });
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isStudent(user) {
  return user?.role === 'student';
}

function isCourseStaff(user, course) {
  if (!user || !course) return false;
  if (isAdmin(user)) return true;
  return isCourseGradingStaff(user, course);
}

async function loadDiscussionContext(threadOrId) {
  const thread =
    threadOrId && typeof threadOrId === 'object' && threadOrId._id
      ? threadOrId
      : await Thread.findById(threadOrId);

  if (!thread || thread.deletedAt) {
    throw accessError('Discussion not found', 404, 'DISCUSSION_NOT_FOUND');
  }

  const [course, module, groupSet, group] = await Promise.all([
    Course.findById(normalizeId(thread.course)),
    thread.module ? Module.findById(normalizeId(thread.module)) : null,
    thread.groupSet ? GroupSet.findById(normalizeId(thread.groupSet)) : null,
    thread.groupId ? Group.findById(normalizeId(thread.groupId)) : null,
  ]);

  if (!course) {
    throw accessError('Discussion course could not be resolved', 404, 'COURSE_NOT_FOUND');
  }

  return { thread, course, module, groupSet, group };
}

async function userGroupMembership(user, thread) {
  if (!thread?.groupSet || !user?._id) return null;
  if (thread.groupId) {
    return Group.findOne({
      _id: thread.groupId,
      groupSet: thread.groupSet,
      members: user._id,
    }).lean();
  }
  return Group.findOne({
    groupSet: thread.groupSet,
    members: user._id,
  }).lean();
}

async function assertStaffCanAct(user, threadOrId, code = 'DISCUSSION_STAFF_REQUIRED') {
  const context = await loadDiscussionContext(threadOrId);
  if (isAdmin(user)) return context;
  if (!isCourseStaff(user, context.course)) {
    observability.metric('discussion_unauthorized_moderation_attempt', {
      code,
      threadId: normalizeId(context.thread),
      userId: normalizeId(user),
    });
    throw accessError('Not authorized for this course discussion', 403, code);
  }
  return context;
}

async function assertStudentCanViewGroupDiscussion(user, threadOrId) {
  const context = await loadDiscussionContext(threadOrId);
  const { thread } = context;
  if (!thread.groupSet) return context;
  if (isAdmin(user) || isCourseStaff(user, context.course)) return context;
  const membership = await userGroupMembership(user, thread);
  if (!membership) {
    throw accessError('Not authorized to view this group discussion', 403, 'GROUP_DISCUSSION_FORBIDDEN', {
      groupSet: normalizeId(thread.groupSet),
      groupId: normalizeId(thread.groupId),
    });
  }
  return { ...context, membership };
}

async function assertStudentCanViewDiscussion(user, threadOrId, options = {}) {
  const context = await loadDiscussionContext(threadOrId);
  const { thread, course, module } = context;
  const now = options.now || new Date();

  if (isAdmin(user) || isCourseStaff(user, course)) {
    const finalized = await discussionWorkflow.isCourseFinalized(course);
    return { ...context, workflowState: discussionWorkflow.deriveDiscussionWorkflowState(thread, { course, module, now, finalized }) };
  }

  if (!isStudent(user)) {
    throw accessError('Not authorized for this course discussion', 403, 'COURSE_STAFF_REQUIRED');
  }

  if (!isEnrolledStudent(user, course)) {
    throw accessError('Student is not enrolled in this course', 403, 'NOT_ENROLLED');
  }

  if (course.operationalStatus === 'archived' && options.allowArchivedRead !== true) {
    throw accessError('Course is archived', 403, 'COURSE_ARCHIVED');
  }

  if (module && module.published === false) {
    throw accessError('Module is not published', 403, 'MODULE_NOT_PUBLISHED');
  }

  if (!discussionWorkflow.isDiscussionPublished(thread)) {
    throw accessError('Discussion is not published', 404, 'DISCUSSION_NOT_PUBLISHED');
  }

  if (thread.moderationState === 'hidden' || thread.moderation?.state === 'hidden') {
    throw accessError('Discussion is hidden', 404, 'DISCUSSION_HIDDEN');
  }

  if (!discussionWorkflow.isDiscussionAvailable(thread, now)) {
    throw accessError('Discussion is not available yet', 403, 'DISCUSSION_NOT_AVAILABLE', {
      availableFrom: thread.availableFrom,
    });
  }

  if (thread.groupSet) {
    const membership = await userGroupMembership(user, thread);
    if (!membership) {
      throw accessError('Not authorized to view this group discussion', 403, 'GROUP_DISCUSSION_FORBIDDEN');
    }
  }

  const finalized = await discussionWorkflow.isCourseFinalized(course);
  return { ...context, workflowState: discussionWorkflow.deriveDiscussionWorkflowState(thread, { course, module, now, finalized }) };
}

async function assertStudentCanReply(user, threadOrId, options = {}) {
  const context = await assertStudentCanViewDiscussion(user, threadOrId, options);
  const { thread, course, module } = context;
  const now = options.now || new Date();
  const finalized = await discussionWorkflow.isCourseFinalized(course);

  if (thread.settings?.allowComments === false) {
    throw accessError('Comments are disabled for this discussion', 403, 'COMMENTS_DISABLED');
  }

  if (discussionWorkflow.isDiscussionLocked(thread, course, now, finalized)) {
    throw accessError('Discussion is locked', 403, 'DISCUSSION_LOCKED');
  }

  return {
    ...context,
    workflowState: discussionWorkflow.deriveDiscussionWorkflowState(thread, { course, module, now, finalized }),
  };
}

/** Authors may edit/delete existing replies while the discussion is locked; lock only blocks new posts. */
async function assertStudentCanModifyOwnReply(user, threadOrId, options = {}) {
  const context = await assertStudentCanViewDiscussion(user, threadOrId, options);
  const { thread } = context;
  if (thread.settings?.allowComments === false && isStudent(user)) {
    throw accessError('Comments are disabled for this discussion', 403, 'COMMENTS_DISABLED');
  }
  return context;
}

async function assertStudentCanGradeDiscussion(user, threadOrId) {
  return assertStaffCanAct(user, threadOrId, 'DISCUSSION_GRADE_NOT_AUTHORIZED');
}

async function assertStudentCanModerateDiscussion(user, threadOrId) {
  return assertStaffCanAct(user, threadOrId, 'DISCUSSION_MODERATE_NOT_AUTHORIZED');
}

function hasUserPosted(thread, user) {
  const userId = normalizeId(user);
  return (thread?.replies || []).some((reply) => !reply.deletedAt && normalizeId(reply.author) === userId);
}

function userOwnsReply(foundReply, user) {
  if (!foundReply?.reply || !user) return false;
  const { reply, source } = foundReply;
  const authorRef = source === 'collection' ? reply.authorId : reply.author;
  return normalizeId(user) === normalizeId(authorRef);
}

function redactDeletedReply(reply) {
  if (!reply?.deletedAt) return reply;
  return {
    _id: reply._id,
    parentReply: reply.parentReply || null,
    deletedAt: reply.deletedAt,
    deletedBy: reply.deletedBy,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
    content: '',
    isDeleted: true,
    author: reply.author,
    likes: [],
    fileAssets: [],
  };
}

function paginateReplies(replies, options = {}) {
  const rootOnly = options.rootOnly === true;
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  if (String(options.limit) === '0') {
    const visible = (replies || []).filter((reply) => !rootOnly || !reply.parentReply);
    return {
      replies: [],
      pagination: {
        page,
        limit: 0,
        total: visible.length,
        totalPages: 1,
      },
    };
  }
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 50));
  const visible = (replies || []).filter((reply) => !rootOnly || !reply.parentReply);
  const total = visible.length;
  const start = (page - 1) * limit;
  return {
    replies: visible.slice(start, start + limit).map(redactDeletedReply),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

function filterDiscussionForStudent(user, thread, options = {}) {
  const obj = thread?.toObject ? thread.toObject({ virtuals: true }) : { ...thread };
  const isStudentUser = user?.role === 'student';

  obj.replyCount = obj.counters?.replyCount ?? (obj.replies || []).filter((reply) => !reply.deletedAt).length;
  obj.workflowState = options.workflowState || obj.workflowState || null;
  obj.hasSubmitted = options.hasSubmitted ?? obj.hasSubmitted ?? hasUserPosted(obj, user);

  if (!isStudentUser) {
    return obj;
  }

  obj.studentGrades = discussionGradeVisibility.filterStudentGradesForUser(obj, user);

  const gradeRow = discussionGradeVisibility.findStudentGrade(obj, user._id);
  obj.gradeVisibility = discussionGradeVisibility.resolveDiscussionGradeVisibility(obj, gradeRow);
  const visibleRow = discussionGradeVisibility.discussionGradeForTotals(obj, user._id);
  if (visibleRow) {
    const { resolveAssignmentGrade } = require('../utils/gradeCalculation');
    obj.grade = resolveAssignmentGrade({ discussionGradeRow: visibleRow });
  } else {
    obj.grade = null;
  }

  if (obj.settings?.requirePostBeforeSee && !obj.hasSubmitted) {
    obj.replies = [];
    obj.replyCount = 0;
    obj.repliesHiddenUntilPost = true;
    return obj;
  }

  if (!obj.repliesPagination) {
    const paged = paginateReplies(obj.replies || [], options.replies || {});
    obj.replies = paged.replies;
    obj.repliesPagination = paged.pagination;
  }
  return obj;
}

/**
 * Course-scoped staff recipient IDs for discussion notifications (instructor, admins, TAs).
 */
function resolveCourseStaffRecipientIds(course) {
  if (!course) return [];

  const recipients = [];
  const instructorId = normalizeId(course.instructor);
  if (instructorId) recipients.push(instructorId);

  for (const adminId of course.admins || []) {
    const id = normalizeId(adminId);
    if (id) recipients.push(id);
  }

  for (const taId of course.teachingAssistants || []) {
    const id = normalizeId(taId);
    if (id) recipients.push(id);
  }

  return [...new Set(recipients)];
}

/**
 * Student recipient IDs for discussion notifications — course-wide or group-scoped.
 */
async function resolveDiscussionStudentRecipientIds(thread, course) {
  if (!course || !thread) return [];

  const { resolveActiveCourseStudentIds } = require('./notification/courseEnrollmentRecipients.service');
  const enrolledStudentIds = new Set(await resolveActiveCourseStudentIds(course));
  if (!enrolledStudentIds.size) return [];

  if (!thread.groupSet) {
    return [...enrolledStudentIds];
  }

  const groupQuery = { groupSet: thread.groupSet };
  if (thread.groupId) {
    groupQuery._id = thread.groupId;
  }

  const groups = await Group.find(groupQuery).select('members').lean();
  const memberIds = new Set();
  for (const group of groups) {
    for (const memberId of group.members || []) {
      const id = normalizeId(memberId);
      if (id && enrolledStudentIds.has(id)) {
        memberIds.add(id);
      }
    }
  }

  return [...memberIds];
}

function uniqueNormalizedIds(values) {
  const set = new Set();
  for (const value of values) {
    const id = normalizeId(value);
    if (id) set.add(id);
  }
  return [...set];
}

function mapByNormalizedId(docs) {
  const map = new Map();
  for (const doc of docs || []) {
    map.set(normalizeId(doc._id || doc), doc);
  }
  return map;
}

function resolveThreadListAccessContext(user, thread, bundle, options = {}) {
  const { courseById, moduleById, finalizedByCourse, membershipByGroupId, membershipByGroupSet, now } = bundle;
  const allowArchivedRead = options.allowArchivedRead === true;

  const courseId = normalizeId(thread.course);
  const course = courseById.get(courseId);
  if (!course) {
    throw accessError('Discussion course could not be resolved', 404, 'COURSE_NOT_FOUND');
  }

  const module = thread.module ? moduleById.get(normalizeId(thread.module)) : null;
  const groupSet = thread.groupSet || null;
  const group = thread.groupId ? membershipByGroupId.get(normalizeId(thread.groupId)) || null : null;
  const finalized = finalizedByCourse.get(courseId) ?? false;

  if (isAdmin(user) || isCourseStaff(user, course)) {
    return {
      thread,
      course,
      module,
      groupSet,
      group,
      workflowState: discussionWorkflow.deriveDiscussionWorkflowState(thread, { course, module, now, finalized }),
    };
  }

  if (!isStudent(user)) {
    throw accessError('Not authorized for this course discussion', 403, 'COURSE_STAFF_REQUIRED');
  }

  if (!isEnrolledStudent(user, course)) {
    throw accessError('Student is not enrolled in this course', 403, 'NOT_ENROLLED');
  }

  if (course.operationalStatus === 'archived' && !allowArchivedRead) {
    throw accessError('Course is archived', 403, 'COURSE_ARCHIVED');
  }

  if (module && module.published === false) {
    throw accessError('Module is not published', 403, 'MODULE_NOT_PUBLISHED');
  }

  if (!discussionWorkflow.isDiscussionPublished(thread)) {
    throw accessError('Discussion is not published', 404, 'DISCUSSION_NOT_PUBLISHED');
  }

  if (thread.moderationState === 'hidden' || thread.moderation?.state === 'hidden') {
    throw accessError('Discussion is hidden', 404, 'DISCUSSION_HIDDEN');
  }

  if (!discussionWorkflow.isDiscussionAvailable(thread, now)) {
    throw accessError('Discussion is not available yet', 403, 'DISCUSSION_NOT_AVAILABLE', {
      availableFrom: thread.availableFrom,
    });
  }

  if (thread.groupSet) {
    const groupSetId = normalizeId(thread.groupSet);
    const hasMembership = thread.groupId
      ? membershipByGroupId.has(normalizeId(thread.groupId))
      : membershipByGroupSet.has(groupSetId);
    if (!hasMembership) {
      throw accessError('Not authorized to view this group discussion', 403, 'GROUP_DISCUSSION_FORBIDDEN');
    }
  }

  return {
    thread,
    course,
    module,
    groupSet,
    group,
    workflowState: discussionWorkflow.deriveDiscussionWorkflowState(thread, { course, module, now, finalized }),
  };
}

/**
 * Batch-load course/module/group context once per list page (avoids N+1 access checks).
 */
async function buildThreadListAccessBundle(user, threads, options = {}) {
  const now = options.now || new Date();
  if (!threads?.length) {
    return { entries: [], filteredReasons: {}, filteredCount: 0 };
  }

  const courseIds = uniqueNormalizedIds(threads.map((t) => t.course));
  const moduleIds = uniqueNormalizedIds(threads.map((t) => t.module).filter(Boolean));
  const groupSetIds = uniqueNormalizedIds(threads.map((t) => t.groupSet).filter(Boolean));
  const threadGroupIds = uniqueNormalizedIds(threads.map((t) => t.groupId).filter(Boolean));

  const [courses, modules, userGroups] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).lean(),
    moduleIds.length ? Module.find({ _id: { $in: moduleIds } }).lean() : Promise.resolve([]),
    user?._id && (groupSetIds.length || threadGroupIds.length)
      ? Group.find({
          members: user._id,
          $or: [
            ...(groupSetIds.length ? [{ groupSet: { $in: groupSetIds } }] : []),
            ...(threadGroupIds.length ? [{ _id: { $in: threadGroupIds } }] : []),
          ],
        })
          .select('_id groupSet')
          .lean()
      : Promise.resolve([]),
  ]);

  const courseById = mapByNormalizedId(courses);
  const moduleById = mapByNormalizedId(modules);
  const finalizedByCourse = new Map();
  await Promise.all(
    courseIds.map(async (courseId) => {
      const course = courseById.get(courseId);
      finalizedByCourse.set(courseId, course ? await discussionWorkflow.isCourseFinalized(course) : false);
    })
  );

  const membershipByGroupId = new Map();
  const membershipByGroupSet = new Map();
  for (const memberGroup of userGroups) {
    membershipByGroupId.set(normalizeId(memberGroup._id), memberGroup);
    membershipByGroupSet.set(normalizeId(memberGroup.groupSet), memberGroup);
  }

  const bundle = {
    courseById,
    moduleById,
    finalizedByCourse,
    membershipByGroupId,
    membershipByGroupSet,
    now,
  };

  const entries = [];
  const filteredReasons = {};
  let filteredCount = 0;

  for (const thread of threads) {
    try {
      const context = resolveThreadListAccessContext(user, thread, bundle, options);
      entries.push({ thread, context });
    } catch (error) {
      if (error.statusCode >= 500) throw error;
      filteredCount += 1;
      const code = error.code || 'UNKNOWN';
      filteredReasons[code] = (filteredReasons[code] || 0) + 1;
    }
  }

  return { entries, filteredReasons, filteredCount };
}

module.exports = {
  assertStudentCanGradeDiscussion,
  assertStudentCanModerateDiscussion,
  assertStudentCanModifyOwnReply,
  assertStudentCanReply,
  assertStudentCanViewDiscussion,
  assertStudentCanViewGroupDiscussion,
  buildThreadListAccessBundle,
  filterDiscussionForStudent,
  hasUserPosted,
  resolveDiscussionStudentRecipientIds,
  resolveCourseStaffRecipientIds,
  isCourseStaff,
  loadDiscussionContext,
  userOwnsReply,
  normalizeId,
  paginateReplies,
  resolveThreadListAccessContext,
};
