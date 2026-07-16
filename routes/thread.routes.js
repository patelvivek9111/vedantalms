const express = require('express');
const router = express.Router();
const Thread = require('../models/thread.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const { protect, authorize } = require('../middleware/auth');
const fileAssetService = require('../services/fileAsset.service');
const discussionAccess = require('../services/discussionAccess.service');
const discussionWorkflow = require('../services/discussionWorkflow.service');
const discussionGradeVisibility = require('../services/discussionGradeVisibility.service');
const discussionReplyService = require('../services/discussionReply.service');
const discussionParticipation = require('../services/discussionParticipation.service');
const discussionStatus = require('../services/discussionStatus.service');
const discussionObservability = require('../services/discussionObservability.service');
const discussionListDiagnostics = require('../services/discussionListDiagnostics.service');
const discussionListService = require('../services/discussionList.service');
const gradingPeriodAssignmentService = require('../services/gradingPeriodAssignment.service');
const { sanitizeDiscussionHtml } = require('../services/discussionSanitizer.service');
const DiscussionAuditEvent = require('../models/discussionAuditEvent.model');
const gradeLifecycleService = require('../services/gradeLifecycle.service');
const {
  notifyDiscussionCreated,
  notifyDiscussionReplyPosted,
  notifyDiscussionGraded,
} = require('../services/notification/academicNotificationProducers.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

function parseRemoveFileAssetIds(body = {}) {
  let removeIds = body.removeFileAssetIds;
  if (typeof removeIds === 'string') {
    try {
      removeIds = JSON.parse(removeIds);
    } catch {
      removeIds = [];
    }
  }
  return Array.isArray(removeIds) ? removeIds.map(String) : [];
}

async function applyDiscussionFileAssets(target, { fileAssetIds, removeIds, user, courseId, discussionId }) {
  const removeSet = new Set(removeIds);
  if (removeIds.length) {
    for (const id of removeIds) {
      await fileAssetService.deleteFileAsset(id, user, {}).catch(() => {});
    }
    target.fileAssets = (target.fileAssets || []).filter((id) => !removeSet.has(String(id)));
  }
  if (fileAssetIds?.length) {
    await fileAssetService.validateFileAssetIdsForAttach(fileAssetIds, {
      user,
      courseId,
      category: 'discussion',
      ownerOnly: true,
    });
    target.fileAssets = [...new Set([...(target.fileAssets || []).map(String), ...fileAssetIds.map(String)])];
    await fileAssetService.attachFileAssets(fileAssetIds, {
      courseId,
      discussionId,
      category: 'discussion',
    });
  }
}

const populateThread = (query) =>
  query
    .select('-replies')
    .populate('fileAssets', 'originalName mimeType size path')
    .populate('author', 'firstName lastName role profilePicture')
    .populate('studentGrades.student', 'firstName lastName')
    .populate('studentGrades.gradedBy', 'firstName lastName')
    .populate('groupSet', 'name')
    .populate('groupId', 'name groupSet')
    .populate('deletedBy', 'firstName lastName role');

function sendRouteError(res, error, fallback = 'Discussion request failed') {
  const status = error.statusCode || 500;
  if (status >= 500) {
    console.error(fallback, error);
  }
  return res.status(status).json({
    success: false,
    message: error.message || fallback,
    code: error.code,
  });
}

/** Per-user filtered lists must not be cached (304 + stale body hid threads after fixes). */
function setNoStoreThreadListHeaders(res) {
  res.set('Cache-Control', 'private, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Vary', 'Authorization');
}

async function recordDiscussionAudit({ req, thread, replyId = null, action, before = null, after = null, metadata = {} }) {
  if (!thread?._id || !req.user?._id) return;
  await DiscussionAuditEvent.create({
    thread: thread._id,
    replyId,
    actor: req.user._id,
    action,
    before,
    after,
    metadata,
    ip: req.ip,
  }).catch(() => {});
}

async function serializeThreadForUser(req, thread, context = {}, options = {}) {
  const pageOptions = {
    page: req.query.replyPage || req.query.page,
    limit: req.query.replyLimit || req.query.limit,
    rootOnly: req.query.rootOnly === 'true',
    userId: req.user?._id,
    ...options.replies,
  };
  const threadWithReplies =
    String(pageOptions.limit) === '0'
      ? (thread?.toObject ? thread.toObject({ virtuals: true }) : { ...thread, replies: thread.replies || [] })
      : await discussionReplyService.populateThreadReplyPage(thread, pageOptions);
  const hasSubmitted =
    req.user?.role === 'student'
      ? options.hasSubmittedPrefetched !== undefined
        ? options.hasSubmittedPrefetched
        : await discussionReplyService.hasReplyByUser(thread, req.user._id)
      : undefined;
  const payload = discussionAccess.filterDiscussionForStudent(req.user, threadWithReplies, {
    workflowState: context.workflowState,
    hasSubmitted,
    replies: pageOptions,
  });
  if (req.user?.role !== 'student') {
    payload.replyCount = payload.counters?.replyCount ?? payload.replyCount ?? 0;
    if (req.query.includeGrades !== 'true' && options.includeGrades !== true) {
      payload.studentGradeCount = Array.isArray(payload.studentGrades) ? payload.studentGrades.length : 0;
      payload.studentGrades = [];
    }
  }
  if (req.user?._id) {
    const participationRow = options.batchParticipationLoaded
      ? options.participationPrefetched || {
          hasPosted: !!hasSubmitted,
          unreadCount: 0,
          lastViewedAt: null,
          hasInstructorReply: false,
        }
      : await discussionParticipation.getReadState(payload._id, req.user._id);
    payload.currentUserParticipation = participationRow;
    payload.unreadCount = participationRow.unreadCount || 0;
    payload.hasPosted = participationRow.hasPosted || payload.hasSubmitted || false;
    payload.lastViewedAt = participationRow.lastViewedAt || null;
    payload.hasInstructorReply = participationRow.hasInstructorReply || false;
  }
  const listReplyCountOverride = options.replyCountAggregate;
  if (!payload.repliesHiddenUntilPost && typeof listReplyCountOverride === 'number') {
    payload.replyCount = Math.max(payload.replyCount ?? 0, listReplyCountOverride);
  }
  if (options.studentReplyCreatedAt != null) {
    payload.studentReplyCreatedAt = options.studentReplyCreatedAt;
  }
  return discussionStatus.attachDiscussionStatus(payload, {
    course: context.course,
    module: context.module,
    user: req.user,
  });
}

async function resolveCourseIdForListDebug(req, routeType, threads) {
  if (routeType === 'course') return req.params.courseId;
  if (routeType === 'module') {
    const mod = await Module.findById(req.params.moduleId).select('course').lean();
    return mod?.course ? String(mod.course) : null;
  }
  if (routeType === 'groupset') {
    const first = threads[0];
    return first?.course ? String(first.course) : null;
  }
  return null;
}

async function buildFilteredThreadListResponse(req, threads, routeType, { extraGate = null, listPagination = null } = {}) {
  const debugVisibility = req.query.debugVisibility === 'true';
  const courseIdForDebug = debugVisibility ? await resolveCourseIdForListDebug(req, routeType, threads) : null;
  const courseDoc =
    debugVisibility && courseIdForDebug
      ? await Course.findById(courseIdForDebug).select('instructor teachingAssistants students operationalStatus').lean()
      : null;
  const includeDebug =
    debugVisibility && courseDoc && discussionListDiagnostics.canAttachVisibilityDebug(req.user, courseDoc);

  const threadIds = threads.map((t) => String(t._id));
  const replyCountsByThread = await discussionReplyService.batchResolveReplyCountsForList(threadIds);

  const userId = req.user?._id;
  let repliedThreadIds = new Set();
  let participationByThread = new Map();
  let firstReplyAtByThread = new Map();
  if (userId) {
    if (req.user.role === 'student') {
      [repliedThreadIds, firstReplyAtByThread] = await Promise.all([
        discussionReplyService.batchThreadIdsRepliedByUser(threadIds, userId),
        discussionReplyService.batchFirstReplyCreatedAtByUser(threadIds, userId),
      ]);
    }
    participationByThread = await discussionParticipation.summariesForUser(threadIds, userId);
  }

  const { entries, filteredReasons, filteredCount } = await discussionAccess.buildThreadListAccessBundle(
    req.user,
    threads,
    { allowArchivedRead: true }
  );

  const visibleThreads = [];
  for (const { thread, context } of entries) {
    try {
      if (extraGate) {
        await extraGate(req, thread, context);
      }
      const tid = String(thread._id);
      const replyCountAggregate = replyCountsByThread.get(tid) ?? 0;
      visibleThreads.push(
        await serializeThreadForUser(req, thread, context, {
          replies: { limit: 0 },
          replyCountAggregate,
          batchParticipationLoaded: !!userId,
          hasSubmittedPrefetched: req.user?.role === 'student' ? repliedThreadIds.has(tid) : undefined,
          participationPrefetched: participationByThread.get(tid) || null,
          studentReplyCreatedAt: firstReplyAtByThread.get(tid) ?? null,
        })
      );
    } catch (error) {
      if (error.statusCode >= 500) throw error;
      discussionListDiagnostics.recordThreadFiltered({
        routeType,
        thread,
        user: req.user,
        courseId: courseIdForDebug || thread.course,
        error,
      });
    }
  }

  const payload = { success: true, data: visibleThreads };
  if (listPagination) {
    payload.pagination = listPagination;
  }
  if (includeDebug) {
    payload.visibilityDebug = {
      visibleCount: visibleThreads.length,
      filteredCount,
      filteredReasons,
    };
  }
  return payload;
}

// Helper function to check if user is authorized to modify content
const isAuthorized = (user, contentAuthor, isTeacher) => {
  return user._id.toString() === contentAuthor.toString() || isTeacher;
};

// Get all threads for a course
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const { threads, pagination } = await discussionListService.fetchCourseThreadList(
      req.params.courseId,
      req.query
    );

    setNoStoreThreadListHeaders(res);
    res.json(
      await buildFilteredThreadListResponse(req, threads, 'course', { listPagination: pagination })
    );
  } catch (error) {
    sendRouteError(res, error, 'Error fetching course threads');
  }
});

