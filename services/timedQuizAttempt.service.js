const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Group = require('../models/Group');
const assignmentAccess = require('./assignmentAccess.service');
const observability = require('./workflowObservability.service');

function attemptError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function serializeAttempt(submission, assignment, now = new Date()) {
  const deadline = submission?.attemptDeadlineAt ? new Date(submission.attemptDeadlineAt) : null;
  const remainingSeconds =
    deadline && Number.isFinite(deadline.getTime())
      ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000))
      : null;

  return {
    submissionId: submission?._id || null,
    assignmentId: normalizeId(assignment),
    isTimedQuiz: !!assignment?.isTimedQuiz,
    quizTimeLimit: assignment?.quizTimeLimit || null,
    attemptStartedAt: submission?.attemptStartedAt || null,
    attemptDeadlineAt: submission?.attemptDeadlineAt || null,
    attemptStatus: submission?.attemptStatus || 'not_started',
    submittedAt: submission?.submittedAt || null,
    remainingSeconds,
    serverTime: now.toISOString(),
  };
}

function assertTimedQuiz(assignment) {
  if (!assignment?.isTimedQuiz || !assignment?.quizTimeLimit) {
    throw attemptError('Assignment is not a timed quiz', 400, 'NOT_TIMED_QUIZ');
  }
}

async function resolveSubmissionQuery(user, assignment, groupId) {
  if (assignment.isGroupAssignment) {
    if (!groupId) {
      throw attemptError('Group ID is required for group timed quizzes', 400, 'GROUP_REQUIRED');
    }
    const group = await Group.findById(groupId);
    if (!group) throw attemptError('Group not found', 404, 'GROUP_NOT_FOUND');
    if (!group.members.some((memberId) => String(memberId) === String(user._id))) {
      throw attemptError('You are not a member of this group', 403, 'NOT_GROUP_MEMBER');
    }
    if (String(group.groupSet) !== String(assignment.groupSet)) {
      throw attemptError('Group does not belong to the required group set', 400, 'GROUP_SET_MISMATCH');
    }
    return {
      query: { assignment: assignment._id, group: group._id },
      insert: { assignment: assignment._id, student: user._id, group: group._id, submittedBy: user._id },
    };
  }

  return {
    query: { assignment: assignment._id, student: user._id },
    insert: { assignment: assignment._id, student: user._id, submittedBy: user._id },
  };
}

async function markExpiredIfNeeded(submission, now = new Date()) {
  if (
    submission?.attemptStatus === 'in_progress' &&
    submission.attemptDeadlineAt &&
    now > new Date(submission.attemptDeadlineAt)
  ) {
    return Submission.findOneAndUpdate(
      { _id: submission._id, attemptStatus: 'in_progress' },
      {
        $set: {
          attemptStatus: 'submitted',
          submittedAt: submission.attemptDeadlineAt,
          lastHeartbeatAt: now,
        },
      },
      { new: true }
    );
  }
  return submission;
}

