const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const SubmissionVersion = require('../models/submissionVersion.model');
const Thread = require('../models/thread.model');
const DiscussionReply = require('../models/discussionReply.model');
const DiscussionParticipation = require('../models/discussionParticipation.model');
const Announcement = require('../models/announcement.model');
const Poll = require('../models/poll.model');
const Attendance = require('../models/attendance.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const GroupMeeting = require('../models/groupMeeting.model');
const Conversation = require('../models/Conversation');
const ConversationParticipant = require('../models/ConversationParticipant');
const Message = require('../models/Message');
const FileAsset = require('../models/fileAsset.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
const CourseGradingPolicy = require('../models/courseGradingPolicy.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');
const Todo = require('../models/todo.model');
const User = require('../models/user.model');
const { QuizWave, QuizSession, QuizResponse } = require('../models/quizwave.model');
const { deleteNotificationsForCourse } = require('./notification/notificationCourseCleanup.service');

function deletedCount(result) {
  return result?.deletedCount ?? result?.modifiedCount ?? 0;
}

/** Native delete — bypasses append-only mongoose hooks on audit collections. */
async function deleteManyBypassingHooks(model, filter) {
  const result = await model.collection.deleteMany(filter);
  return result.deletedCount ?? 0;
}

async function pruneCourseColorPreferences(courseId) {
  const idStr = String(courseId);
  const field = `preferences.courseColors.${idStr}`;
  const result = await User.collection.updateMany(
    { [field]: { $exists: true } },
    { $unset: { [field]: '' } }
  );
  return result.modifiedCount;
}

/**
 * Delete all data tied to a course. When deleteCourseDocument is false, cleans orphans
 * whose course row was already removed (e.g. manual DB deletes).
 */
async function deleteCourseAndRelatedData(courseId, { deleteCourseDocument = true } = {}) {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return { ok: false, reason: 'invalid_course_id' };
  }

  const courseObjectId = new mongoose.Types.ObjectId(String(courseId));
  const summary = { courseId: String(courseObjectId), deleted: {} };

  if (deleteCourseDocument) {
    const course = await Course.findById(courseObjectId);
    if (!course) {
      return { ok: false, reason: 'course_not_found' };
    }
  }

  const modules = await Module.find({ course: courseObjectId }).select('_id').lean();
  const moduleIds = modules.map((m) => m._id);

  const assignments =
    moduleIds.length > 0
      ? await Assignment.find({ module: { $in: moduleIds } })
          .select('_id')
          .lean()
      : [];
  const assignmentIds = assignments.map((a) => a._id);

  const threads = await Thread.find({ course: courseObjectId }).select('_id').lean();
  const threadIds = threads.map((t) => t._id);

  const conversations = await Conversation.find({ course: courseObjectId }).select('_id').lean();
  const conversationIds = conversations.map((c) => c._id);

  if (assignmentIds.length > 0) {
    const submissions = await Submission.find({ assignment: { $in: assignmentIds } })
      .select('_id')
      .lean();
    const submissionIds = submissions.map((s) => s._id);
    if (submissionIds.length > 0) {
      summary.deleted.submissionVersions = deletedCount(
        await SubmissionVersion.deleteMany({ submission: { $in: submissionIds } })
      );
    }
    summary.deleted.submissions = deletedCount(
      await Submission.deleteMany({ assignment: { $in: assignmentIds } })
    );
    summary.deleted.assignments = deletedCount(
      await Assignment.deleteMany({ _id: { $in: assignmentIds } })
    );
  }

  if (moduleIds.length > 0) {
    summary.deleted.pages = deletedCount(
      await Page.deleteMany({ module: { $in: moduleIds } })
    );
  }

  if (threadIds.length > 0) {
    summary.deleted.discussionReplies = deletedCount(
      await DiscussionReply.deleteMany({ threadId: { $in: threadIds } })
    );
    summary.deleted.discussionParticipation = deletedCount(
      await DiscussionParticipation.deleteMany({ threadId: { $in: threadIds } })
    );
  }
  summary.deleted.threads = deletedCount(await Thread.deleteMany({ course: courseObjectId }));

  summary.deleted.announcements = deletedCount(
    await Announcement.deleteMany({ course: courseObjectId })
  );
  summary.deleted.polls = deletedCount(await Poll.deleteMany({ course: courseObjectId }));
  summary.deleted.attendance = deletedCount(
    await Attendance.deleteMany({ course: courseObjectId })
  );
  summary.deleted.groupMeetings = deletedCount(
    await GroupMeeting.deleteMany({ course: courseObjectId })
  );
  summary.deleted.groups = deletedCount(await Group.deleteMany({ course: courseObjectId }));
  summary.deleted.groupSets = deletedCount(await GroupSet.deleteMany({ course: courseObjectId }));

  const quizIds = (
    await QuizWave.find({ course: courseObjectId }).select('_id').lean()
  ).map((q) => q._id);
  const sessionIds = (
    await QuizSession.find({ course: courseObjectId }).select('_id').lean()
  ).map((s) => s._id);
  if (sessionIds.length > 0) {
    summary.deleted.quizResponses = deletedCount(
      await QuizResponse.deleteMany({ session: { $in: sessionIds } })
    );
  }
  summary.deleted.quizSessions = deletedCount(
    await QuizSession.deleteMany({ course: courseObjectId })
  );
  summary.deleted.quizWaves = deletedCount(await QuizWave.deleteMany({ course: courseObjectId }));

  if (conversationIds.length > 0) {
    summary.deleted.messages = deletedCount(
      await Message.deleteMany({ conversationId: { $in: conversationIds } })
    );
    summary.deleted.conversationParticipants = deletedCount(
      await ConversationParticipant.deleteMany({ conversationId: { $in: conversationIds } })
    );
    summary.deleted.conversations = deletedCount(
      await Conversation.deleteMany({ _id: { $in: conversationIds } })
    );
  }

  summary.deleted.fileAssets = deletedCount(
    await FileAsset.updateMany(
      { courseId: courseObjectId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), cleanupState: 'ORPHAN_CANDIDATE' } }
    )
  );

  summary.deleted.gradeSnapshots = deletedCount(
    await StudentCourseGradeSnapshot.deleteMany({ course: courseObjectId })
  );
  summary.deleted.gradeLifecycle = deletedCount(
    await CourseGradeLifecycle.deleteMany({ course: courseObjectId })
  );
  summary.deleted.gradingPolicy = deletedCount(
    await CourseGradingPolicy.deleteMany({ course: courseObjectId })
  );
  summary.deleted.gradeAmendments = await deleteManyBypassingHooks(GradeAmendmentRecord, {
    course: courseObjectId,
  });

  summary.deleted.todos = deletedCount(await Todo.deleteMany({ courseId: courseObjectId }));
  summary.deleted.notifications = await deleteNotificationsForCourse(courseObjectId, {
    assignmentIds,
    threadIds,
  });
  summary.deleted.userColorPrefs = await pruneCourseColorPreferences(courseObjectId);

  if (moduleIds.length > 0) {
    summary.deleted.modules = deletedCount(await Module.deleteMany({ _id: { $in: moduleIds } }));
  }

  if (deleteCourseDocument) {
    summary.deleted.course = deletedCount(await Course.deleteOne({ _id: courseObjectId }));
  }

  return { ok: true, ...summary };
}