// Get threads for a specific groupset
router.get('/groupset/:groupSetId', protect, async (req, res) => {
  try {
    const { threads, pagination } = await discussionListService.fetchGroupSetThreadList(
      req.params.groupSetId,
      req.query
    );

    setNoStoreThreadListHeaders(res);
    res.json(
      await buildFilteredThreadListResponse(req, threads, 'groupset', {
        listPagination: pagination,
        extraGate: async (r, thread) => {
          await discussionAccess.assertStudentCanViewGroupDiscussion(r.user, thread);
        },
      })
    );
  } catch (error) {
    sendRouteError(res, error, 'Error fetching groupset threads');
  }
});

// Create a new thread
router.post('/', protect, authorize(['teacher', 'teaching_assistant', 'admin']), async (req, res) => {
  try {
    const { 
      title, 
      content, 
      courseId, 
      module, 
      isGraded, 
      totalPoints, 
      group, 
      dueDate, 
      availableFrom,
      locked,
      lockAfterDue,
      discussionReleaseMode,
      gradeHidden,
      groupSet,
      groupId,
      settings,
      fileAssetIds,
      gradingPeriodId,
    } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    if (!discussionAccess.isCourseStaff(req.user, course)) {
      return res.status(403).json({ success: false, message: 'Not authorized to create discussions for this course' });
    }

    const safeFileAssetIds = fileAssetService.parseFileAssetIdsFromBody({ fileAssetIds });
    if (safeFileAssetIds.length) {
      await fileAssetService.validateFileAssetIdsForAttach(safeFileAssetIds, {
        user: req.user,
        courseId,
        category: 'discussion',
        ownerOnly: true,
      });
    }

    const resolvedGradingPeriodId = gradingPeriodId
      ? gradingPeriodId
      : await gradingPeriodAssignmentService.resolvePeriodIdForCourseDueDate(
          courseId,
          dueDate || null
        );

    const thread = new Thread({
      title,
      content: sanitizeDiscussionHtml(content),
      course: courseId,
      author: req.user._id,
      module: module || undefined,
      groupSet: groupSet || undefined,
      groupId: groupId || undefined,
      isGraded: isGraded || false,
      totalPoints: isGraded ? totalPoints : null,
      group: group || 'Discussions',
      dueDate: dueDate || null,
      availableFrom: availableFrom || null,
      locked: locked === true,
      lockAfterDue: lockAfterDue === true,
      discussionReleaseMode: discussionReleaseMode || 'immediate',
      gradeHidden: gradeHidden === true || discussionReleaseMode === 'hidden',
      gradingPeriodId: resolvedGradingPeriodId || null,
      settings: {
        requirePostBeforeSee: settings?.requirePostBeforeSee || false,
        allowLikes: settings?.allowLikes !== undefined ? settings.allowLikes : true,
        allowComments: settings?.allowComments !== undefined ? settings.allowComments : true
      },
      fileAssets: safeFileAssetIds,
    });

    await thread.save();
    if (safeFileAssetIds.length) {
      await fileAssetService.attachFileAssets(safeFileAssetIds, {
        courseId,
        discussionId: thread._id,
        category: 'discussion',
      });
    }
    await recordDiscussionAudit({ req, thread, action: 'discussion_created', after: { title, isGraded } });
    
    notifyDiscussionCreated({
      thread,
      course,
      actor: req.user,
      requestId: req.id,
    }).catch((err) => console.error('discussion.created notification error:', err));

    const populatedThread = await populateThread(Thread.findById(thread._id));

    res.status(201).json({
      success: true,
      data: populatedThread
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating discussion thread'
    });
  }
});

