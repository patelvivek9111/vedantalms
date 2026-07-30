const mongoose = require('mongoose');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const LoginActivity = require('../models/loginActivity.model');
const ConversationParticipant = require('../models/ConversationParticipant');
const Message = require('../models/Message');
const Notification = require('../models/notification.model');
const NotificationPreferences = require('../models/notificationPreferences.model');
const Todo = require('../models/todo.model');
const Submission = require('../models/Submission');
const SubmissionVersion = require('../models/submissionVersion.model');
const DiscussionParticipation = require('../models/discussionParticipation.model');
const DiscussionReply = require('../models/discussionReply.model');
const Attendance = require('../models/attendance.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const TranscriptIssueLog = require('../models/transcriptIssueLog.model');
const FileAsset = require('../models/fileAsset.model');
const PlannerItemState = require('../models/plannerItemState.model');
const ZohoMeetingConnection = require('../models/zohoMeetingConnection.model');
const PasswordResetToken = require('../models/passwordResetToken.model');
const Group = require('../models/Group');
const { QuizResponse } = require('../models/quizwave.model');
const AccountUser = require('../models/accountUser.model');
const AccountInvite = require('../models/accountInvite.model');
const PendingStudentRoster = require('../models/pendingStudentRoster.model');
const { recordAuditEvent } = require('./academicAudit.service');

function deletedCount(result) {
  return result?.deletedCount ?? result?.modifiedCount ?? 0;
}

/** Native delete — bypasses append-only mongoose hooks on audit collections. */
async function deleteManyBypassingHooks(model, filter) {
  const result = await model.collection.deleteMany(filter);
  return result.deletedCount ?? 0;
}

/**
 * Remove or anonymize all data tied to a user account (GDPR erasure).
 * Does not delete courses instructed by the user — reassign instructor first.
 */
async function deleteUserAndRelatedData(userId, { actorId = null } = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { ok: false, reason: 'invalid_user_id' };
  }

  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const user = await User.findById(userObjectId);
  if (!user) {
    return { ok: false, reason: 'user_not_found' };
  }

  const instructedCourses = await Course.countDocuments({ instructor: userObjectId });
  if (instructedCourses > 0) {
    return {
      ok: false,
      reason: 'user_instructs_courses',
      message: `User instructs ${instructedCourses} course(s). Reassign instructor before deletion.`,
    };
  }

  const summary = { userId: String(userObjectId), deleted: {} };

  const submissionIds = (
    await Submission.find({ student: userObjectId }).select('_id').lean()
  ).map((s) => s._id);
  if (submissionIds.length > 0) {
    summary.deleted.submissionVersions = deletedCount(
      await SubmissionVersion.deleteMany({ submission: { $in: submissionIds } })
    );
    summary.deleted.submissions = deletedCount(
      await Submission.deleteMany({ _id: { $in: submissionIds } })
    );
  }

  summary.deleted.attendance = deletedCount(
    await Attendance.deleteMany({ student: userObjectId })
  );
  summary.deleted.gradeSnapshots = deletedCount(
    await StudentCourseGradeSnapshot.deleteMany({ student: userObjectId })
  );
  // Append-only collection — native delete required for GDPR erasure.
  summary.deleted.transcriptLogs = await deleteManyBypassingHooks(TranscriptIssueLog, {
    student: userObjectId,
  });
  summary.deleted.quizResponses = deletedCount(
    await QuizResponse.deleteMany({ student: userObjectId })
  );
  summary.deleted.discussionParticipation = deletedCount(
    await DiscussionParticipation.deleteMany({ userId: userObjectId })
  );
  summary.deleted.discussionReplies = deletedCount(
    await DiscussionReply.deleteMany({ authorId: userObjectId })
  );

  const participantRows = await ConversationParticipant.find({ userId: userObjectId })
    .select('conversationId')
    .lean();
  const conversationIds = participantRows.map((p) => p.conversationId);
  if (conversationIds.length > 0) {
    summary.deleted.messages = deletedCount(
      await Message.deleteMany({ senderId: userObjectId })
    );
    summary.deleted.conversationParticipants = deletedCount(
      await ConversationParticipant.deleteMany({ userId: userObjectId })
    );
  }

  summary.deleted.notifications = deletedCount(
    await Notification.deleteMany({ user: userObjectId })
  );
  summary.deleted.notificationPreferences = deletedCount(
    await NotificationPreferences.deleteMany({ user: userObjectId })
  );
  summary.deleted.todos = deletedCount(await Todo.deleteMany({ user: userObjectId }));
  summary.deleted.plannerItems = deletedCount(
    await PlannerItemState.deleteMany({ user: userObjectId })
  );
  summary.deleted.loginActivity = deletedCount(
    await LoginActivity.deleteMany({ userId: userObjectId })
  );
  summary.deleted.passwordResetTokens = deletedCount(
    await PasswordResetToken.deleteMany({ user: userObjectId })
  );
  summary.deleted.zohoConnections = deletedCount(
    await ZohoMeetingConnection.deleteMany({ user: userObjectId })
  );

  summary.deleted.fileAssets = deletedCount(
    await FileAsset.updateMany(
      { uploadedBy: userObjectId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), cleanupState: 'ORPHAN_CANDIDATE' } }
    )
  );

  summary.deleted.courseEnrollments = deletedCount(
    await Course.updateMany(
      { students: userObjectId },
      { $pull: { students: userObjectId } }
    )
  );
  summary.deleted.courseTeachingAssistants = deletedCount(
    await Course.updateMany(
      { teachingAssistants: userObjectId },
      { $pull: { teachingAssistants: userObjectId } }
    )
  );
  summary.deleted.groupMemberships = deletedCount(
    await Group.updateMany(
      { members: userObjectId },
      { $pull: { members: userObjectId } }
    )
  );

  summary.deleted.accountMemberships = deletedCount(
    await AccountUser.deleteMany({ userId: userObjectId })
  );
  summary.deleted.accountInvites = deletedCount(
    await AccountInvite.deleteMany({ email: String(user.email || '').toLowerCase() })
  );
  // Free claimed roster rows so the student ID can be re-activated if needed.
  summary.deleted.rosterClaimReset = deletedCount(
    await PendingStudentRoster.updateMany(
      { claimedByUserId: userObjectId },
      {
        $set: {
          status: 'pending',
          claimedAt: null,
          claimedByUserId: null,
          middleNameMismatch: false,
        },
      }
    )
  );

  await recordAuditEvent({
    actorId: actorId || userObjectId,
    entityType: 'user',
    entityId: userObjectId,
    action: 'user_erasure',
    severity: 'critical',
    metadata: {
      email: user.email,
      role: user.role,
      summary: summary.deleted,
    },
  }).catch(() => {});

  summary.deleted.user = deletedCount(await User.deleteOne({ _id: userObjectId }));

  return { ok: true, ...summary };
}

module.exports = { deleteUserAndRelatedData };
