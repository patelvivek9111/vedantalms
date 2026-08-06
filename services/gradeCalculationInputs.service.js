/**
 * Shared grade-calculation inputs for instructor gradebook and student course grade API.
 * Keeps assignment lists, policy, and visibility rules aligned between views.
 */
const mongoose = require('mongoose');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const {
  resolveAssignmentGrade,
  buildGradesMapForStudent,
} = require('../utils/gradeCalculation');
const gradeReleaseService = require('./gradeRelease.service');
const discussionGradeVisibility = require('./discussionGradeVisibility.service');
const discussionReplyService = require('./discussionReply.service');
const { assignmentGradeCalcFields } = require('../utils/assignmentGradeCalcFields');
const { serializeSubmissionForApi } = require('../utils/submissionResponse');

function normalizeStudentId(id) {
  if (id && typeof id === 'object' && id._id) return String(id._id);
  return String(id);
}

function submissionVisibleForStudent(submission, assignment) {
  if (!submission) return null;
  return gradeReleaseService.resolveStudentGradeVisibility(submission, assignment).scoreVisible
    ? submission
    : null;
}

function resolveSubmissionGrade(submission, assignment, studentId, audience) {
  if (!submission) return null;
  const visible =
    audience === 'student'
      ? submissionVisibleForStudent(submission, assignment)
      : submission;
  if (!visible) return null;
  const payload =
    assignment.isGroupAssignment && audience === 'student'
      ? { ...serializeSubmissionForApi(visible), _memberStudentId: studentId }
      : visible;
  return resolveAssignmentGrade({ submission: payload });
}

function resolveDiscussionGrade(thread, studentId, audience) {
  const sid = normalizeStudentId(studentId);
  const row =
    audience === 'student'
      ? discussionGradeVisibility.discussionGradeForTotals(thread, sid)
      : (thread.studentGrades || []).find((g) => normalizeStudentId(g.student) === sid) || null;
  return resolveAssignmentGrade({ discussionGradeRow: row || null });
}

function sortAssignmentsChronologically(assignments) {
  return [...assignments].sort((a, b) => {
    const da = a.createdAt || a.dueDate || 0;
    const db = b.createdAt || b.dueDate || 0;
    return new Date(da).getTime() - new Date(db).getTime();
  });
}

/**
 * Canonical assignment column list for gradebook + student grade API (dedupe by id only).
 */
async function loadCourseGradeAssignments(courseId, options = {}) {
  const modules = await Module.find({ course: courseId }).select('_id title createdAt').lean();
  const moduleIds = modules.map((m) => m._id);
  const moduleAssignments = moduleIds.length
    ? await Assignment.find({ module: { $in: moduleIds } }).lean()
    : [];

  const courseGroupSets = await GroupSet.find({ course: courseId }).select('_id').lean();
  const groupAssignments =
    courseGroupSets.length > 0
      ? await Assignment.find({
          isGroupAssignment: true,
          groupSet: { $in: courseGroupSets.map((g) => g._id) },
        }).lean()
      : [];

  const threads = await Thread.find({ course: courseId, isGraded: true }).lean();
  const discussions = threads.map((thread) => ({
    _id: thread._id,
    title: thread.title,
    totalPoints: thread.totalPoints || 0,
    group: thread.group || 'Discussions',
    isDiscussion: true,
    isGraded: true,
    published: thread.published !== false,
    studentGrades: thread.studentGrades || [],
    dueDate: thread.dueDate,
    createdAt: thread.createdAt,
    discussionReleaseMode: thread.discussionReleaseMode,
    gradesReleasedAt: thread.gradesReleasedAt,
    gradeHidden: thread.gradeHidden,
    gradingPeriodId: thread.gradingPeriodId || null,
  }));

  const combined = [...moduleAssignments, ...groupAssignments, ...discussions];
  const deduped = combined.filter(
    (a, i, arr) => i === arr.findIndex((b) => String(b._id) === String(a._id))
  );

  let filtered = deduped;
  if (options.gradingPeriodId && options.gradingPeriodId !== 'all') {
    const periodId = String(options.gradingPeriodId);
    filtered = deduped.filter((a) => a.gradingPeriodId && String(a.gradingPeriodId) === periodId);
  }

  return sortAssignmentsChronologically(filtered);
}