// Get a single thread with replies
router.get('/:threadId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId)
      .select('-replies')
      .populate('fileAssets', 'originalName mimeType size path')
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate('groupId', 'name groupSet')
      .populate('deletedBy', 'firstName lastName role');

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, {
      allowArchivedRead: true,
    });

    const payload = await serializeThreadForUser(req, thread, context);
    if (req.query.includeGrades === 'true' && req.user?.role === 'student') {
      const gradeRow = discussionGradeVisibility.findStudentGrade(thread, req.user._id);
      const visibility = discussionGradeVisibility.resolveDiscussionGradeVisibility(thread, gradeRow);
      if (gradeRow && visibility.mode === 'hidden') {
        discussionObservability.hiddenGradeSurfaceRequest({
          threadId: String(thread._id),
          userId: String(req.user._id),
        });
      }
    }

    setNoStoreThreadListHeaders(res);
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching thread');
  }
});

router.get('/:threadId/summary', protect, async (req, res) => {
  try {
    const thread = await populateThread(Thread.findById(req.params.threadId));
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, {
      allowArchivedRead: true,
    });
    const payload = await serializeThreadForUser(req, thread, context, { replies: { limit: 0 } });
    res.json({ success: true, data: payload });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching discussion summary');
  }
});

router.get('/:threadId/read-state', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId).select('-replies');
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });
    const state = await discussionParticipation.getReadState(thread._id, req.user._id);
    res.json({ success: true, data: state });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching discussion read state');
  }
});

router.post('/:threadId/mark-read', protect, async (req, res) => {
  const startedAt = Date.now();
  try {
    const thread = await Thread.findById(req.params.threadId).select('-replies');
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });
    const state = await discussionParticipation.markThreadRead(thread._id, req.user._id);
    discussionObservability.markReadTiming({
      threadId: String(thread._id),
      userId: String(req.user._id),
      durationMs: Date.now() - startedAt,
    });
    res.json({ success: true, data: state });
  } catch (error) {
    console.warn('discussion_mark_read_failed', {
      threadId: req.params.threadId,
      userId: req.user?._id ? String(req.user._id) : null,
      durationMs: Date.now() - startedAt,
      error: error.message,
    });
    sendRouteError(res, error, 'Error marking discussion read');
  }
});