async function collectOrphanCourseIds() {
  const [
    fromModules,
    fromThreads,
    fromAnnouncements,
    fromGroups,
    fromGroupSets,
    fromTodos,
    fromQuizWaves,
    fromQuizSessions,
    fromConversations,
    fromPolls,
    fromAttendance,
    fromGroupMeetings,
    fromFileAssets,
    fromGradeSnapshots,
    fromGradeLifecycle,
    fromGradingPolicy,
    fromGradeAmendments,
  ] = await Promise.all([
    Module.distinct('course'),
    Thread.distinct('course'),
    Announcement.distinct('course'),
    Group.distinct('course'),
    GroupSet.distinct('course'),
    Todo.distinct('courseId'),
    QuizWave.distinct('course'),
    QuizSession.distinct('course'),
    Conversation.distinct('course'),
    Poll.distinct('course'),
    Attendance.distinct('course'),
    GroupMeeting.distinct('course'),
    FileAsset.distinct('courseId', { isDeleted: { $ne: true }, courseId: { $ne: null } }),
    StudentCourseGradeSnapshot.distinct('course'),
    CourseGradeLifecycle.distinct('course'),
    CourseGradingPolicy.distinct('course'),
    GradeAmendmentRecord.distinct('course'),
  ]);

  const allIds = new Set();
  for (const ids of [
    fromModules,
    fromThreads,
    fromAnnouncements,
    fromGroups,
    fromGroupSets,
    fromTodos,
    fromQuizWaves,
    fromQuizSessions,
    fromConversations,
    fromPolls,
    fromAttendance,
    fromGroupMeetings,
    fromFileAssets,
    fromGradeSnapshots,
    fromGradeLifecycle,
    fromGradingPolicy,
    fromGradeAmendments,
  ]) {
    for (const id of ids) {
      if (id) allIds.add(String(id));
    }
  }

  if (!allIds.size) return [];

  const existing = await Course.find({ _id: { $in: [...allIds] } })
    .select('_id')
    .lean();
  const existSet = new Set(existing.map((c) => String(c._id)));
  return [...allIds].filter((id) => !existSet.has(id));
}

/** Clean data left behind when course documents were removed without cascade. */
async function pruneOrphanCourseData() {
  const orphanIds = await collectOrphanCourseIds();
  const results = [];
  for (const orphanId of orphanIds) {
    const result = await deleteCourseAndRelatedData(orphanId, { deleteCourseDocument: false });
    results.push(result);
  }
  return { orphanCourseIds: orphanIds, results };
}

module.exports = {
  deleteCourseAndRelatedData,
  pruneOrphanCourseData,
  collectOrphanCourseIds,
  pruneCourseColorPreferences,
};
