const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const { resolveAssignmentGrade, buildGradesMapForStudent } = require('../utils/gradeCalculation');
const gradeReleaseService = require('./gradeRelease.service');
const discussionGradeVisibility = require('./discussionGradeVisibility.service');
const discussionReplyService = require('./discussionReply.service');

function submissionVisibleForStudent(submission, assignment) {
  if (!submission) return null;
  return gradeReleaseService.resolveStudentGradeVisibility(submission, assignment).scoreVisible
    ? submission
    : null;
}

function hasReplyByUser(replies, userId) {
  if (!Array.isArray(replies) || replies.length === 0) return false;
  for (const r of replies) {
    const authorId =
      r.author && typeof r.author === 'object' && r.author._id
        ? r.author._id.toString()
        : String(r.author || '');
    if (authorId === String(userId)) return true;
    if (Array.isArray(r.replies) && r.replies.length > 0 && hasReplyByUser(r.replies, userId)) {
      return true;
    }
  }
  return false;
}

/**
 * Build assignment list, grades map, and submission map for canonical grade calculation.
 */
async function buildStudentCourseGradeContext(course, studentId) {
  const sid = String(studentId);
  const modules = await Module.find({ course: course._id }).select('_id title');
  const moduleIds = modules.map((m) => m._id);
  const assignments = await Assignment.find({ module: { $in: moduleIds } });

  const courseGroupSets = await GroupSet.find({ course: course._id }).select('_id').lean();
  const courseGroupSetIds = courseGroupSets.map((gs) => gs._id);
  const groupAssignments =
    courseGroupSetIds.length > 0
      ? await Assignment.find({
          isGroupAssignment: true,
          groupSet: { $in: courseGroupSetIds },
        }).lean()
      : [];

  const assignmentIds = assignments.map((a) => a._id);
  const regularSubmissions = await Submission.find({
    assignment: { $in: assignmentIds },
    student: studentId,
  });

  let groupSubmissions = [];
  for (const groupAssignment of groupAssignments) {
    const groupSetId = groupAssignment.groupSet?._id || groupAssignment.groupSet;
    const group = await Group.findOne({
      groupSet: groupSetId,
      members: studentId,
    });
    if (group) {
      const submission = await Submission.findOne({
        assignment: groupAssignment._id,
        group: group._id,
      });
      if (submission) groupSubmissions.push(submission);
    }
  }

  const allSubmissions = [...regularSubmissions, ...groupSubmissions];
  const submissionMap = {};
  allSubmissions.forEach((sub) => {
    submissionMap[sub.assignment.toString()] = sub;
  });

  const threads = await Thread.find({ course: course._id, isGraded: true });
  const discussionAssignments = [];
  for (const thread of threads) {
    const studentGradeObj = discussionGradeVisibility.discussionGradeForTotals(thread, sid);
    discussionAssignments.push({
      _id: thread._id,
      title: thread.title,
      group: thread.group || 'Discussions',
      totalPoints: thread.totalPoints || 0,
      isDiscussion: true,
      published: thread.published !== false,
      grade: resolveAssignmentGrade({ discussionGradeRow: studentGradeObj || null }),
      dueDate: thread.dueDate || null,
      hasSubmitted: await discussionReplyService.hasReplyByUser(thread, studentId),
      gradeVisibility: discussionGradeVisibility.resolveDiscussionGradeVisibility(
        thread,
        discussionGradeVisibility.findStudentGrade(thread, sid)
      ),
    });
  }

  const allAssignments = [
    ...assignments.map((a) => ({
      _id: a._id,
      title: a.title,
      group: a.group,
      totalPoints: a.totalPoints || 0,
      questions: a.questions,
      isDiscussion: false,
      dueDate: a.dueDate,
      published: a.published,
      grade: resolveAssignmentGrade({
        submission: submissionVisibleForStudent(submissionMap[a._id.toString()], a),
      }),
    })),
    ...groupAssignments.map((a) => {
      const submission = submissionMap[a._id.toString()];
      const visibleSubmission = submissionVisibleForStudent(submission, a);
      const grade = visibleSubmission
        ? resolveAssignmentGrade({
            submission: { ...(visibleSubmission.toObject?.() || visibleSubmission), _memberStudentId: studentId },
          })
        : null;
      return {
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        dueDate: a.dueDate,
        published: a.published,
        grade,
      };
    }),
    ...discussionAssignments,
  ];

  const grades = {};
  buildGradesMapForStudent(grades, sid, allAssignments);

  return { allAssignments, grades, submissionMap };
}

module.exports = {
  buildStudentCourseGradeContext,
};