router.get('/:threadId/participants', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId).select('-replies');
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });
    const participants = await discussionParticipation.participantPreview(thread._id, req.query.limit);
    res.json({ success: true, data: participants });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching discussion participants');
  }
});

router.get('/:threadId/moderation-log', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId).select('-replies');
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    const events = await DiscussionAuditEvent.find({ thread: thread._id })
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50)))
      .populate('actor', 'firstName lastName role')
      .lean();
    res.json({ success: true, data: events });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching discussion moderation log');
  }
});

// Get paginated root replies for a thread
router.get('/:threadId/replies', protect, async (req, res) => {
  const startedAt = Date.now();
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });

    if (
      req.user.role === 'student' &&
      thread.settings?.requirePostBeforeSee &&
      !(await discussionReplyService.hasReplyByUser(thread, req.user._id))
    ) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: Number(req.query.limit) || 50, total: 0, totalPages: 1, nextCursor: null },
        repliesHiddenUntilPost: true,
      });
    }

    const page = await discussionReplyService.listRootReplies(thread, {
      page: req.query.page,
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    discussionObservability.replyPageTiming({
      threadId: String(thread._id),
      userId: req.user?._id ? String(req.user._id) : null,
      count: page.replies.length,
      source: page.source,
      durationMs: Date.now() - startedAt,
    });
    const total = page.pagination?.total || 0;
    if (total >= 500) {
      discussionObservability.largeThreadAccess({
        threadId: String(thread._id),
        totalRootReplies: total,
      });
    }
    res.json({
      success: true,
      data: await discussionReplyService.hydrateRepliesFileAssetsForClient(
        page.replies,
        req.user?._id
      ),
      pagination: page.pagination,
      source: page.source,
    });
  } catch (error) {
    console.warn('discussion_reply_page_failed', {
      threadId: req.params.threadId,
      userId: req.user?._id ? String(req.user._id) : null,
      error: error.message,
    });
    sendRouteError(res, error, 'Error fetching discussion replies');
  }
});

// Add a reply to a thread or to another reply
router.post('/:threadId/replies', protect, async (req, res) => {
  try {
    const { content, parentReply, fileAssetIds, idempotencyKey } = req.body;
    const requestKey = idempotencyKey || req.get('Idempotency-Key') || null;
    const thread = await Thread.findById(req.params.threadId);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    await discussionAccess.assertStudentCanReply(req.user, thread);

    const safeFileAssetIds = fileAssetService.parseFileAssetIdsFromBody({ fileAssetIds });
    if (safeFileAssetIds.length) {
      await fileAssetService.validateFileAssetIdsForAttach(safeFileAssetIds, {
        user: req.user,
        courseId: thread.course,
        category: 'discussion',
        ownerOnly: true,
      });
    }

    const { reply: newReply, duplicateSuppressed } = await discussionReplyService.createReply({
      thread,
      user: req.user,
      content,
      parentReplyId: parentReply || null,
      fileAssetIds: safeFileAssetIds,
      idempotencyKey: requestKey,
    });

    // If this is a graded discussion and the user is a student
    if (!duplicateSuppressed && thread.isGraded && req.user.role === 'student') {
      // Check if student already has a grade entry
      const existingGradeIndex = thread.studentGrades.findIndex(
        g => g.student.toString() === req.user._id.toString()
      );

      if (existingGradeIndex === -1) {
        // Create a new grade entry with null grade (indicating submission without grade)
        thread.studentGrades.push({
          student: req.user._id,
          grade: null,
          feedback: null,
          gradedAt: null,
          gradedBy: null
        });
      }
    }

    if (!duplicateSuppressed) await thread.save();
    if (safeFileAssetIds.length) {
      await fileAssetService.attachFileAssets(safeFileAssetIds, {
        courseId: thread.course,
        discussionId: thread._id,
        category: 'discussion',
      });
    }
    if (!duplicateSuppressed) {
      await recordDiscussionAudit({
        req,
        thread,
        replyId: newReply._id,
        action: 'reply_created',
        after: { parentReply: parentReply || null },
      });
      notifyDiscussionReplyPosted({
        thread,
        actor: req.user,
        requestId: req.id,
        replyId: newReply._id,
      }).catch((err) => console.error('discussion.reply notification error:', err));
    }

    const updatedThread = await populateThread(Thread.findById(thread._id));
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, {
      allowArchivedRead: true,
    });

    res.json({
      success: true,
      duplicateSuppressed,
      data: await serializeThreadForUser(req, updatedThread, context),
      createdReply: duplicateSuppressed
        ? null
        : await discussionReplyService.hydrateReplyFileAssetsForClient(newReply, req.user._id),
    });
  } catch (error) {
    sendRouteError(res, error, 'Error adding reply');
  }
});