async function startTimedQuizAttempt(user, assignmentId, options = {}) {
  const { assignment } = await assignmentAccess.assertStudentCanSubmitAssignment(user, assignmentId, {
    now: options.now,
  });
  assertTimedQuiz(assignment);

  const now = options.now || new Date();
  const deadline = new Date(now.getTime() + Number(assignment.quizTimeLimit) * 60 * 1000);
  const { query, insert } = await resolveSubmissionQuery(user, assignment, options.groupId);

  let existing = await Submission.findOne(query);
  existing = await markExpiredIfNeeded(existing, now);

  if (existing) {
    if (existing.attemptStatus === 'in_progress') {
      observability.emitWorkflowEvent('quiz_attempt_reconnected', {
        assignmentId: normalizeId(assignment),
        submissionId: normalizeId(existing),
        actorRole: user?.role || 'student',
      });
      return serializeAttempt(existing, assignment, now);
    }
    if (existing.attemptStatus === 'submitted' || existing.attemptStatus === 'expired') {
      return serializeAttempt(existing, assignment, now);
    }
  }

  try {
    const submission = await Submission.findOneAndUpdate(
      {
        ...query,
        $or: [
          { attemptStatus: { $exists: false } },
          { attemptStatus: null },
          { attemptStatus: 'not_started' },
        ],
      },
      {
        $set: {
          attemptStartedAt: now,
          attemptDeadlineAt: deadline,
          attemptStatus: 'in_progress',
          lastHeartbeatAt: now,
          submittedAt: null,
        },
        $setOnInsert: {
          ...insert,
          answers: {},
          files: [],
          fileAssets: [],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    observability.emitWorkflowEvent('quiz_attempt_started', {
      assignmentId: normalizeId(assignment),
      submissionId: normalizeId(submission),
      actorRole: user?.role || 'student',
    });
    return serializeAttempt(submission, assignment, now);
  } catch (err) {
    if (err?.code === 11000) {
      const raced = await Submission.findOne(query);
      return serializeAttempt(raced, assignment, now);
    }
    throw err;
  }
}

async function getTimedQuizAttempt(user, assignmentId, options = {}) {
  const { assignment } = await assignmentAccess.assertStudentCanViewAssignment(user, assignmentId);
  assertTimedQuiz(assignment);
  const { query } = await resolveSubmissionQuery(user, assignment, options.groupId);
  const now = options.now || new Date();
  const submission = await markExpiredIfNeeded(await Submission.findOne(query), now);
  return serializeAttempt(submission, assignment, now);
}

async function heartbeatTimedQuizAttempt(user, assignmentId, options = {}) {
  const { assignment } = await assignmentAccess.assertStudentCanViewAssignment(user, assignmentId);
  assertTimedQuiz(assignment);
  const { query } = await resolveSubmissionQuery(user, assignment, options.groupId);
  const now = options.now || new Date();
  const patch = { lastHeartbeatAt: now };
  if (options.answers && typeof options.answers === 'object') {
    patch.answers = options.answers;
  }

  const submission = await Submission.findOneAndUpdate(
    {
      ...query,
      attemptStatus: 'in_progress',
      attemptDeadlineAt: { $gt: now },
    },
    { $set: patch },
    { new: true }
  );

  if (submission) {
    observability.metric('quiz_heartbeat', { assignmentId: normalizeId(assignment) });
    return serializeAttempt(submission, assignment, now);
  }

  const current = await markExpiredIfNeeded(await Submission.findOne(query), now);
  if (!current) throw attemptError('Timed quiz attempt has not been started', 409, 'QUIZ_ATTEMPT_NOT_STARTED');
  return serializeAttempt(current, assignment, now);
}

async function transitionTimedQuizToSubmitted(user, assignment, options = {}) {
  if (!assignment?.isTimedQuiz) return null;
  assertTimedQuiz(assignment);
  const { query } = await resolveSubmissionQuery(user, assignment, options.groupId);
  const now = options.now || new Date();
  const patch = {
    attemptStatus: 'submitted',
    submittedAt: now,
    lastHeartbeatAt: now,
  };
  if (options.answers && typeof options.answers === 'object') {
    patch.answers = options.answers;
  }

  const submission = await Submission.findOneAndUpdate(
    {
      ...query,
      attemptStatus: 'in_progress',
      attemptDeadlineAt: { $gte: now },
    },
    { $set: patch },
    { new: true }
  );

  if (!submission) {
    observability.metric('submission_race_retry', { assignmentId: normalizeId(assignment) });
    const current = await markExpiredIfNeeded(await Submission.findOne(query), now);
    if (!current) {
      throw attemptError('Timed quiz attempt has not been started', 409, 'QUIZ_ATTEMPT_NOT_STARTED');
    }
    throw attemptError('Timed quiz attempt is already closed', 409, 'QUIZ_ATTEMPT_CLOSED', {
      attemptStatus: current.attemptStatus,
      attemptDeadlineAt: current.attemptDeadlineAt,
    });
  }

  observability.emitWorkflowEvent('quiz_attempt_submitted', {
    assignmentId: normalizeId(assignment),
    submissionId: normalizeId(submission),
    actorRole: user?.role || 'student',
  });
  return submission;
}

async function sweepExpiredTimedQuizAttempts({ limit = 100, now = new Date() } = {}) {
  let cursor = null;
  let submittedCount = 0;
  let scannedCount = 0;
  let failedCount = 0;

  do {
    const query = {
      attemptStatus: 'in_progress',
      attemptDeadlineAt: { $lte: now },
    };
    if (cursor) {
      query._id = { $gt: cursor };
    }

    const expired = await Submission.find(query)
      .sort({ _id: 1 })
      .limit(limit);

    const batchCount = expired.length;
    scannedCount += batchCount;
    for (const submission of expired) {
      cursor = submission._id;
      try {
        const updated = await Submission.findOneAndUpdate(
          { _id: submission._id, attemptStatus: 'in_progress' },
          {
            $set: {
              attemptStatus: 'submitted',
              submittedAt: submission.attemptDeadlineAt || now,
              lastHeartbeatAt: now,
            },
          },
          { new: true }
        );
        if (updated) {
          submittedCount += 1;
          observability.emitWorkflowEvent('quiz_attempt_expired', {
            assignmentId: normalizeId(updated.assignment),
            submissionId: normalizeId(updated),
          });
        }
      } catch (err) {
        failedCount += 1;
        observability.emitWorkflowEvent('quiz_auto_submit_failed', {
          submissionId: normalizeId(submission),
          assignmentId: normalizeId(submission.assignment),
          error: err.message,
        });
      }
    }
    if (batchCount < limit) break;
  } while (cursor);

  observability.metric('quiz_auto_submit_count', { submittedCount, failedCount });
  return { submittedCount, scannedCount, failedCount };
}

module.exports = {
  startTimedQuizAttempt,
  getTimedQuizAttempt,
  heartbeatTimedQuizAttempt,
  transitionTimedQuizToSubmitted,
  sweepExpiredTimedQuizAttempts,
  serializeAttempt,
};
