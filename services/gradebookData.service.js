const mongoose = require('mongoose');
const Course = require('../models/course.model');
const User = require('../models/user.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const {
  resolveAssignmentGrade,
  buildGradesMapForStudent,
  EXCUSED_GRADE,
} = require('../utils/gradeCalculation');
const gradingPolicyService = require('./gradingPolicy.service');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { calculateFinalGradeWithWeightedGroups } = require('../utils/gradeCalculation');
const { courseContextFromResolvedPolicy } = require('../shared/grading/policyResolver.cjs');
const { resolveAssignmentWorkflowState } = require('./assignmentWorkflow.service');
const discussionReplyService = require('./discussionReply.service');
const { mapUsersWithResolvedProfilePictures } = require('../utils/profilePictureUrl');

function normalizeStudentId(id) {
  if (id && typeof id === 'object' && id._id) return String(id._id);
  return String(id);
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

async function loadGradebookColumns(courseId) {
  const modules = await Module.find({ course: courseId }).select('_id title createdAt').lean();
  const moduleIds = modules.map((m) => m._id);
  const moduleAssignments = await Assignment.find({ module: { $in: moduleIds } }).lean();

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
    published: thread.published !== false,
    studentGrades: thread.studentGrades || [],
    dueDate: thread.dueDate,
    replies: [],
    counters: thread.counters || {},
    createdAt: thread.createdAt,
  }));

  const combined = [...moduleAssignments, ...groupAssignments, ...discussions];
  const byId = combined.filter((a, i, arr) => i === arr.findIndex((b) => String(b._id) === String(a._id)));
  const seen = new Set();
  return byId
    .filter((a) => {
      const type = a.isDiscussion ? 'discussion' : 'assignment';
      const key = `${String(a.title || '').trim().toLowerCase()}|${type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const da = a.createdAt || a.dueDate || 0;
      const db = b.createdAt || b.dueDate || 0;
      return new Date(da).getTime() - new Date(db).getTime();
    });
}

/**
 * Build instructor gradebook grades map using batched submission queries.
 */
async function buildGradebookGrades(course, assignments, studentIds, policyCache, studentContextsOut = null, submissionIdsOut = null, cellMetaOut = null) {
  const grades = {};
  studentIds.forEach((sid) => {
    grades[sid] = {};
  });

  const regularAssignments = assignments.filter((a) => !a.isDiscussion && !a.isGroupAssignment);
  const groupAssignments = assignments.filter((a) => a.isGroupAssignment);
  const discussions = assignments.filter((a) => a.isDiscussion);

  const assignmentIds = regularAssignments.map((a) => a._id);
  const regularSubmissions = assignmentIds.length
    ? await Submission.find({
        assignment: { $in: assignmentIds },
        student: { $in: studentIds },
      }).lean()
    : [];

  const byStudent = new Map();
  for (const sub of regularSubmissions) {
    const key = normalizeStudentId(sub.student);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(sub);
  }

  const groupSetIds = [...new Set(groupAssignments.map((a) => a.groupSet).filter(Boolean))];
  const groupsAll =
    groupSetIds.length > 0
      ? await Group.find({
          groupSet: { $in: groupSetIds },
          members: { $in: studentIds },
        })
          .select('_id groupSet members')
          .lean()
      : [];

  const studentGroupBySet = new Map();
  for (const group of groupsAll) {
    for (const memberId of group.members || []) {
      studentGroupBySet.set(
        `${normalizeStudentId(memberId)}:${String(group.groupSet)}`,
        String(group._id)
      );
    }
  }

  const groupAssignmentIds = groupAssignments.map((a) => a._id);
  const groupIds = [...new Set(groupsAll.map((g) => String(g._id)))];
  const groupSubs =
    groupAssignmentIds.length && groupIds.length
      ? await Submission.find({
          assignment: { $in: groupAssignmentIds },
          group: { $in: groupIds },
        }).lean()
      : [];
  const groupSubMap = new Map(
    groupSubs.map((s) => [`${String(s.assignment)}:${String(s.group)}`, s])
  );

  const discussionThreadIds = discussions.map((d) => String(d._id));
  const discussionParticipationMap =
    discussionThreadIds.length && studentIds.length
      ? await discussionReplyService.batchStudentDiscussionParticipation(studentIds, discussionThreadIds)
      : new Map();

  for (const sid of studentIds) {
    const submissionMap = {};
    for (const sub of byStudent.get(sid) || []) {
      submissionMap[String(sub.assignment)] = sub;
    }
    for (const ga of groupAssignments) {
      const groupId = studentGroupBySet.get(`${sid}:${String(ga.groupSet)}`);
      if (groupId) {
        const sub = groupSubMap.get(`${String(ga._id)}:${groupId}`);
        if (sub) submissionMap[String(ga._id)] = sub;
      }
    }

    const discussionItems = [];
    for (const thread of discussions) {
      const studentGradeObj = (thread.studentGrades || []).find(
        (g) => normalizeStudentId(g.student) === sid
      );
      discussionItems.push({
        _id: thread._id,
        title: thread.title,
        group: thread.group || 'Discussions',
        totalPoints: thread.totalPoints || 0,
        isDiscussion: true,
        published: thread.published !== false,
        grade: resolveAssignmentGrade({ discussionGradeRow: studentGradeObj || null }),
        dueDate: thread.dueDate,
        hasSubmitted: discussionParticipationMap.get(sid)?.has(String(thread._id)) || false,
      });
    }

    const allAssignments = [
      ...regularAssignments.map((a) => ({
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        dueDate: a.dueDate,
        published: a.published,
        grade: resolveAssignmentGrade({ submission: submissionMap[String(a._id)] || null }),
      })),
      ...groupAssignments.map((a) => ({
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        dueDate: a.dueDate,
        published: a.published,
        grade: resolveAssignmentGrade({
          submission: submissionMap[String(a._id)]
            ? { ...submissionMap[String(a._id)], _memberStudentId: sid }
            : null,
        }),
      })),
      ...discussionItems,
    ];

    buildGradesMapForStudent(grades, sid, allAssignments);
    if (submissionIdsOut) {
      for (const [assignmentId, sub] of Object.entries(submissionMap)) {
        submissionIdsOut[`${sid}_${assignmentId}`] = String(sub._id);
      }
    }
    if (cellMetaOut) {
      if (!cellMetaOut[sid]) cellMetaOut[sid] = {};
      for (const [assignmentId, sub] of Object.entries(submissionMap)) {
        const assignment = allAssignments.find((item) => String(item._id) === String(assignmentId));
        cellMetaOut[sid][assignmentId] = {
          submissionId: String(sub._id),
          status: resolveAssignmentWorkflowState({ assignment, submission: sub }),
          gradesReleasedAt: sub.gradesReleasedAt || null,
          gradeHidden: sub.gradeHidden === true,
          feedbackReleasedAt: sub.feedbackReleasedAt || null,
          attemptStatus: sub.attemptStatus || null,
        };
      }
    }
    if (studentContextsOut) {
      studentContextsOut[sid] = { allAssignments, submissionMap };
    }
  }

  return grades;
}

/**
 * Class average for dashboard (batched gradebook load, same math as gradebook totals).
 */
async function computeCourseClassAverage(courseId) {
  const course = await Course.findById(courseId).lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }

  const studentIds = (course.students || []).map(normalizeStudentId);
  if (studentIds.length === 0) {
    return { average: null, studentCount: 0, gradedCount: 0 };
  }

  const assignments = await loadGradebookColumns(courseId);
  const policyCache = new Map();
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course, {
    policyCache,
    skipRedisCache: true,
  });
  const courseContext = courseContextFromResolvedPolicy(resolved);
  const studentContexts = {};
  const grades = await buildGradebookGrades(
    course,
    assignments,
    studentIds,
    policyCache,
    studentContexts
  );

  const studentGrades = [];
  for (const sid of studentIds) {
    const ctx = studentContexts[sid];
    if (!ctx) continue;
    const totalPercent = calculateFinalGradeWithWeightedGroups(
      sid,
      courseContext,
      ctx.allAssignments,
      grades,
      ctx.submissionMap,
      resolved
    );
    if (Number.isFinite(totalPercent) && !Number.isNaN(totalPercent)) {
      studentGrades.push(totalPercent);
    }
  }

  if (studentGrades.length === 0) {
    return { average: null, studentCount: studentIds.length, gradedCount: 0 };
  }

  const sum = studentGrades.reduce((acc, n) => acc + n, 0);
  const average = Math.round((sum / studentGrades.length) * 100) / 100;
  return {
    average,
    studentCount: studentIds.length,
    gradedCount: studentGrades.length,
  };
}

async function computeCourseClassAverages(courseIds = []) {
  const uniqueIds = [...new Set((courseIds || []).map(String).filter(Boolean))];
  const results = {};

  await Promise.all(
    uniqueIds.map(async (courseId) => {
      try {
        results[courseId] = await computeCourseClassAverage(courseId);
      } catch (error) {
        results[courseId] = {
          error: error.message || 'failed',
          average: null,
          studentCount: 0,
          gradedCount: 0,
        };
      }
    })
  );

  return results;
}

async function getCourseGradebookPage(courseId, { page = 1, pageSize = 50, policyCache } = {}) {
  const course = await Course.findById(courseId)
    .populate('instructor', 'firstName lastName email')
    .populate('students', 'firstName lastName email profilePicture')
    .lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }

  const cache = policyCache || new Map();
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course, { policyCache: cache });
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  const allStudentIds = (course.students || []).map(normalizeStudentId);
  const totalStudents = allStudentIds.length;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));
  const start = (safePage - 1) * safeSize;
  const pageStudentIds = allStudentIds.slice(start, start + safeSize);

  const assignments = await loadGradebookColumns(courseId);
  const submissionMap = {};
  const cellMeta = {};
  const grades =
    pageStudentIds.length > 0
      ? await buildGradebookGrades(course, assignments, pageStudentIds, cache, null, submissionMap, cellMeta)
      : {};

  const students = await mapUsersWithResolvedProfilePictures(
    (course.students || [])
      .map((s) => (typeof s === 'object' ? s : { _id: s }))
      .filter((s) => pageStudentIds.includes(String(s._id)))
  );

  return {
    course: {
      _id: course._id,
      title: course.title,
      instructor: course.instructor,
      groups: course.groups,
      gradeScale: course.gradeScale,
    },
    students,
    assignments,
    grades,
    submissionMap,
    cellMeta,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      totalStudents,
      totalPages: Math.ceil(totalStudents / safeSize) || 1,
    },
    policyMeta: {
      policyHash: snapshotBundle.policyHash,
      policyVersion: snapshotBundle.policyVersion,
      gradingEngineVersion: getGradingEngineVersion(),
    },
  };
}

async function getFullGradebookDataset(courseId, policyCache) {
  const course = await Course.findById(courseId)
    .populate('instructor', 'firstName lastName email')
    .populate('students', 'firstName lastName email profilePicture')
    .lean();
  if (!course) throw new Error('Course not found');

  const studentIds = (course.students || []).map(normalizeStudentId);
  const assignments = await loadGradebookColumns(courseId);
  const cache = policyCache || new Map();
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course, { policyCache: cache });
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);
  const grades =
    studentIds.length > 0
      ? await buildGradebookGrades(course, assignments, studentIds, cache)
      : {};

  return {
    course,
    students: await mapUsersWithResolvedProfilePictures(course.students || []),
    assignments,
    grades,
    policyMeta: {
      policyHash: snapshotBundle.policyHash,
      policyVersion: snapshotBundle.policyVersion,
      gradingEngineVersion: getGradingEngineVersion(),
    },
  };
}

module.exports = {
  loadGradebookColumns,
  buildGradebookGrades,
  computeCourseClassAverage,
  computeCourseClassAverages,
  getCourseGradebookPage,
  getFullGradebookDataset,
  normalizeStudentId,
};