// Update a reply
router.put('/:threadId/replies/:replyId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    const foundReply = await discussionReplyService.getReplyOrLegacy(thread, req.params.replyId);
    if (!foundReply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }
    const reply = foundReply.reply;
    if (reply.deletedAt) {
      return res.status(400).json({ success: false, message: 'Deleted replies cannot be edited' });
    }
    const isReplyAuthor = discussionAccess.userOwnsReply(foundReply, req.user);
    const replyAuthorId = foundReply.source === 'collection' ? foundReply.reply.authorId : foundReply.reply.author;
    if (isReplyAuthor) {
      await discussionAccess.assertStudentCanModifyOwnReply(req.user, thread);
    } else {
      await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    }
    if (!isReplyAuthor && req.user.role !== 'admin' && !discussionAccess.isCourseStaff(req.user, (await discussionAccess.loadDiscussionContext(thread)).course)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this reply' });
    }
    const { content, fileAssetIds } = req.body;
    const newIds = fileAssetService.parseFileAssetIdsFromBody({ fileAssetIds });
    const removeIds = parseRemoveFileAssetIds(req.body);
    if (foundReply.source === 'collection') {
      if (newIds.length) {
        await fileAssetService.validateFileAssetIdsForAttach(newIds, {
          user: req.user,
          courseId: thread.course,
          category: 'discussion',
          ownerOnly: true,
        });
      }
      for (const id of removeIds) {
        await fileAssetService.deleteFileAsset(id, req.user, {}).catch(() => {});
      }
      await discussionReplyService.updateReply({
        thread,
        replyId: req.params.replyId,
        user: req.user,
        content,
        fileAssetIds: newIds,
        removeFileAssetIds: removeIds,
      });
      if (newIds.length) {
        await fileAssetService.attachFileAssets(newIds, {
          courseId: thread.course,
          discussionId: thread._id,
          category: 'discussion',
        });
      }
    } else {
      if (content !== undefined) {
        reply.editHistory = reply.editHistory || [];
        reply.editHistory.push({
          editedAt: new Date(),
          editedBy: req.user._id,
          previousContent: reply.content,
        });
        reply.content = sanitizeDiscussionHtml(content);
      }
      if (newIds.length || removeIds.length) {
      await applyDiscussionFileAssets(reply, {
        fileAssetIds: newIds,
        removeIds,
        user: req.user,
        courseId: thread.course,
        discussionId: thread._id,
      });
      }
      await thread.save();
    }
    await recordDiscussionAudit({
      req,
      thread,
      replyId: req.params.replyId,
      action: 'reply_edited',
      before: { contentChanged: content !== undefined },
      after: { contentChanged: content !== undefined },
    });
    const updatedThread = await populateThread(Thread.findById(thread._id));
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, {
      allowArchivedRead: true,
    });
    res.json({ success: true, data: await serializeThreadForUser(req, updatedThread, context) });
  } catch (error) {
    sendRouteError(res, error, 'Error updating reply');
  }
});

// Delete a reply
router.delete('/:threadId/replies/:replyId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    const foundReply = await discussionReplyService.getReplyOrLegacy(thread, req.params.replyId);
    if (!foundReply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }
    const reply = foundReply.reply;
    if (reply.deletedAt) {
      return res.status(400).json({ success: false, message: 'Reply is already deleted' });
    }
    const isReplyAuthor = discussionAccess.userOwnsReply(foundReply, req.user);
    const replyAuthorId = foundReply.source === 'collection' ? foundReply.reply.authorId : foundReply.reply.author;
    if (isReplyAuthor) {
      await discussionAccess.assertStudentCanModifyOwnReply(req.user, thread);
    } else {
      await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    }
    if (!isReplyAuthor && req.user.role !== 'admin' && !discussionAccess.isCourseStaff(req.user, (await discussionAccess.loadDiscussionContext(thread)).course)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this reply' });
    }
    const isRootReply =
      foundReply.source === 'collection'
        ? !foundReply.reply.parentReplyId
        : !(foundReply.reply.parentReply || foundReply.reply.parentReplyId);
    if (isReplyAuthor && isRootReply) {
      return res.status(400).json({
        success: false,
        message: 'Main discussion posts cannot be deleted',
        code: 'ROOT_REPLY_DELETE_FORBIDDEN',
      });
    }
    if (foundReply.source === 'collection') {
      await discussionReplyService.softDeleteReply({
        thread,
        replyId: req.params.replyId,
        user: req.user,
        reason: req.body?.reason || null,
        moderatorNote: req.body?.moderatorNote || null,
      });
    } else {
      reply.deletedAt = new Date();
      reply.deletedBy = req.user._id;
      reply.deletedReason = req.body?.reason || null;
      reply.content = '[deleted]';
      reply.fileAssets = [];
      reply.likes = [];
      await thread.save();
    }
    await recordDiscussionAudit({
      req,
      thread,
      replyId: req.params.replyId,
      action: 'reply_deleted',
      before: { author: replyAuthorId },
      after: { deletedAt: reply.deletedAt },
    });
    const updatedThread = await populateThread(Thread.findById(thread._id));
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, {
      allowArchivedRead: true,
    });
    res.json({ success: true, data: await serializeThreadForUser(req, updatedThread, context) });
  } catch (error) {
    sendRouteError(res, error, 'Error deleting reply');
  }
});

