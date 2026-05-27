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

module.exports = {
  assertStudentCanGradeDiscussion,
  assertStudentCanModerateDiscussion,
  assertStudentCanReply,
  assertStudentCanViewDiscussion,
  assertStudentCanViewGroupDiscussion,
  filterDiscussionForStudent,
  hasUserPosted,
  isCourseStaff,
  loadDiscussionContext,
  normalizeId,
  paginateReplies,
};
