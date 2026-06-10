const Thread = require('../models/thread.model');

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const LIST_SELECT =
  'title course module groupSet groupId author fileAssets counters lastActivity isPinned isGraded totalPoints group published dueDate settings moderationState createdAt updatedAt';

function parseListPagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIST_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

function applyThreadListPopulates(query) {
  return query
    .populate('author', 'firstName lastName role profilePicture')
    .populate('groupSet', 'name')
    .populate('groupId', 'name groupSet');
}

async function fetchCourseThreadList(courseId, query = {}) {
  const { page, limit, skip } = parseListPagination(query);
  const filter = { course: courseId, deletedAt: null };

  const [threads, total] = await Promise.all([
    applyThreadListPopulates(
      Thread.find(filter).select(LIST_SELECT).sort({ lastActivity: -1 }).skip(skip).limit(limit).lean()
    ),
    Thread.countDocuments(filter),
  ]);

  return {
    threads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function fetchGroupSetThreadList(groupSetId, query = {}) {
  const { page, limit, skip } = parseListPagination(query);
  const filter = { groupSet: groupSetId, deletedAt: null };

  const [threads, total] = await Promise.all([
    applyThreadListPopulates(
      Thread.find(filter).select(LIST_SELECT).sort({ lastActivity: -1 }).skip(skip).limit(limit).lean()
    ),
    Thread.countDocuments(filter),
  ]);

  return {
    threads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  LIST_SELECT,
  parseListPagination,
  fetchCourseThreadList,
  fetchGroupSetThreadList,
};