// Update a thread
router.put('/:threadId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);

    const before = {
      title: thread.title,
      content: thread.content,
      published: thread.published,
      locked: thread.locked,
      dueDate: thread.dueDate,
    };
    const {
      title,
      content,
      isGraded,
      totalPoints,
      group,
      dueDate,
      availableFrom,
      locked,
      lockAfterDue,
      discussionReleaseMode,
      gradesReleasedAt,
      gradeHidden,
      module,
      groupSet,
      groupId,
      settings,
      fileAssetIds
    } = req.body;
    if (title !== undefined) thread.title = title || thread.title;
    if (content !== undefined) {
      thread.editHistory = thread.editHistory || [];
      thread.editHistory.push({
        editedAt: new Date(),
        editedBy: req.user._id,
        previousTitle: before.title,
        previousContent: before.content,
      });
      thread.content = sanitizeDiscussionHtml(content);
    }

    const newIds = fileAssetService.parseFileAssetIdsFromBody({ fileAssetIds });
    const removeIds = parseRemoveFileAssetIds(req.body);
    if (newIds.length || removeIds.length) {
      await applyDiscussionFileAssets(thread, {
        fileAssetIds: newIds,
        removeIds,
        user: req.user,
        courseId: thread.course,
        discussionId: thread._id,
      });
    }
    if (isGraded !== undefined) thread.isGraded = isGraded;
    if (thread.isGraded) {
      if (totalPoints !== undefined) thread.totalPoints = totalPoints;
    } else {
      thread.totalPoints = null;
    }
    thread.group = group || thread.group;
    if (dueDate !== undefined) thread.dueDate = dueDate || null;
    if (availableFrom !== undefined) thread.availableFrom = availableFrom || null;
    if (locked !== undefined) thread.locked = locked === true;
    if (lockAfterDue !== undefined) thread.lockAfterDue = lockAfterDue === true;
    if (discussionReleaseMode !== undefined) thread.discussionReleaseMode = discussionReleaseMode || 'immediate';
    if (gradesReleasedAt !== undefined) thread.gradesReleasedAt = gradesReleasedAt || null;
    if (gradeHidden !== undefined) thread.gradeHidden = gradeHidden === true;
    if (req.body.gradingPeriodId !== undefined && req.body.gradingPeriodId) {
      thread.gradingPeriodId = req.body.gradingPeriodId;
    } else if (dueDate !== undefined) {
      // Due date changed without an explicit period → re-slot automatically.
      thread.gradingPeriodId =
        await gradingPeriodAssignmentService.resolvePeriodIdForCourseDueDate(
          thread.course,
          thread.dueDate
        );
    }
    if (module !== undefined) thread.module = module;
    if (groupSet !== undefined) thread.groupSet = groupSet;
    if (groupId !== undefined) thread.groupId = groupId;
    
    // Update settings if provided
    if (settings) {
      thread.settings = {
        requirePostBeforeSee: settings.requirePostBeforeSee !== undefined ? settings.requirePostBeforeSee : thread.settings.requirePostBeforeSee,
        allowLikes: settings.allowLikes !== undefined ? settings.allowLikes : thread.settings.allowLikes,
        allowComments: settings.allowComments !== undefined ? settings.allowComments : thread.settings.allowComments
      };
    }

    await thread.save();
    await recordDiscussionAudit({
      req,
      thread,
      action: 'discussion_updated',
      before,
      after: {
        title: thread.title,
        published: thread.published,
        locked: thread.locked,
        dueDate: thread.dueDate,
      },
    });
    
    const updatedThread = await populateThread(Thread.findById(thread._id));
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, {
      allowArchivedRead: true,
    });

    res.json({
      success: true,
      data: await serializeThreadForUser(req, updatedThread, context, { includeGrades: true })
    });
  } catch (error) {
    sendRouteError(res, error, 'Error updating thread');
  }
});

// Delete a thread
router.delete('/:threadId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);

    thread.deletedAt = new Date();
    thread.deletedBy = req.user._id;
    thread.moderation = {
      lastAction: 'deleted',
      lastActionAt: thread.deletedAt,
      lastActionBy: req.user._id,
    };
    await thread.save();
    await recordDiscussionAudit({
      req,
      thread,
      action: 'discussion_deleted',
      before: { title: thread.title },
      after: { deletedAt: thread.deletedAt },
    });

    res.json({
      success: true,
      message: 'Thread deleted successfully'
    });
  } catch (error) {
    sendRouteError(res, error, 'Error deleting thread');
  }
});