async function loadGroupSubmissionsForStudent(groupAssignments, studentId) {
  if (!groupAssignments.length) return [];

  const groupSetIds = [
    ...new Set(groupAssignments.map((a) => a.groupSet).filter(Boolean).map(String)),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const groups = await Group.find({
    groupSet: { $in: groupSetIds },
    members: studentId,
  })
    .select('_id groupSet')
    .lean();

  const groupBySet = new Map(groups.map((g) => [String(g.groupSet), g]));
  const groupIds = groups.map((g) => g._id);
  const groupAssignmentIds = groupAssignments.map((a) => a._id);

  const groupSubs =
    groupIds.length > 0
      ? await Submission.find({
          assignment: { $in: groupAssignmentIds },
          group: { $in: groupIds },
        }).lean()
      : [];

  const subByAssignmentGroup = new Map(
    groupSubs.map((s) => [`${String(s.assignment)}:${String(s.group)}`, s])
  );

  const groupSubmissions = [];
  for (const groupAssignment of groupAssignments) {
    const group = groupBySet.get(String(groupAssignment.groupSet));
    if (!group) continue;
    const submission = subByAssignmentGroup.get(
      `${String(groupAssignment._id)}:${String(group._id)}`
    );
    if (submission) groupSubmissions.push(submission);
  }
  return groupSubmissions;
}

/**
 * Batch group submissions for many students (2–3 queries total vs 2×N).
 * Returns Map<studentId, Submission[]>.
 */
async function loadGroupSubmissionsForStudents(groupAssignments, studentIds) {
  const result = new Map(studentIds.map((id) => [normalizeStudentId(id), []]));
  if (!groupAssignments.length || !studentIds.length) return result;

  const groupSetIds = [
    ...new Set(groupAssignments.map((a) => a.groupSet).filter(Boolean).map(String)),
  ].map((id) => new mongoose.Types.ObjectId(id));
  const studentOids = studentIds
    .map((id) => normalizeStudentId(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const groups = await Group.find({
    groupSet: { $in: groupSetIds },
    members: { $in: studentOids },
  })
    .select('_id groupSet members')
    .lean();

  if (!groups.length) return result;

  const groupIds = groups.map((g) => g._id);
  const groupAssignmentIds = groupAssignments.map((a) => a._id);
  const groupSubs = await Submission.find({
    assignment: { $in: groupAssignmentIds },
    group: { $in: groupIds },
  }).lean();

  const subByAssignmentGroup = new Map(
    groupSubs.map((s) => [`${String(s.assignment)}:${String(s.group)}`, s])
  );

  for (const group of groups) {
    const memberIds = (group.members || []).map((m) => normalizeStudentId(m));
    for (const groupAssignment of groupAssignments) {
      if (String(groupAssignment.groupSet) !== String(group.groupSet)) continue;
      const submission = subByAssignmentGroup.get(
        `${String(groupAssignment._id)}:${String(group._id)}`
      );
      if (!submission) continue;
      for (const sid of memberIds) {
        if (!result.has(sid)) continue;
        result.get(sid).push(submission);
      }
    }
  }

  return result;
}

function materializeStudentGradeInputs({
  assignments,
  studentId,
  audience,
  regularSubmissions,
  groupSubmissions,
  repliedThreadIds,
  firstReplyAtByThread,
  resolved,
}) {
  const includeMutedInTotals =
    resolved?.gradeVisibility?.mutedAssignmentsInTotals === 'include';
  const effectiveAudience =
    includeMutedInTotals && audience === 'student' ? 'instructor' : audience;
  const sid = normalizeStudentId(studentId);

  const regularAssignments = assignments.filter((a) => !a.isDiscussion && !a.isGroupAssignment);
  const groupAssignments = assignments.filter((a) => a.isGroupAssignment);
  const discussions = assignments.filter((a) => a.isDiscussion);

  const submissionMap = {};
  for (const sub of [...regularSubmissions, ...groupSubmissions]) {
    submissionMap[String(sub.assignment)] = sub;
  }

  const discussionItems = discussions.map((thread) => {
    const gradeRow =
      effectiveAudience === 'student'
        ? discussionGradeVisibility.discussionGradeForTotals(thread, sid)
        : (thread.studentGrades || []).find((g) => normalizeStudentId(g.student) === sid) || null;
    const gradeVisibility =
      audience === 'student'
        ? discussionGradeVisibility.resolveDiscussionGradeVisibility(
            thread,
            discussionGradeVisibility.findStudentGrade(thread, sid)
          )
        : undefined;
    return {
      _id: thread._id,
      title: thread.title,
      group: thread.group || 'Discussions',
      totalPoints: thread.totalPoints || 0,
      isDiscussion: true,
      isGraded: thread.isGraded !== false,
      published: thread.published !== false,
      dueDate: thread.dueDate,
      createdAt: thread.createdAt,
      hasSubmitted: repliedThreadIds.has(String(thread._id)),
      studentReplyCreatedAt: firstReplyAtByThread.get(String(thread._id)) ?? null,
      studentGrades: thread.studentGrades || [],
      discussionReleaseMode: thread.discussionReleaseMode,
      gradesReleasedAt: thread.gradesReleasedAt,
      gradeHidden: thread.gradeHidden,
      gradeVisibility,
      ...assignmentGradeCalcFields(thread),
      grade: resolveDiscussionGrade(thread, sid, effectiveAudience),
    };
  });

  const allAssignments = sortAssignmentsChronologically([
    ...regularAssignments.map((a) => ({
      _id: a._id,
      title: a.title,
      group: a.group,
      totalPoints: a.totalPoints || 0,
      questions: a.questions,
      isDiscussion: false,
      isGroupAssignment: false,
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      published: a.published,
      ...assignmentGradeCalcFields(a),
      grade: resolveSubmissionGrade(submissionMap[String(a._id)], a, sid, effectiveAudience),
    })),
    ...groupAssignments.map((a) => ({
      _id: a._id,
      title: a.title,
      group: a.group,
      totalPoints: a.totalPoints || 0,
      questions: a.questions,
      isDiscussion: false,
      isGroupAssignment: true,
      groupSet: a.groupSet,
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      published: a.published,
      ...assignmentGradeCalcFields(a),
      grade: resolveSubmissionGrade(submissionMap[String(a._id)], a, sid, effectiveAudience),
    })),
    ...discussionItems,
  ]);

  const grades = {};
  buildGradesMapForStudent(grades, sid, allAssignments);

  return { allAssignments, grades, submissionMap };
}

/**
 * Build grade inputs for many students with shared DB loads (gradebook page / class average).
 * Returns Map<studentId, { allAssignments, grades, submissionMap }>.
 */
async function buildStudentGradeInputsForStudents(
  course,
  studentIds,
  assignments,
  audience = 'instructor',
  options = {}
) {
  const sids = [...new Set((studentIds || []).map(normalizeStudentId).filter(Boolean))];
  const out = new Map();
  if (!sids.length) return out;

  const regularAssignments = assignments.filter((a) => !a.isDiscussion && !a.isGroupAssignment);
  const groupAssignments = assignments.filter((a) => a.isGroupAssignment);
  const discussions = assignments.filter((a) => a.isDiscussion);
  const assignmentIds = regularAssignments.map((a) => a._id);
  const threadIds = discussions.map((d) => d._id);

  const studentOids = sids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [regularSubs, groupSubsByStudent, repliedByStudent, firstReplyByStudent] =
    await Promise.all([
      assignmentIds.length && studentOids.length
        ? Submission.find({
            assignment: { $in: assignmentIds },
            student: { $in: studentOids },
          }).lean()
        : [],
      loadGroupSubmissionsForStudents(groupAssignments, sids),
      discussionReplyService.batchStudentDiscussionParticipation(sids, threadIds),
      discussionReplyService.batchFirstReplyCreatedAtForStudents(sids, threadIds),
    ]);

  const regularByStudent = new Map(sids.map((id) => [id, []]));
  for (const sub of regularSubs) {
    const sid = normalizeStudentId(sub.student);
    if (!regularByStudent.has(sid)) regularByStudent.set(sid, []);
    regularByStudent.get(sid).push(sub);
  }

  for (const sid of sids) {
    out.set(
      sid,
      materializeStudentGradeInputs({
        assignments,
        studentId: sid,
        audience,
        regularSubmissions: regularByStudent.get(sid) || [],
        groupSubmissions: groupSubsByStudent.get(sid) || [],
        repliedThreadIds: repliedByStudent.get(sid) || new Set(),
        firstReplyAtByThread: firstReplyByStudent.get(sid) || new Map(),
        resolved: options.resolved,
      })
    );
  }

  return out;
}

/**
 * Build allAssignments, grades map, and submissionMap for one student.
 * @param {'instructor'|'student'} audience — student applies grade-release + discussion visibility
 * @param {{ resolved?: object }} [options]
 */
async function buildStudentGradeInputs(course, studentId, assignments, audience = 'instructor', options = {}) {
  const sid = normalizeStudentId(studentId);
  const regularAssignments = assignments.filter((a) => !a.isDiscussion && !a.isGroupAssignment);
  const groupAssignments = assignments.filter((a) => a.isGroupAssignment);
  const discussions = assignments.filter((a) => a.isDiscussion);

  const assignmentIds = regularAssignments.map((a) => a._id);
  const regularSubmissions = assignmentIds.length
    ? await Submission.find({
        assignment: { $in: assignmentIds },
        student: studentId,
      }).lean()
    : [];

  const groupSubmissions = await loadGroupSubmissionsForStudent(groupAssignments, studentId);

  const threadIds = discussions.map((d) => d._id);
  const [repliedThreadIds, firstReplyAtByThread] = await Promise.all([
    discussionReplyService.batchThreadIdsRepliedByUser(threadIds, studentId),
    discussionReplyService.batchFirstReplyCreatedAtByUser(threadIds, studentId),
  ]);

  return materializeStudentGradeInputs({
    assignments,
    studentId: sid,
    audience,
    regularSubmissions,
    groupSubmissions,
    repliedThreadIds,
    firstReplyAtByThread,
    resolved: options.resolved,
  });
}

async function computeStudentCurrentGrade(course, studentId, audience = 'student') {
  const { computeStudentCourseGrade } = require('./gradeCalculation.service');
  return computeStudentCourseGrade(course, studentId, { audience });
}

module.exports = {
  loadCourseGradeAssignments,
  buildStudentGradeInputs,
  buildStudentGradeInputsForStudents,
  computeStudentCurrentGrade,
  loadGroupSubmissionsForStudent,
  loadGroupSubmissionsForStudents,
  sortAssignmentsChronologically,
};
