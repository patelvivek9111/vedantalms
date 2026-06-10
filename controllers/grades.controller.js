const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade,
  resolveAssignmentGrade,
  buildGradesMapForStudent,
  EXCUSED_GRADE,
} = require('../utils/gradeCalculation');
const { getJson, setJson } = require('../utils/cache');
const { calculateCourseGradeForStudent } = require('../services/gradeCalculation.service');
const { computeCourseClassAverage, computeCourseClassAverages } = require('../services/gradebookData.service');
const gradeReleaseService = require('../services/gradeRelease.service');
const observability = require('../services/workflowObservability.service');
const discussionGradeVisibility = require('../services/discussionGradeVisibility.service');
const discussionReplyService = require('../services/discussionReply.service');

function submissionVisibleForStudent(submission, assignment) {
  if (!submission) return null;
  return gradeReleaseService.resolveStudentGradeVisibility(submission, assignment).scoreVisible
    ? submission
    : null;
}

// GET /api/grades/student/course/:courseId
exports.getStudentCourseGrade = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id;
    const cacheKey = `grades:student:v3:${studentId}:course:${courseId}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch course with groups and gradeScale
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const groups = course.groups || [];
    const gradeScale = course.gradeScale || [];

    // Fetch all modules for the course
    const modules = await Module.find({ course: courseId }).select('_id title').sort({ createdAt: 1 }).lean();
    const moduleIds = modules.map(m => m._id);

    // Fetch all assignments for these modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } }).lean();

    // Fetch only the current course's group assignments via GroupSet index
    const courseGroupSets = await GroupSet.find({ course: courseId }).select('_id').lean();
    const courseGroupSetIds = courseGroupSets.map((groupSet) => groupSet._id);
    const groupAssignments = courseGroupSetIds.length > 0
      ? await Assignment.find({
          isGroupAssignment: true,
          groupSet: { $in: courseGroupSetIds }
        }).lean()
      : [];

    // Fetch all submissions for this student for regular assignments
    const assignmentIds = assignments.map(a => a._id);
    const regularSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    }).lean();
    
    // Group assignments: batch-resolve groups + submissions (avoid N+1 per group assignment)
    let groupSubmissions = [];
    if (groupAssignments.length > 0) {
      const groupSetIds = [...new Set(groupAssignments.map((a) => a.groupSet).filter(Boolean).map(String))].map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const groups = await Group.find({
        groupSet: { $in: groupSetIds },
        members: studentId
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
              group: { $in: groupIds }
            }).lean()
          : [];
      const subByAssignmentGroup = new Map(
        groupSubs.map((s) => [`${String(s.assignment)}:${String(s.group)}`, s])
      );
      for (const groupAssignment of groupAssignments) {
        const group = groupBySet.get(String(groupAssignment.groupSet));
        if (!group) continue;
        const submission = subByAssignmentGroup.get(`${String(groupAssignment._id)}:${String(group._id)}`);
        if (submission) groupSubmissions.push(submission);
      }
    }

    // Combine all submissions
    const allSubmissions = [...regularSubmissions, ...groupSubmissions];
    const submissionMap = {};
    allSubmissions.forEach(sub => {
      submissionMap[sub.assignment.toString()] = sub;
    });

    // Fetch all graded discussions (threads) for the course
    const threads = await Thread.find({ course: courseId, isGraded: true }).lean();
    const threadIds = threads.map((t) => t._id);
    const repliedThreadIds = await discussionReplyService.batchThreadIdsRepliedByUser(threadIds, studentId);
    const discussionAssignments = [];
    for (const thread of threads) {
      const studentGradeObj = discussionGradeVisibility.discussionGradeForTotals(thread, studentId);
      const hasSubmitted = repliedThreadIds.has(String(thread._id));
      discussionAssignments.push({
        _id: thread._id,
        title: thread.title,
        group: thread.group || 'Discussions',
        totalPoints: thread.totalPoints || 0,
        isDiscussion: true,
        published: thread.published !== false,
        grade: resolveAssignmentGrade({ discussionGradeRow: studentGradeObj || null }),
        dueDate: thread.dueDate || null,
        hasSubmitted,
        gradeVisibility: discussionGradeVisibility.resolveDiscussionGradeVisibility(
          thread,
          discussionGradeVisibility.findStudentGrade(thread, studentId)
        )
      });
    }

    // Combine assignments and discussionAssignments for grade calculation
    const allAssignments = [
      ...assignments.map(a => ({
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        assignment: a,
        dueDate: a.dueDate,
        published: a.published,
        grade: resolveAssignmentGrade({
          submission: submissionVisibleForStudent(submissionMap[a._id.toString()], a)
        })
      })),
      ...groupAssignments.map(a => {
        const submission = submissionMap[a._id.toString()];
        const visibleSubmission = submissionVisibleForStudent(submission, a);
        
        return {
          _id: a._id,
          title: a.title,
          group: a.group,
          totalPoints: a.totalPoints || 0,
          questions: a.questions,
          isDiscussion: false,
          assignment: a,
          dueDate: a.dueDate,
          published: a.published,
          grade: visibleSubmission
            ? resolveAssignmentGrade({
                submission: {
                  ...visibleSubmission,
                  _memberStudentId: studentId
                }
              })
            : null
        };
      }),
      ...discussionAssignments
    ];

    const sid = String(studentId);
    const grades = {};
    buildGradesMapForStudent(grades, sid, allAssignments);

    const { totalPercent, letterGrade } = await calculateCourseGradeForStudent(
      sid,
      course,
      allAssignments,
      grades,
      submissionMap
    );

    const payload = { totalPercent, letterGrade };
    await setJson(cacheKey, payload, 60);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/student/course/:courseId/legacy
exports.getStudentCourseGradeLegacy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id;

    // Fetch course with groups and gradeScale
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const groups = course.groups || [];
    const gradeScale = course.gradeScale || [];

    // Fetch all modules for the course
    const modules = await Module.find({ course: courseId }).select('_id title').sort({ createdAt: 1 });
    const moduleIds = modules.map(m => m._id);

    // Fetch all assignments for these modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } });

    // Fetch all group assignments for the course (by groupSet.course)
    const groupAssignmentsRaw = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    }).populate({ path: 'groupSet', match: { course: courseId } });
    // Only keep group assignments for this course
    const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);

    // Fetch all submissions for this student for regular assignments
    const assignmentIds = assignments.map(a => a._id);
    const regularSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    });
    
    // For group assignments, find the student's group for each groupSet and get submissions
    let groupSubmissions = [];
    for (const groupAssignment of groupAssignments) {
      // Find the student's group in this groupSet
      const group = await Group.findOne({
        groupSet: groupAssignment.groupSet._id,
        members: studentId
      });
      if (group) {
        // Find the submission for this group assignment and group
        const submission = await Submission.findOne({
          assignment: groupAssignment._id,
          group: group._id
        }).populate('memberGrades.student', 'firstName lastName');
        if (submission) {
          groupSubmissions.push(submission);
        }
      }
    }

    // Combine all submissions
    const allSubmissions = [...regularSubmissions, ...groupSubmissions];
    const submissionMap = {};
    allSubmissions.forEach(sub => {
      submissionMap[sub.assignment.toString()] = sub;
    });

    // Fetch all graded discussions (threads) for the course
    const threads = await Thread.find({ course: courseId, isGraded: true });
    // For each thread, find the student's grade
    const discussionAssignments = [];
    for (const thread of threads) {
      const studentGradeObj = discussionGradeVisibility.discussionGradeForTotals(thread, studentId);
      const hasSubmitted = await discussionReplyService.hasReplyByUser(thread, studentId);
      discussionAssignments.push({
        _id: thread._id,
        title: thread.title,
        group: thread.group || 'Discussions',
        totalPoints: thread.totalPoints || 0,
        isDiscussion: true,
        published: thread.published !== false,
        grade: resolveAssignmentGrade({ discussionGradeRow: studentGradeObj || null }),
        dueDate: thread.dueDate || null,
        hasSubmitted,
        gradeVisibility: discussionGradeVisibility.resolveDiscussionGradeVisibility(
          thread,
          discussionGradeVisibility.findStudentGrade(thread, studentId)
        )
      });
    }

    const allAssignments = [
      ...assignments.map(a => ({
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        assignment: a,
        dueDate: a.dueDate,
        published: a.published,
        grade: resolveAssignmentGrade({
          submission: submissionVisibleForStudent(submissionMap[a._id.toString()], a)
        })
      })),
      ...groupAssignments.map(a => {
        const submission = submissionMap[a._id.toString()];
        const visibleSubmission = submissionVisibleForStudent(submission, a);
        
        return {
          _id: a._id,
          title: a.title,
          group: a.group,
          totalPoints: a.totalPoints || 0,
          questions: a.questions,
          isDiscussion: false,
          assignment: a,
          dueDate: a.dueDate,
          published: a.published,
          grade: visibleSubmission
            ? resolveAssignmentGrade({
                submission: {
                  ...visibleSubmission,
                  _memberStudentId: studentId
                }
              })
            : null
        };
      }),
      ...discussionAssignments
    ];

    const sid = String(studentId);
    const grades = {};
    buildGradesMapForStudent(grades, sid, allAssignments);

    const { totalPercent, letterGrade } = await calculateCourseGradeForStudent(
      sid,
      course,
      allAssignments,
      grades,
      submissionMap
    );

    res.json({ totalPercent, letterGrade });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/course/:courseId/average
exports.getCourseClassAverage = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user._id;
    const cacheKey = `grades:course-average:v4:${courseId}:${userId}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const course = await Course.findById(courseId).select('instructor').lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const instructorId =
      course.instructor && typeof course.instructor === 'object' && course.instructor._id
        ? String(course.instructor._id)
        : String(course.instructor || '');
    const isInstructor = instructorId === userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view class average' });
    }

    const payload = await computeCourseClassAverage(courseId);
    await setJson(cacheKey, payload, 45);
    res.json(payload);
  } catch (error) {
    console.error('Error calculating class average:', error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/courses/averages?courseIds=id1,id2
exports.getCourseClassAveragesBatch = async (req, res) => {
  try {
    const raw = req.query.courseIds || req.query.ids || '';
    const courseIds = String(raw)
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (!courseIds.length) {
      return res.status(400).json({ message: 'courseIds query parameter is required' });
    }

    const maxBatch = parseInt(process.env.GRADES_AVERAGE_BATCH_MAX || '25', 10);
    if (courseIds.length > maxBatch) {
      return res.status(400).json({ message: `Maximum ${maxBatch} courseIds per request` });
    }

    const userId = String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
      const courses = await Course.find({ _id: { $in: courseIds } }).select('instructor').lean();
      const authorized = courses.filter((course) => {
        const instructorId =
          course.instructor && typeof course.instructor === 'object' && course.instructor._id
            ? String(course.instructor._id)
            : String(course.instructor || '');
        return instructorId === userId;
      });
      if (authorized.length !== courseIds.length) {
        return res.status(403).json({ message: 'Not authorized to view one or more course averages' });
      }
    }

    const cacheKey = `grades:course-averages-batch:v1:${userId}:${courseIds.sort().join(',')}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const averages = await computeCourseClassAverages(courseIds);
    const payload = { averages };
    await setJson(cacheKey, payload, 45);
    res.json(payload);
  } catch (error) {
    console.error('Error calculating batch class averages:', error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/course/:courseId/gradebook?page&pageSize
exports.getCourseGradebook = async (req, res) => {
  try {
    const startedAt = Date.now();
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).select('instructor students').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const { canViewCourseGrades } = require('../middleware/academicPermissions');
    if (!canViewCourseGrades(req.user, course)) {
      const ferpaAudit = require('../services/ferpaAudit.service');
      await ferpaAudit.recordAccessDenied(req, {
        reason: 'gradebook_access_denied',
        entityType: 'course',
        entityId: courseId,
      }).catch(() => {});
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { getCourseGradebookPage } = require('../services/gradebookData.service');
    const data = await getCourseGradebookPage(courseId, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    if (req.user.role === 'student') {
      const sid = String(req.user._id);
      data.students = (data.students || []).filter((student) => String(student._id) === sid);
      data.grades = data.grades?.[sid] ? { [sid]: data.grades[sid] } : {};
      data.submissionMap = Object.fromEntries(
        Object.entries(data.submissionMap || {}).filter(([key]) => key.startsWith(`${sid}_`))
      );
      data.cellMeta = data.cellMeta?.[sid] ? { [sid]: data.cellMeta[sid] } : {};
      data.assignments = (data.assignments || []).map((assignment) => {
        if (!assignment.isDiscussion) return assignment;
        const row = discussionGradeVisibility.findStudentGrade(assignment, sid);
        return {
          ...assignment,
          studentGrades: discussionGradeVisibility.filterStudentGradesForUser(assignment, req.user),
          grade: discussionGradeVisibility.discussionGradeForTotals(assignment, sid)
            ? resolveAssignmentGrade({ discussionGradeRow: row })
            : null,
          gradeVisibility: discussionGradeVisibility.resolveDiscussionGradeVisibility(assignment, row),
        };
      });
      for (const assignment of data.assignments || []) {
        if (!assignment.isDiscussion) continue;
        if (!assignment.gradeVisibility?.scoreVisible && data.grades[sid]) {
          delete data.grades[sid][String(assignment._id)];
        }
      }
    }
    observability.metric('gradebook_page_latency', {
      courseId,
      durationMs: Date.now() - startedAt,
      page: data.pagination?.page,
      pageSize: data.pagination?.pageSize,
      assignmentCount: data.assignments?.length || 0,
      studentCount: data.students?.length || 0,
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// POST /api/grades/course/:courseId/gradebook/export
exports.enqueueGradebookExport = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).select('instructor students').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const { canViewCourseGrades } = require('../middleware/academicPermissions');
    if (!canViewCourseGrades(req.user, course)) {
      const ferpaAudit = require('../services/ferpaAudit.service');
      await ferpaAudit.recordAccessDenied(req, {
        reason: 'gradebook_export_denied',
        entityType: 'course',
        entityId: courseId,
      }).catch(() => {});
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const jobQueueService = require('../services/jobQueue.service');
    const ferpaAudit = require('../services/ferpaAudit.service');
    const { job, async: isAsync } = await jobQueueService.enqueueJob(
      'export.gradebook',
      { courseId: String(courseId) },
      req.user
    );
    await ferpaAudit.recordExportRequest(req, {
      courseId,
      jobId: job._id,
      type: 'export.gradebook',
    }).catch(() => {});

    const downloadUrl =
      job.status === 'completed' && job.downloadToken
        ? `/api/jobs/${job._id}/download?token=${job.downloadToken}`
        : null;

    res.status(isAsync ? 202 : 200).json({
      success: true,
      data: {
        jobId: job._id,
        status: job.status,
        async: isAsync,
        result: job.result,
        downloadUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/grades/course/:courseId/transcript/regenerate
exports.regenerateTranscriptSnapshots = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).select('instructor').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const { canRecomputeGrades } = require('../middleware/academicPermissions');
    if (!canRecomputeGrades(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const jobQueueService = require('../services/jobQueue.service');
    const { job, async: isAsync } = await jobQueueService.enqueueJob(
      'transcript.regenerate',
      {
        courseId: String(courseId),
        term: req.body.term,
        year: req.body.year,
      },
      req.user
    );

    res.status(isAsync ? 202 : 200).json({
      success: true,
      data: { jobId: job._id, status: job.status, async: isAsync, result: job.result },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};