// Grade a student's participation in a thread
router.post('/:threadId/grade', protect, authorize(['teacher', 'teaching_assistant', 'admin']), async (req, res) => {
  try {
    const { studentId, grade, feedback, releaseGrade, hideGrade, discussionReleaseMode } = req.body;
    const thread = await Thread.findById(req.params.threadId);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const context = await discussionAccess.assertStudentCanGradeDiscussion(req.user, thread);
    const { term, year } = getSemesterFromCourse(context.course);
    await gradeLifecycleService.assertCanEditGrades(context.course._id, term, year, {
      auditContext: {
        actorId: req.user._id,
        ip: req.ip,
        after: { threadId: String(thread._id), studentId },
        metadata: { source: 'discussion_grade' },
      },
    });
    await gradingPeriodAssignmentService.assertGradingPeriodEditable(
      context.course._id,
      thread.gradingPeriodId
    );

    if (!thread.isGraded) {
      return res.status(400).json({
        success: false,
        message: 'This thread is not set up for grading'
      });
    }

    // Validate grade
    if (grade !== null && grade !== undefined && (grade < 0 || grade > thread.totalPoints)) {
      return res.status(400).json({
        success: false,
        message: `Grade must be between 0 and ${thread.totalPoints}`
      });
    }

    // Find existing grade or create new one
    const gradeIndex = thread.studentGrades.findIndex(
      g => g.student.toString() === studentId
    );
    const before = gradeIndex > -1 ? { ...thread.studentGrades[gradeIndex].toObject?.() || thread.studentGrades[gradeIndex] } : null;

    if (gradeIndex > -1) {
      // Update existing grade
      thread.studentGrades[gradeIndex] = {
        student: studentId,
        grade,
        feedback: sanitizeDiscussionHtml(feedback || ''),
        excused: thread.studentGrades[gradeIndex].excused === true,
        gradedAt: new Date(),
        gradedBy: req.user._id
      };
    } else {
      // Add new grade
      thread.studentGrades.push({
        student: studentId,
        grade,
        feedback: sanitizeDiscussionHtml(feedback || ''),
        gradedAt: new Date(),
        gradedBy: req.user._id
      });
    }
    if (discussionReleaseMode) thread.discussionReleaseMode = discussionReleaseMode;
    const effectiveMode = discussionReleaseMode || thread.discussionReleaseMode || 'immediate';
    if (hideGrade === true || effectiveMode === 'hidden') {
      discussionGradeVisibility.releaseDiscussionGrades(thread, {
        hideGrade: true,
        mode: 'hidden',
      });
    } else if (
      grade !== null &&
      grade !== undefined &&
      (releaseGrade === true || effectiveMode === 'immediate')
    ) {
      discussionGradeVisibility.releaseDiscussionGrades(thread, {
        releaseGrade: true,
        mode: effectiveMode,
      });
    } else if (releaseGrade === true) {
      discussionGradeVisibility.releaseDiscussionGrades(thread, {
        releaseGrade: true,
        mode: effectiveMode,
      });
    }

    await thread.save();
    require('../services/dashboardGradeSummary.service').scheduleRefreshStudents(
      context.course._id,
      [studentId]
    );
    await recordDiscussionAudit({
      req,
      thread,
      action: 'discussion_grade_changed',
      before,
      after: { student: studentId, grade, releaseGrade, hideGrade, discussionReleaseMode },
    });

    if (grade !== null && grade !== undefined) {
      notifyDiscussionGraded({
        thread,
        studentId,
        grade,
        course: context.course,
        actor: req.user,
        requestId: req.id,
      }).catch((err) => console.error('discussion.graded notification error:', err));
    }

    const updatedThread = await Thread.findById(thread._id)
      .select('-replies')
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName');

    res.json({
      success: true,
      data: await serializeThreadForUser(req, updatedThread, context, { includeGrades: true })
    });
  } catch (error) {
    sendRouteError(res, error, 'Error grading thread');
  }
});

// Get a student's grade for a thread
router.get('/:threadId/grade/:studentId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId)
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName');

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const isOwnStudentGrade =
      req.user.role === 'student' && req.user._id.toString() === req.params.studentId.toString();
    if (isOwnStudentGrade) {
      await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });
    } else {
      await discussionAccess.assertStudentCanGradeDiscussion(req.user, thread);
    }

    const grade = thread.studentGrades.find(
      g => g.student._id.toString() === req.params.studentId
    );

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'No grade found for this student'
      });
    }

    res.json({
      success: true,
      data: isOwnStudentGrade ? discussionGradeVisibility.redactStudentGradeRow(thread, grade) : grade
    });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching grade');
  }
});

// Pin/Unpin a thread (teachers only)
router.patch('/:threadId/pin', protect, authorize(['teacher', 'teaching_assistant', 'admin']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);

    thread.isPinned = !thread.isPinned;
    await thread.save();
    await recordDiscussionAudit({
      req,
      thread,
      action: thread.isPinned ? 'discussion_pinned' : 'discussion_unpinned',
      after: { isPinned: thread.isPinned },
    });

    const updatedThread = await Thread.findById(thread._id)
      .select('-replies')
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName');

    res.json({
      success: true,
      data: await serializeThreadForUser(req, updatedThread, await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, { allowArchivedRead: true }))
    });
  } catch (error) {
    sendRouteError(res, error, 'Error toggling thread pin status');
  }
});

// Get all threads for a module (both graded and non-graded)
router.get('/module/:moduleId', protect, async (req, res) => {
  try {
    const threads = await Thread.find({ module: req.params.moduleId, deletedAt: null })
      .select('-replies')
      .populate('fileAssets', 'originalName mimeType size path')
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate('groupId', 'name groupSet')
      .sort({ lastActivity: -1 });

    setNoStoreThreadListHeaders(res);
    res.json(await buildFilteredThreadListResponse(req, threads, 'module'));
  } catch (error) {
    sendRouteError(res, error, 'Error fetching module threads');
  }
});

