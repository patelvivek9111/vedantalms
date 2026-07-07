const Course = require('../models/course.model');
const gradingPolicyService = require('../services/gradingPolicy.service');
const gradingPolicyAuditService = require('../services/gradingPolicyAudit.service');
const {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade,
  validateGradingPolicy,
} = require('../utils/gradeCalculation');

exports.getInstitutionGradingPolicy = async (req, res) => {
  try {
    const doc = await gradingPolicyService.getInstitutionPolicyDocument();
    res.json({
      success: true,
      data: {
        version: doc.version,
        policy: doc.policy,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInstitutionGradingPolicy = async (req, res) => {
  try {
    const doc = await gradingPolicyService.updateInstitutionPolicy(
      req.body.policy || req.body,
      req.user._id,
      { reason: req.body.reason }
    );
    res.json({
      success: true,
      data: { version: doc.version, policy: doc.policy },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getCourseGradingPolicy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const [coursePolicy, resolved] = await Promise.all([
      gradingPolicyService.getCoursePolicyDocument(courseId),
      gradingPolicyService.getResolvedPolicyForCourse(course),
    ]);
    const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
    const snapshotBundle = generateResolvedPolicySnapshot(resolved);

    res.json({
      success: true,
      data: {
        coursePolicy,
        resolved: {
          version: resolved._meta?.policyVersion,
          missingAssignment: resolved.missingAssignment,
          latePenalty: resolved.latePenalty,
          dropLowest: resolved.dropLowest,
          categoryCaps: resolved.categoryCaps,
          attendance: resolved.attendance,
          gpaScale: resolved.gpaScale,
          groups: resolved.groups,
          gradeScale: resolved.gradeScale,
          policyApplication: resolved.policyApplication
            ? {
                applyMode: resolved.policyApplication.applyMode || 'retroactive_all',
                effectiveAt: resolved.policyApplication.effectiveAt || null,
                effectiveAssignmentId: resolved.policyApplication.effectiveAssignmentId || null,
                legacyPolicy: resolved.policyApplication.legacyPolicy || null,
              }
            : { applyMode: 'retroactive_all', legacyPolicy: null },
          _meta: {
            ...resolved._meta,
            policyHash: snapshotBundle.policyHash,
            policyVersion: snapshotBundle.policyVersion,
          },
        },
        legacy: {
          groups: course.groups,
          gradeScale: course.gradeScale,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function assertCoursePolicyEditor(req, course) {
  const isAdmin = req.user.role === 'admin';
  const isInstructor =
    course.instructor && course.instructor.toString() === req.user._id.toString();
  if (!isAdmin && !isInstructor) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }
}

exports.updateCourseGradingPolicy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await assertCoursePolicyEditor(req, course);

    const gradeLifecycleService = require('../services/gradeLifecycle.service');
    const { getSemesterFromCourse } = require('../utils/semesterUtils');
    const { term, year } = getSemesterFromCourse(course);
    const lifecycle = await gradeLifecycleService.getLifecycle(courseId, term, year);
    if (lifecycle?.status === 'POSTED') {
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required when changing policy on a posted course.',
        });
      }
    }

    const doc = await gradingPolicyService.upsertCoursePolicy(
      courseId,
      {
        policy: req.body.policy,
        groups: req.body.groups,
        gradeScale: req.body.gradeScale,
        reason: req.body.reason,
        applyMode: req.body.applyMode,
        effectiveAt: req.body.effectiveAt,
        effectiveAssignmentId: req.body.effectiveAssignmentId,
        impactSummary: req.body.impactSummary,
      },
      req.user._id
    );

    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Preview overall % under a proposed or saved policy (fixture-style sample).
 */
exports.previewCoursePolicyImpact = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await assertCoursePolicyEditor(req, course);

    const gradingPolicyImpactService = require('../services/gradingPolicyImpact.service');
    const jobQueueService = require('../services/jobQueue.service');
    const studentCount = (course.students || []).length;
    const useAsync =
      req.query.async === 'true' ||
      (req.query.async !== 'false' && jobQueueService.shouldUseAsyncJob(studentCount));

    if (useAsync) {
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'grades.policyImpactPreview',
        {
          courseId,
          payload: req.body,
          userId: String(req.user._id),
        },
        req.user
      );
      const statusCode = isAsync ? 202 : 200;
      return res.status(statusCode).json({
        success: true,
        data: {
          jobId: job._id,
          status: job.status,
          async: isAsync,
          result: job.result,
        },
      });
    }

    const data = await gradingPolicyImpactService.previewCoursePolicyImpact(courseId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.previewCourseGradingPolicy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const proposedPolicy = req.body.policy;
    if (proposedPolicy) {
      const validation = validateGradingPolicy(proposedPolicy);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }
    }

    const { resolved, courseContext } = await gradingPolicyService.getCourseGradingContext(
      course
    );

    let effectiveResolved = resolved;
    if (proposedPolicy) {
      const { resolveGradingPolicy } = require('../shared/grading/policyResolver.cjs');
      const { deepMergePolicy } = require('../shared/grading/policyValidation.cjs');
      effectiveResolved = resolveGradingPolicy({
        course,
        institutionPolicy: { policy: resolved },
        coursePolicy: {
          policy: deepMergePolicy(resolved, proposedPolicy),
          groups: req.body.groups || resolved.groups,
          gradeScale: req.body.gradeScale || resolved.gradeScale,
        },
      });
    }

    const ctx = {
      groups: effectiveResolved.groups,
      gradeScale: effectiveResolved.gradeScale,
      gradingPolicy: effectiveResolved,
    };

    const sampleAssignments = (req.body.sampleAssignments || []).map((a) => ({
      _id: a.id || a._id,
      group: a.group,
      totalPoints: a.totalPoints || 100,
      questions: a.questions || [{ points: a.totalPoints || 100 }],
      published: a.published !== false,
      dueDate: a.dueDate,
      isDiscussion: false,
    }));

    const studentId = 'preview-student';
    const grades = { [studentId]: {} };
    const submissions = {};
    (req.body.sampleGrades || []).forEach((row) => {
      const aid = String(row.assignmentId);
      if (row.excused) {
        grades[studentId][aid] = 'excused';
        submissions[aid] = { excused: true };
      } else if (typeof row.points === 'number') {
        grades[studentId][aid] = row.points;
        submissions[aid] = {
          submittedAt: row.submittedAt || new Date().toISOString(),
        };
      }
    });

    const percent = calculateFinalGradeWithWeightedGroups(
      studentId,
      ctx,
      sampleAssignments,
      grades,
      submissions,
      effectiveResolved
    );
    const letter = getLetterGrade(percent, effectiveResolved.gradeScale);

    res.json({
      success: true,
      data: {
        totalPercent: percent,
        letterGrade: letter,
        policyVersion: effectiveResolved._meta?.policyVersion,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCourseEffectiveGradingPolicy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const breakdown = await gradingPolicyService.getEffectivePolicyBreakdown(course);
    const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
    res.json({
      success: true,
      data: { ...breakdown, gradingEngineVersion: getGradingEngineVersion() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recomputeTranscriptGrades = async (req, res) => {
  try {
    const transcriptRecomputeService = require('../services/transcriptRecompute.service');
    const {
      courseId,
      term,
      year,
      studentIds,
      dryRun: dryRunBody,
      reason,
      forceAmend = false,
    } = req.body;
    const dryRun = dryRunBody !== false && dryRunBody !== 'false';

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required' });
    }

    const Course = require('../models/course.model');
    const jobQueueService = require('../services/jobQueue.service');
    const course = await Course.findById(courseId).select('students').lean();
    const studentCount = (course?.students || []).length;
    const isApply = dryRun === false;
    const useAsync =
      isApply &&
      (req.query.async === 'true' ||
        (req.query.async !== 'false' && jobQueueService.shouldUseAsyncJob(studentCount)));

    if (useAsync) {
      const { job, async: isAsync } = await jobQueueService.enqueueJob(
        'grades.recompute',
        {
          courseId,
          term,
          year,
          studentIds,
          dryRun: false,
          reason,
          forceAmend: forceAmend === true,
          userId: String(req.user._id),
          ip: req.ip,
        },
        req.user
      );
      const statusCode = isAsync ? 202 : 200;
      return res.status(statusCode).json({
        success: true,
        data: {
          jobId: job._id,
          status: job.status,
          async: isAsync,
          result: job.result,
        },
      });
    }

    const result = await transcriptRecomputeService.recomputeTranscriptGrades({
      courseId,
      term,
      year,
      studentIds,
      dryRun,
      reason,
      forceAmend: forceAmend === true,
      user: req.user,
      ip: req.ip,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getInstitutionPolicyImpactSummary = async (req, res) => {
  try {
    const data = await gradingPolicyService.getInstitutionPolicyImpactSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGradingPolicyAuditHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!['institution', 'course'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entityType' });
    }

    if (entityType === 'course') {
      const course = await Course.findById(entityId).lean();
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
    }

    const history = await gradingPolicyAuditService.listAuditHistory(entityType, entityId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