// Add publish/unpublish endpoint for threads (discussions)
router.patch('/:threadId/publish', protect, authorize(['teacher', 'teaching_assistant', 'admin']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    // Accept { published: true/false } in body, default to true if not provided
    const published = typeof req.body.published === 'boolean' ? req.body.published : true;
    thread.published = published;
    await thread.save();
    await recordDiscussionAudit({
      req,
      thread,
      action: published ? 'discussion_published' : 'discussion_unpublished',
      after: { published },
    });
    const updatedThread = await populateThread(Thread.findById(thread._id));
    res.json({ success: true, data: await serializeThreadForUser(req, updatedThread, await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, { allowArchivedRead: true })) });
  } catch (error) {
    sendRouteError(res, error, 'Error publishing/unpublishing thread');
  }
});

router.patch('/:threadId/lock', protect, authorize(['teacher', 'teaching_assistant', 'admin']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    const locked = typeof req.body.locked === 'boolean' ? req.body.locked : true;
    thread.locked = locked;
    thread.moderation = {
      state: thread.moderationState || thread.moderation?.state || 'active',
      lastAction: locked ? 'locked' : 'unlocked',
      lastActionAt: new Date(),
      lastActionBy: req.user._id,
      note: req.body.note || null,
    };
    await thread.save();
    await recordDiscussionAudit({
      req,
      thread,
      action: locked ? 'discussion_locked' : 'discussion_unlocked',
      after: { locked },
    });
    const updatedThread = await populateThread(Thread.findById(thread._id));
    res.json({
      success: true,
      data: await serializeThreadForUser(
        req,
        updatedThread,
        await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, { allowArchivedRead: true })
      ),
    });
  } catch (error) {
    sendRouteError(res, error, 'Error locking/unlocking thread');
  }
});

async function setThreadLock(req, res, locked) {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    await discussionAccess.assertStudentCanModerateDiscussion(req.user, thread);
    thread.locked = locked;
    thread.moderation = {
      state: thread.moderationState || thread.moderation?.state || 'active',
      lastAction: locked ? 'locked' : 'unlocked',
      lastActionAt: new Date(),
      lastActionBy: req.user._id,
      note: req.body?.note || null,
    };
    await thread.save();
    await recordDiscussionAudit({
      req,
      thread,
      action: locked ? 'discussion_locked' : 'discussion_unlocked',
      after: { locked, note: req.body?.note || null },
    });
    const updatedThread = await populateThread(Thread.findById(thread._id));
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, {
      allowArchivedRead: true,
    });
    return res.json({ success: true, data: await serializeThreadForUser(req, updatedThread, context) });
  } catch (error) {
    return sendRouteError(res, error, locked ? 'Error locking thread' : 'Error unlocking thread');
  }
}

router.post('/:threadId/lock', protect, authorize(['teacher', 'teaching_assistant', 'admin']), (req, res) =>
  setThreadLock(req, res, true)
);

router.post('/:threadId/unlock', protect, authorize(['teacher', 'teaching_assistant', 'admin']), (req, res) =>
  setThreadLock(req, res, false)
);

// Like/Unlike a reply
router.post('/:threadId/replies/:replyId/like', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }
    await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, { allowArchivedRead: true });

    // Check if likes are allowed
    if (!thread.settings.allowLikes) {
      return res.status(400).json({
        success: false,
        message: 'Likes are not allowed for this discussion'
      });
    }

    const foundReply = await discussionReplyService.getReplyOrLegacy(thread, req.params.replyId);
    if (!foundReply) {
      return res.status(404).json({
        success: false,
        message: 'Reply not found'
      });
    }
    const reply = foundReply.reply;
    if (reply.deletedAt) {
      return res.status(400).json({ success: false, message: 'Deleted replies cannot be liked' });
    }
    if (discussionAccess.userOwnsReply(foundReply, req.user)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot like your own reply',
        code: 'SELF_LIKE_FORBIDDEN',
      });
    }

    if (foundReply.source === 'collection') {
      await discussionReplyService.toggleLike({ thread, replyId: req.params.replyId, user: req.user });
    } else {
      const existingLikeIndex = (reply.likes || []).findIndex(
        (like) => discussionAccess.normalizeId(like.user) === discussionAccess.normalizeId(req.user._id)
      );

      const nextLikes = [...(reply.likes || [])];
      if (existingLikeIndex > -1) {
        nextLikes.splice(existingLikeIndex, 1);
      } else {
        nextLikes.push({
          user: req.user._id,
          likedAt: new Date(),
        });
      }

      await Thread.updateOne(
        { _id: thread._id, 'replies._id': req.params.replyId },
        { $set: { 'replies.$.likes': nextLikes } }
      );
    }

    const updatedThread = await Thread.findById(thread._id)
      .select('-replies')
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName');

    res.json({
      success: true,
      data: await serializeThreadForUser(req, updatedThread, await discussionAccess.assertStudentCanViewDiscussion(req.user, updatedThread, { allowArchivedRead: true }))
    });
  } catch (error) {
    sendRouteError(res, error, 'Error liking/unliking reply');
  }
});

// Get thread with filtered replies based on user participation
router.get('/:threadId/participant/:userId', protect, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId)
      .select('-replies')
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name');

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }
    const context = await discussionAccess.assertStudentCanViewDiscussion(req.user, thread, {
      allowArchivedRead: true,
    });

    res.json({
      success: true,
      data: await serializeThreadForUser(req, thread, context)
    });
  } catch (error) {
    sendRouteError(res, error, 'Error fetching thread for participant');
  }
});

module.exports = router; 