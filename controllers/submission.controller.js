const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Group = require('../models/Group');
const Course = require('../models/course.model');
const fs = require('fs').promises;
const path = require('path');
const Module = require('../models/module.model');
const { deleteFromCloudinary, extractPublicId, isCloudinaryConfigured } = require('../utils/cloudinary');
const { createNotification } = require('../services/notification');
const gradingPolicySnapshotService = require('../services/gradingPolicySnapshot.service');
const gradeLifecycleService = require('../services/gradeLifecycle.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const fileAssetService = require('../services/fileAsset.service');
const { assertCourseFilesMutable, resolveCourseForAssignment } = require('../services/fileLifecycle.service');
const { buildDownloadPath, attachFileAssets } = fileAssetService;
const { supersedeFileAssets } = require('../services/fileVersioning.service');
const { assertFileMutable } = require('../services/fileGovernance.service');
const { buildClientFileList, buildTeacherFeedbackClientFiles } = require('../utils/fileResponse');
const { serializeSubmissionForApi } = require('../utils/submissionResponse');
const assignmentAccess = require('../services/assignmentAccess.service');
const timedQuizAttemptService = require('../services/timedQuizAttempt.service');
const gradeReleaseService = require('../services/gradeRelease.service');
const submissionVersionService = require('../services/submissionVersion.service');
const observability = require('../services/workflowObservability.service');
const workflowCache = require('../services/workflowCache.service');
const { isPaperUploadQuiz } = require('../utils/quizSubmissionMode');

function getIdempotencyKey(req, prefix) {
  const raw = req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'];
  if (!raw) return null;
  return `${prefix}:${String(raw).slice(0, 128)}`;
}

async function resolveAssignmentCourseContext(assignmentId) {
  const assignmentDoc = await Assignment.findById(assignmentId).select('_id title module').lean();
  if (!assignmentDoc) return null;
  if (!assignmentDoc.module) {
    return {
      assignmentId: assignmentDoc._id,
      assignmentTitle: assignmentDoc.title || 'Assignment',
      courseId: null,
      instructorId: null,
      courseCode: null,
    };
  }

  const moduleDoc = await Module.findById(assignmentDoc.module).select('course').lean();
  if (!moduleDoc?.course) {
    return {
      assignmentId: assignmentDoc._id,
      assignmentTitle: assignmentDoc.title || 'Assignment',
      courseId: null,
      instructorId: null,
      courseCode: null,
    };
  }

  const courseDoc = await Course.findById(moduleDoc.course)
    .select('instructor catalog.courseCode')
    .lean();

  return {
    assignmentId: assignmentDoc._id,
    assignmentTitle: assignmentDoc.title || 'Assignment',
    courseId: courseDoc?._id || moduleDoc.course,
    instructorId: courseDoc?.instructor || null,
    courseCode: courseDoc?.catalog?.courseCode || null,
  };
}

async function invalidateStudentGradeCacheForSubmission(submission) {
  const assignmentDoc = await Assignment.findById(submission.assignment).select('module groupSet').lean();
  let courseId = null;
  if (assignmentDoc?.module) {
    const moduleDoc = await Module.findById(assignmentDoc.module).select('course').lean();
    courseId = moduleDoc?.course;
  } else if (assignmentDoc?.groupSet) {
    const GroupSet = require('../models/GroupSet');
    const groupSetDoc = await GroupSet.findById(assignmentDoc.groupSet).select('course').lean();
    courseId = groupSetDoc?.course;
  }
  if (!courseId) return;

  const studentIds = new Set();
  if (submission.student) studentIds.add(String(submission.student._id || submission.student));
  if (Array.isArray(submission.group?.members)) {
    submission.group.members.forEach((member) => studentIds.add(String(member._id || member)));
  }

  await Promise.all(
    [...studentIds].map((studentId) => workflowCache.invalidateStudentCourseGrade(studentId, courseId))
  );
  observability.metric('grade_visibility_cache_invalidated', {
    assignmentId: String(submission.assignment),
    courseId: String(courseId),
    studentCount: studentIds.size,
  });
}

async function autoGradeSubmissionOnce(submission, assignment) {
  if (!assignment.questions || assignment.questions.length === 0) return submission;
  const submittedAt = submission.submittedAt ? new Date(submission.submittedAt).toISOString() : 'draft';
  const runKey = `${submission._id}:${submittedAt}`;
  if (submission.autoGradeRunKey === runKey && submission.autoGradeExecutedAt) {
    return submission;
  }

  const locked = await Submission.findOneAndUpdate(
    {
      _id: submission._id,
      $or: [
        { autoGradeRunKey: { $exists: false } },
        { autoGradeRunKey: null },
        { autoGradeRunKey: { $ne: runKey } },
      ],
    },
    { $set: { autoGradeRunKey: runKey } },
    { new: true }
  );
  if (!locked) {
    return Submission.findById(submission._id);
  }

  const autoGradeResult = await autoGradeSubmission(locked, assignment);
  locked.autoGraded = autoGradeResult.autoGraded;
  locked.autoGrade = autoGradeResult.autoGrade;
  locked.autoQuestionGrades = autoGradeResult.autoQuestionGrades;

  if (autoGradeResult.allMultipleChoice) {
    locked.finalGrade = autoGradeResult.autoGrade;
    locked.teacherApproved = true;
    locked.grade = autoGradeResult.autoGrade;
    locked.gradedBy = locked.submittedBy;
    locked.gradedAt = new Date();
  }

  locked.autoGradeExecutedAt = new Date();
  await locked.save();
  observability.metric('auto_grade_executed', {
    assignmentId: String(assignment._id),
    submissionId: String(locked._id),
  });
  return locked;
}

async function applySubmissionFiles(submission, assignmentDoc, req) {
  const course = await resolveCourseForAssignment(assignmentDoc._id);
  await fileAssetService.assertStudentEnrolledInCourse(req.user, course);

  if (assignmentDoc.allowStudentUploads === false && req.body.uploadedFiles?.length) {
    const err = new Error('File uploads are not allowed for this assignment');
    err.statusCode = 400;
    throw err;
  }

  if (course) {
    await assertCourseFilesMutable(course, req.user, { action: 'submission_file_update' });
  }

  const { fileAssetIds, legacyUrls } = await fileAssetService.resolveSubmissionFileInputs(
    req.body.uploadedFiles,
    {
      user: req.user,
      assignmentId: assignmentDoc._id,
      courseId: course?._id,
    }
  );

  if (legacyUrls.length) {
    const err = new Error(
      'Legacy file URLs are not accepted. Upload files via POST /api/upload and attach fileAssetId references.'
    );
    err.statusCode = 400;
    throw err;
  }

  const previousIds = (submission.fileAssets || []).map(String);

  for (const id of fileAssetIds) {
    const asset = await require('../models/fileAsset.model').findById(id);
    if (asset) await assertFileMutable(asset, { action: 'attach', user: req.user });
  }

  await supersedeFileAssets({
    previousAssetIds: previousIds,
    newAssetIds: fileAssetIds,
    patch: {
      category: 'submission',
      courseId: course?._id,
      assignmentId: assignmentDoc._id,
      submissionId: submission._id,
      accessScope: { enrolledOnly: true, ownerOnly: false },
      visibility: 'course',
    },
    audit: { userId: req.user._id, ip: req.ip, requestId: req.requestId },
  });

  submission.fileAssets = fileAssetIds;
  submission.files = fileAssetIds.map((id) => buildDownloadPath(id));
  return submission;
}

async function applyTeacherFeedbackFiles(submission, assignmentDoc, req) {
  if (req.body.teacherFeedbackFileAssetIds === undefined) {
    return submission;
  }

  const course = await resolveCourseForAssignment(assignmentDoc._id);
  if (course) {
    await assertCourseFilesMutable(course, req.user, { action: 'feedback_file_update' });
  }

  const fileAssetIds = fileAssetService.parseFileAssetIdsFromBody({
    fileAssetIds: req.body.teacherFeedbackFileAssetIds,
  });

  const previousIds = (submission.teacherFeedbackFileAssets || []).map(String);

  for (const id of fileAssetIds) {
    const asset = await require('../models/fileAsset.model').findById(id);
    if (asset) await assertFileMutable(asset, { action: 'attach', user: req.user });
  }

  await fileAssetService.validateFileAssetIdsForAttach(fileAssetIds, {
    user: req.user,
    courseId: course?._id,
    assignmentId: assignmentDoc._id,
    category: 'feedback',
    ownerOnly: true,
  });

  await supersedeFileAssets({
    previousAssetIds: previousIds,
    newAssetIds: fileAssetIds,
    patch: {
      category: 'feedback',
      courseId: course?._id,
      assignmentId: assignmentDoc._id,
      submissionId: submission._id,
      accessScope: { enrolledOnly: true, ownerOnly: false },
      visibility: 'course',
    },
    audit: { userId: req.user._id, ip: req.ip, requestId: req.requestId },
  });

  submission.teacherFeedbackFileAssets = fileAssetIds;
  submission.teacherFeedbackFiles = fileAssetIds.map((id) => buildDownloadPath(id));
  return submission;
}

async function saveGradedSubmission(submission, auditMeta = {}) {
  const isGraded =
    submission.excused === true ||
    submission.gradedAt != null ||
    submission.grade !== undefined ||
    submission.finalGrade !== undefined;

  let priorDoc = null;
  if (isGraded && submission._id) {
    priorDoc = await require('../models/Submission')
      .findById(submission._id)
      .select('grade finalGrade excused student assignment')
      .lean();
  }

  if (isGraded && submission.assignment) {
    const course = await gradingPolicySnapshotService.getCourseForAssignment(submission.assignment);
    if (course) {
      if (auditMeta.user) {
        const { canEditRawSubmission, requiresAdminOverrideLog } = require('../middleware/academicPermissions');
        const ferpaAudit = require('../services/ferpaAudit.service');
        if (!canEditRawSubmission(auditMeta.user, course)) {
          const err = new Error('Not authorized to edit submissions for this course');
          err.statusCode = 403;
          throw err;
        }
        if (requiresAdminOverrideLog(auditMeta.user)) {
          await ferpaAudit.recordAdminOverride(
            { user: auditMeta.user, ip: auditMeta.ip, path: '/submission/grade', requestId: auditMeta.requestId },
            { entityType: 'submission', entityId: String(submission._id), action: 'grade_edit' }
          ).catch(() => {});
        }
      }
      const { term, year } = getSemesterFromCourse(course);
      const courseId = course._id || course.id;
      await gradeLifecycleService.assertCanEditGrades(courseId, term, year, {
        auditContext: auditMeta.userId
          ? {
              actorId: auditMeta.userId,
              ip: auditMeta.ip,
              after: { submissionId: submission._id, grade: submission.grade },
              metadata: auditMeta.metadata,
            }
          : undefined,
      });
    }
    await gradingPolicySnapshotService.stampSubmissionPolicySnapshot(submission);
  }

  const saved = await submission.save();

  if (priorDoc && submission.assignment) {
    const gradebookHistory = require('../services/gradebookHistory.service');
    const course = await gradingPolicySnapshotService.getCourseForAssignment(submission.assignment);
    if (course) {
      const prevGrade = priorDoc.finalGrade ?? priorDoc.grade ?? null;
      const nextGrade = submission.finalGrade ?? submission.grade ?? null;
      await gradebookHistory.recordGradeChange({
        courseId: course._id || course.id,
        assignmentId: submission.assignment,
        studentId: priorDoc.student || submission.student,
        previousGrade: prevGrade,
        newGrade: nextGrade,
        previousExcused: !!priorDoc.excused,
        newExcused: !!submission.excused,
        changeType: submission.excused ? 'excused' : 'grade',
        changedBy: auditMeta.userId || null,
        metadata: auditMeta.metadata || null,
      }).catch(() => {});
    }
  }

  return saved;
}

// Submit an assignment
exports.submitAssignment = async (req, res) => {
  try {
    const { submissionText, groupId } = req.body;
    const assignmentId = req.params.assignmentId;
    
    // Check if assignment exists
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    await assignmentAccess.assertStudentCanSubmitAssignment(req.user, assignment);
    const submitIdempotencyKey = getIdempotencyKey(req, 'submission');
    const timedQuizSubmission = await timedQuizAttemptService.transitionTimedQuizToSubmitted(req.user, assignment, { groupId });

    let group = null;
    if (assignment.isGroupAssignment) {
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required for group assignments' });
      }

      // Verify the group exists and user is a member
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      if (!group.members.includes(req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this group' });
      }

      // Check if group belongs to the correct group set
      if (group.groupSet.toString() !== assignment.groupSet.toString()) {
        return res.status(400).json({ message: 'Group does not belong to the required group set' });
      }
    }
    
    // Check if submission already exists
    const query = assignment.isGroupAssignment
      ? { assignment: assignmentId, group: groupId }
      : { assignment: assignmentId, student: req.user._id };
    
    let existingSubmission = timedQuizSubmission || await Submission.findOne(query);
    
    if (existingSubmission) {
      if (submitIdempotencyKey && existingSubmission.lastSubmitIdempotencyKey === submitIdempotencyKey) {
        return res.json(serializeSubmissionForApi(existingSubmission));
      }
      if (!assignment.isTimedQuiz) {
        await submissionVersionService.snapshotSubmission(existingSubmission, { actorId: req.user._id });
      }
      // If there's an existing submission, delete its files
      if (!assignment.isTimedQuiz && existingSubmission.files.length > 0) {
        await Promise.all(existingSubmission.files.map(async (file) => {
          // Check if file is from Cloudinary or local
          if (typeof file === 'string' && file.includes('cloudinary.com') && isCloudinaryConfigured()) {
            // Delete from Cloudinary
            const publicId = extractPublicId(file);
            if (publicId) {
              try {
                await deleteFromCloudinary(publicId, 'auto');
              } catch (err) {
                console.error('Error deleting file from Cloudinary:', err);
              }
            }
          } else {
            // Delete local file
          const filePath = path.join(__dirname, '..', file);
          try {
            await fs.unlink(filePath);
          } catch (err) {
              console.error('Error deleting local file:', err);
            }
          }
        }));
      }
      
      // Update existing submission
      if (!assignment.isTimedQuiz) {
        existingSubmission.submissionText = submissionText;
      }
      // Files are already uploaded via /api/upload endpoint, so we get URLs from req.body
      if (!assignment.isTimedQuiz) {
        existingSubmission.files = req.body.uploadedFiles || (req.files ? req.files.map(file => `/uploads/${file.filename}`) : []);
        existingSubmission.submittedAt = new Date();
        existingSubmission.submittedBy = req.user._id;
      }
      if (submitIdempotencyKey) {
        existingSubmission.lastSubmitIdempotencyKey = submitIdempotencyKey;
      }
      
      await existingSubmission.save();
      return res.json(serializeSubmissionForApi(existingSubmission));
    }
    
    // Get file URLs from uploaded files (already uploaded via /api/upload)
    const files = req.body.uploadedFiles || (req.files ? req.files.map(file => `/uploads/${file.filename}`) : []);
    
    const submission = new Submission({
      assignment: assignmentId,
      student: req.user._id,
      group: group ? group._id : undefined,
      submittedBy: req.user._id,
      submissionText,
      files
    });
    
    await submission.save();
    res.status(201).json(serializeSubmissionForApi(submission));
  } catch (error) {
    // If there's an error, delete any uploaded files
    if (req.files) {
      await Promise.all(req.files.map(file => 
        fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
      ));
    }
    res.status(error.statusCode || 500).json({
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }
};

// Create a new submission (student only)
exports.createSubmission = async (req, res) => {
  try {

    const { assignment, answers, groupId } = req.body;
    
    // Check if user is a student
    if (req.user.role !== 'student') {

      return res.status(403).json({ message: 'Only students can submit assignments' });
    }

    // Check if assignment exists and is not past due
    const assignmentDoc = await Assignment.findById(assignment);
    if (!assignmentDoc) {
      
      return res.status(404).json({ message: 'Assignment not found' });
    }
    await assignmentAccess.assertStudentCanSubmitAssignment(req.user, assignmentDoc);
    const submitIdempotencyKey = getIdempotencyKey(req, 'submission');
    const paperUploadQuiz = isPaperUploadQuiz(assignmentDoc);

    // Check if there are any answers provided
    const hasAnswers = answers && Object.keys(answers).length > 0;

    if (paperUploadQuiz) {
      const uploadedFiles = req.body.uploadedFiles;
      const hasFiles = Array.isArray(uploadedFiles) && uploadedFiles.length > 0;
      if (!hasFiles) {
        return res.status(400).json({ message: 'Please upload at least one file before submitting your quiz' });
      }
    } else if (assignmentDoc.questions && assignmentDoc.questions.length > 0) {
      const hasAnyAnswers = hasAnswers && Object.values(answers).some(answer =>
        answer && answer.toString().trim() !== ''
      );

      if (!hasAnyAnswers) {
        return res.status(400).json({ message: 'Please provide answers for the assignment questions' });
      }
    }
    const timedQuizSubmission = paperUploadQuiz
      ? null
      : await timedQuizAttemptService.transitionTimedQuizToSubmitted(req.user, assignmentDoc, {
          groupId,
          answers,
        });

    let group = null;
    if (assignmentDoc.isGroupAssignment) {
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required for group assignments' });
      }

      // Verify the group exists and user is a member
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      if (!group.members.includes(req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this group' });
      }

      // Check if group belongs to the correct group set
      if (group.groupSet.toString() !== assignmentDoc.groupSet.toString()) {
        return res.status(400).json({ message: 'Group does not belong to the required group set' });
      }
    }

    // Check if submission already exists
    const query = assignmentDoc.isGroupAssignment
      ? { assignment, group: groupId }
      : { assignment, student: req.user._id };

    let existingSubmission = timedQuizSubmission || await Submission.findOne(query);
    
    if (existingSubmission) {
      if (submitIdempotencyKey && existingSubmission.lastSubmitIdempotencyKey === submitIdempotencyKey) {
        const enriched = serializeSubmissionForApi(existingSubmission);
        enriched.clientFiles = await buildClientFileList(existingSubmission, req.user._id);
        return res.status(200).json(enriched);
      }

      if (!assignmentDoc.isTimedQuiz) {
        await submissionVersionService.snapshotSubmission(existingSubmission, { actorId: req.user._id });
        existingSubmission.answers = answers;
        existingSubmission.submittedAt = new Date();
        existingSubmission.submittedBy = req.user._id;
      }
      if (submitIdempotencyKey) {
        existingSubmission.lastSubmitIdempotencyKey = submitIdempotencyKey;
      }
      if (req.body.uploadedFiles && !assignmentDoc.isTimedQuiz) {
        await applySubmissionFiles(existingSubmission, assignmentDoc, req);
      }
      
      await existingSubmission.save();
      
      existingSubmission = await autoGradeSubmissionOnce(existingSubmission, assignmentDoc);
      
      const enriched = serializeSubmissionForApi(existingSubmission);
      enriched.clientFiles = await buildClientFileList(existingSubmission, req.user._id);
      return res.status(200).json(enriched);
    }

    // Create new submission
    const submission = new Submission({
      assignment,
      student: req.user._id,
      group: group ? group._id : undefined,
      submittedBy: req.user._id,
      answers,
      submittedAt: new Date(),
      lastSubmitIdempotencyKey: submitIdempotencyKey,
      files: [],
      fileAssets: [],
    });

    await submission.save();

    if (req.body.uploadedFiles?.length) {
      await applySubmissionFiles(submission, assignmentDoc, req);
      await submission.save();
    }
    


    const finalSubmission = await autoGradeSubmissionOnce(submission, assignmentDoc);

    // Notify teacher about new submission
    try {
      const courseContext = await resolveAssignmentCourseContext(assignment);
      if (courseContext?.instructorId) {
        const instructorId = courseContext.instructorId._id || courseContext.instructorId;
        const studentName = `${req.user.firstName} ${req.user.lastName}`;

        await createNotification(instructorId, {
          type: 'submission',
          title: 'New Assignment Submission',
          message: `${studentName} submitted "${courseContext.assignmentTitle}"`,
          link: courseContext.courseId
            ? `/courses/${courseContext.courseId}/assignments/${assignment}/grading`
            : null,
          relatedId: finalSubmission._id,
          relatedType: 'submission',
          priority: 'medium'
        }, {
          source: 'submission.created',
          actorId: req.user._id,
          eventWindow: String(finalSubmission._id),
          requestId: req.requestId || null,
        });

        const {
          recordDomainEvent,
          DOMAIN_EVENT_TYPES,
          AGGREGATE_TYPES,
          AUDIENCE_SCOPES,
        } = require('../services/domainEvents');
        void recordDomainEvent({
          eventType: DOMAIN_EVENT_TYPES.ASSIGNMENT_SUBMITTED,
          aggregateType: AGGREGATE_TYPES.SUBMISSION,
          aggregateId: finalSubmission._id,
          actorId: req.user._id,
          audienceScope: AUDIENCE_SCOPES.COURSE,
          correlationId: req.requestId,
          payload: {
            assignmentId: String(assignment),
            courseId: courseContext?.courseId ? String(courseContext.courseId) : null,
          },
          metadata: { source: 'submission.controller.submit' },
        });
      } else {
        console.warn('submission_notification_skipped_missing_course_context', {
          submissionId: String(finalSubmission._id),
          assignmentId: String(assignment),
          requestId: req.requestId || null,
          actorId: String(req.user?._id || ''),
        });
      }
    } catch (notifError) {
      console.error('submission_notification_create_failed', {
        error: notifError?.message || String(notifError),
        submissionId: String(finalSubmission?._id || ''),
        assignmentId: String(assignment),
        requestId: req.requestId || null,
        actorId: String(req.user?._id || ''),
      });
      // Don't fail the submission if notification fails
    }

    const enriched = serializeSubmissionForApi(finalSubmission);
    enriched.clientFiles = await buildClientFileList(finalSubmission, req.user._id);
    res.status(201).json(enriched);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }
};

// Auto-grade submission function
const autoGradeSubmission = async (submission, assignment) => {
  let totalPoints = 0;
  let earnedPoints = 0;
  let autoQuestionGrades = new Map();
  let allMultipleChoice = true;
  let hasMultipleChoice = false;

  for (let i = 0; i < assignment.questions.length; i++) {
    const question = assignment.questions[i];
    
    // Handle answers whether it's a Map or object
    let studentAnswer = '';
    if (submission.answers instanceof Map) {
      studentAnswer = submission.answers.get(i.toString()) || '';
    } else if (submission.answers && typeof submission.answers === 'object') {
      studentAnswer = submission.answers[i.toString()] || '';
    }
    
    totalPoints += question.points || 0;
    
    if (question.type === 'multiple-choice') {
      hasMultipleChoice = true;
      
      // Check if student answer matches correct answer
      const correctAnswer = question.options?.find(option => option.isCorrect)?.text;
      if (studentAnswer === correctAnswer) {
        earnedPoints += question.points || 0;
        autoQuestionGrades.set(i.toString(), question.points || 0);
      } else {
        autoQuestionGrades.set(i.toString(), 0);
      }
    } else if (question.type === 'matching') {
      hasMultipleChoice = true;
      
      // Handle matching questions
      let questionPoints = 0;
      let totalMatches = 0;
      let correctMatches = 0;
      
      // Parse student answer if it's a JSON string
      let parsedStudentAnswer = studentAnswer;
      if (typeof studentAnswer === 'string') {
        try {
          parsedStudentAnswer = JSON.parse(studentAnswer);
        } catch (e) {
          parsedStudentAnswer = {};
        }
      }
      
      if (question.leftItems && question.rightItems && parsedStudentAnswer && typeof parsedStudentAnswer === 'object') {
        totalMatches = question.leftItems.length;
        
        for (let j = 0; j < question.leftItems.length; j++) {
          const leftItem = question.leftItems[j];
          const studentMatch = parsedStudentAnswer[j];
          
          // Find the correct match for this left item
          const correctRightItem = question.rightItems.find(rightItem => 
            rightItem.id === leftItem.id
          );
          
          if (correctRightItem && studentMatch === correctRightItem.text) {
            correctMatches++;
          }
        }
        
        // Calculate points based on percentage of correct matches
        if (totalMatches > 0) {
          const percentageCorrect = correctMatches / totalMatches;
          questionPoints = Math.floor((question.points || 0) * percentageCorrect * 100) / 100;
        }
      }
      
      earnedPoints += questionPoints;
      autoQuestionGrades.set(i.toString(), questionPoints);
    } else {
      // Non-multiple choice questions need teacher grading
      allMultipleChoice = false;
      autoQuestionGrades.set(i.toString(), 0);
    }
  }

  const autoGradePercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  
  return {
    autoGraded: hasMultipleChoice,
    autoGrade: earnedPoints, // Store actual points earned, not percentage
    autoGradePercentage, // Store percentage separately if needed
    autoQuestionGrades,
    allMultipleChoice: allMultipleChoice && hasMultipleChoice
  };
};

// Get submissions for an assignment
exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const cursor = req.query.cursor;
    const query = { assignment: req.params.assignmentId };
    if (cursor) {
      query.submittedAt = { $lt: new Date(cursor) };
    }

    const submissions = await Submission.find(query)
      .sort({ submittedAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'group',
        populate: {
          path: 'members',
          select: 'firstName lastName email'
        }
      })
      .populate('memberGrades.student', 'firstName lastName email')
      .populate('memberGrades.gradedBy', 'firstName lastName');

    const hasMore = submissions.length > limit;
    const pageItems = hasMore ? submissions.slice(0, limit) : submissions;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.submittedAt?.toISOString() : null;

    const data = await Promise.all(
      pageItems.map(async (submission) => {
        const row = serializeSubmissionForApi(submission);
        row.clientFiles = await buildClientFileList(submission, req.user._id);
        row.teacherFeedbackClientFiles = await buildTeacherFeedbackClientFiles(submission, req.user._id);
        return row;
      })
    );

    res.json({
      data,
      nextCursor,
      hasMore
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all submissions for a student in a course
exports.getStudentSubmissionsForCourse = async (req, res) => {
  try {
    // Find all modules in the course
    const modules = await Module.find({ course: req.params.courseId }).select('_id');
    const moduleIds = modules.map(m => m._id);
    // Find all assignments in those modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } }).select('_id');
    const assignmentIds = assignments.map(a => a._id);
    
    // Find all group assignments for the course
    const groupAssignmentsRaw = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    }).populate({ path: 'groupSet', match: { course: req.params.courseId } });
    // Only keep group assignments for this course
    const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);
    const groupAssignmentIds = groupAssignments.map(a => a._id);

    // Find all submissions by this student for regular assignments
    const individualSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: req.user._id
    }).populate('assignment');

    // For group assignments, find the student's group for each groupSet
    let groupSubmissions = [];
    for (const groupAssignment of groupAssignments) {
      // Find the student's group in this groupSet
      const group = await Group.findOne({
        groupSet: groupAssignment.groupSet._id,
        members: req.user._id
      });
      if (group) {
        // Find the submission for this group assignment and group
        const submission = await Submission.findOne({
          assignment: groupAssignment._id,
          group: group._id
        }).populate('assignment');
        if (submission) {
          groupSubmissions.push(submission);
        }
      }
    }

    // Combine and return all submissions with student-facing grade release rules applied.
    const allSubmissions = [...individualSubmissions, ...groupSubmissions];
    res.json(
      allSubmissions.map((submission) =>
        gradeReleaseService.redactSubmissionForStudent(submission, submission.assignment)
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Grade a submission
exports.gradeSubmission = async (req, res) => {
  try {
    const { grade, feedback, questionGrades, useIndividualGrades, memberGrades, approveGrade, showCorrectAnswers, showStudentAnswers, studentId, excused, releaseGrade, hideGrade, releaseFeedback, teacherFeedbackFileAssetIds } = req.body;
    let submission = await Submission.findById(req.params.id).populate('group');

    // If submission doesn't exist, check if this is for an offline assignment
    if (!submission) {
      // Try to find submission by assignment and student if studentId is provided
      if (studentId) {
        submission = await Submission.findOne({
          assignment: req.body.assignmentId || req.params.assignmentId,
          student: studentId
        }).populate('group');
      }
      
      // If still no submission and we have assignmentId and studentId, check if assignment is offline
      if (!submission && req.body.assignmentId && studentId) {
        const assignment = await Assignment.findById(req.body.assignmentId);
        if (assignment && assignment.isOfflineAssignment) {
          // Create a manual grade submission for offline assignment
          submission = new Submission({
            assignment: req.body.assignmentId,
            student: studentId,
            submittedBy: req.user._id, // Teacher is creating this
            isManualGrade: true,
            submittedAt: new Date()
          });
          await submission.save();
        } else {
      return res.status(404).json({ message: 'Submission not found' });
        }
      } else if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
    }

    // Backwards compatibility: If submittedBy is missing, set it to the student
    if (!submission.submittedBy) {
      submission.submittedBy = submission.student;
    }

    if (excused === true) {
      submission.excused = true;
      submission.grade = undefined;
      submission.finalGrade = undefined;
      submission.teacherApproved = true;
      submission.gradedBy = req.user._id;
      submission.gradedAt = new Date();
      submission.feedback = feedback ?? submission.feedback;
      const assignmentDoc = await Assignment.findById(submission.assignment);
      if (assignmentDoc) {
        await applyTeacherFeedbackFiles(submission, assignmentDoc, req);
      }
      await saveGradedSubmission(submission, { user: req.user, userId: req.user._id, ip: req.ip, requestId: req.requestId });
      await invalidateStudentGradeCacheForSubmission(submission);
      return res.json(serializeSubmissionForApi(submission));
    }
    if (excused === false) {
      submission.excused = false;
    }

    // Handle auto-graded submissions (allow re-grading even if approved)
    if (submission.autoGraded) {
      if (approveGrade) {
        // Teacher is approving the auto-grade
        submission.teacherApproved = true;
        submission.gradedBy = req.user._id;
        submission.gradedAt = new Date();
        
        // Combine auto-graded question grades with teacher grades
        const combinedQuestionGrades = new Map();
        
        // Handle autoQuestionGrades whether it's a Map or object
        if (submission.autoQuestionGrades instanceof Map) {
          submission.autoQuestionGrades.forEach((value, key) => {
            combinedQuestionGrades.set(key, value);
          });
        } else if (submission.autoQuestionGrades && typeof submission.autoQuestionGrades === 'object') {
          Object.entries(submission.autoQuestionGrades).forEach(([key, value]) => {
            combinedQuestionGrades.set(key, value);
          });
        }
        
        // Include any teacher modifications to grades
        if (questionGrades) {
          Object.entries(questionGrades).forEach(([key, value]) => {
            combinedQuestionGrades.set(key, parseFloat(value) || 0);
          });
        }
        submission.questionGrades = combinedQuestionGrades;
        
        // Calculate final grade from combined question grades
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions) {
          let earnedPoints = 0;
          for (let i = 0; i < assignment.questions.length; i++) {
            const grade = combinedQuestionGrades.get(i.toString());
            if (grade !== undefined) {
              earnedPoints += grade;
            } else {
              // Fallback to auto-grade if not in combined grades
              let autoGrade = 0;
              if (submission.autoQuestionGrades instanceof Map) {
                autoGrade = submission.autoQuestionGrades.get(i.toString()) || 0;
              } else if (submission.autoQuestionGrades && typeof submission.autoQuestionGrades === 'object') {
                autoGrade = submission.autoQuestionGrades[i.toString()] || 0;
              }
              earnedPoints += autoGrade;
            }
          }
          submission.finalGrade = earnedPoints;
          submission.grade = submission.finalGrade;
        } else {
          // Fallback if assignment not found
          submission.finalGrade = submission.autoGrade;
          submission.grade = submission.autoGrade;
        }
      } else {
        // Teacher is providing manual grades for non-MC questions or re-grading
        // Always recalculate final grade combining auto-grade and manual grades
        // This ensures correct calculation even when re-grading existing submissions
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions) {
          let totalPoints = 0;
          let earnedPoints = 0;
          
          // Ensure autoQuestionGrades exists - if not, recalculate them
          // Convert to Map format if it's stored as an object
          let autoQuestionGradesMap = new Map();
          if (submission.autoQuestionGrades) {
            if (submission.autoQuestionGrades instanceof Map) {
              autoQuestionGradesMap = submission.autoQuestionGrades;
            } else if (typeof submission.autoQuestionGrades === 'object') {
              // Convert object to Map
              Object.entries(submission.autoQuestionGrades).forEach(([key, value]) => {
                autoQuestionGradesMap.set(key, value);
              });
            }
          }
          
          // Always recalculate auto-grades if we have an auto-graded submission but no auto-grades stored
          // This ensures we have the latest auto-grades even if they weren't saved properly
          if (submission.autoGraded && autoQuestionGradesMap.size === 0) {
            const autoGradeResult = await autoGradeSubmission(submission, assignment);
            submission.autoGraded = autoGradeResult.autoGraded;
            submission.autoGrade = autoGradeResult.autoGrade;
            submission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
            autoQuestionGradesMap = autoGradeResult.autoQuestionGrades;
          }
          
          // If we still don't have auto-grades for all questions, recalculate
          if (autoQuestionGradesMap.size < assignment.questions.length && submission.autoGraded) {
            const autoGradeResult = await autoGradeSubmission(submission, assignment);
            submission.autoGraded = autoGradeResult.autoGraded;
            submission.autoGrade = autoGradeResult.autoGrade;
            submission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
            autoQuestionGradesMap = autoGradeResult.autoQuestionGrades;
          }
          
          // Convert questionGrades to Map format if needed
          // Start fresh and build from teacher-provided grades + auto-grades
          // This ensures we always recalculate correctly, even when re-grading
          let questionGradesMap = new Map();
          
          // First, load teacher-provided grades from the request (highest priority)
          // These are the grades the teacher is submitting now
          if (questionGrades && typeof questionGrades === 'object') {
            Object.entries(questionGrades).forEach(([key, value]) => {
              const questionIndex = parseInt(key);
              if (questionIndex < assignment.questions.length) {
                const question = assignment.questions[questionIndex];
                const parsedValue = parseFloat(value);
                
                // Store teacher-provided grades for text questions
                if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                  questionGradesMap.set(key, isNaN(parsedValue) ? 0 : parsedValue);
                } else {
                  // For auto-graded questions, only store if teacher explicitly changed it
                  const autoGrade = autoQuestionGradesMap.get(key);
                  if (autoGrade !== undefined && autoGrade !== null && 
                      !isNaN(parsedValue) && Math.abs(parsedValue - autoGrade) > 0.01) {
                    // Teacher explicitly changed the auto-grade
                    questionGradesMap.set(key, parsedValue);
                  }
                }
              }
            });
          }
          
          // Load existing text question grades from submission for any questions not provided in request
          // This ensures we don't lose previously graded text questions when re-grading
          // IMPORTANT: Don't load auto-graded questions unless they were manually overridden
          if (submission.questionGrades) {
            if (submission.questionGrades instanceof Map) {
              submission.questionGrades.forEach((value, key) => {
                const questionIndex = parseInt(key);
                if (questionIndex < assignment.questions.length && !questionGradesMap.has(key)) {
                  const question = assignment.questions[questionIndex];
                  // Only preserve text questions (auto-graded questions will use auto-grade)
                  if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                    questionGradesMap.set(key, value);
                  } else {
                    // For auto-graded questions, only preserve if manually overridden
                    // Filter out incorrect stored data (0 when auto-grade is > 0)
                    const autoGrade = autoQuestionGradesMap.get(key);
                    if (autoGrade !== undefined && autoGrade !== null) {
                      const difference = Math.abs(value - autoGrade);
                      // Only preserve if significantly different AND not incorrect stored data
                      if (difference > 0.01 && !(value === 0 && autoGrade > 0)) {
                        // Teacher previously overrode this auto-grade, preserve it
                        questionGradesMap.set(key, value);
                      }
                    }
                  }
                }
              });
            } else if (typeof submission.questionGrades === 'object') {
              Object.entries(submission.questionGrades).forEach(([key, value]) => {
                const questionIndex = parseInt(key);
                if (questionIndex < assignment.questions.length && !questionGradesMap.has(key)) {
                  const question = assignment.questions[questionIndex];
                  // Only preserve text questions
                  if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                    questionGradesMap.set(key, value);
                  } else {
                    // For auto-graded questions, only preserve if manually overridden
                    // Filter out incorrect stored data (0 when auto-grade is > 0)
                    const autoGrade = autoQuestionGradesMap.get(key);
                    if (autoGrade !== undefined && autoGrade !== null) {
                      const difference = Math.abs(value - autoGrade);
                      // Only preserve if significantly different AND not incorrect stored data
                      if (difference > 0.01 && !(value === 0 && autoGrade > 0)) {
                        // Teacher previously overrode this auto-grade, preserve it
                        questionGradesMap.set(key, value);
                      }
                    }
                  }
                }
              });
            }
          }
          
          for (let i = 0; i < assignment.questions.length; i++) {
            const question = assignment.questions[i];
            totalPoints += question.points || 0;
            
            // Check if teacher has provided a grade for this question
            const teacherGrade = questionGradesMap.get(i.toString());
            
            let pointsToAdd = 0;
            if (teacherGrade !== undefined && teacherGrade !== null) {
              // Use teacher's grade if provided
              pointsToAdd = teacherGrade;
            } else if (question.type === 'multiple-choice' || question.type === 'matching') {
              // Use auto-grade for MC and matching questions if teacher hasn't provided a grade
              const autoGrade = autoQuestionGradesMap.get(i.toString());
              if (autoGrade !== undefined && autoGrade !== null) {
                pointsToAdd = autoGrade;
              } else {
                // If auto-grade not found, use 0
                pointsToAdd = 0;
              }
            } else {
              // Use 0 for non-MC/non-matching questions if teacher hasn't provided a grade
              pointsToAdd = 0;
            }
            
            // Store the final grade for this question (whether auto or manual)
            // This ensures questionGrades contains all grades for accurate recalculation
            questionGradesMap.set(i.toString(), pointsToAdd);
            
            earnedPoints += pointsToAdd;
          }
          
          submission.finalGrade = earnedPoints; // Store actual points earned, not percentage
          submission.grade = submission.finalGrade;
          submission.questionGrades = questionGradesMap; // Store as Map with all final grades
          submission.teacherApproved = true;
          submission.gradedBy = req.user._id;
          submission.gradedAt = new Date();
        }
      }
    } else {
      // Traditional grading for non-auto-graded submissions
      if (useIndividualGrades && submission.group) {
        submission.useIndividualGrades = true;
        submission.memberGrades = [];
        let totalGrade = 0;
        let membersGraded = 0;
        
        for (const memberId in memberGrades) {
          const memberGrade = parseFloat(memberGrades[memberId]);
          if (!isNaN(memberGrade)) {
            submission.memberGrades.push({
              student: memberId,
              grade: memberGrade,
              gradedBy: req.user._id,
              gradedAt: new Date(),
            });
            totalGrade += memberGrade;
            membersGraded++;
          }
        }
        // Calculate average grade for the group
        submission.grade = membersGraded > 0 ? totalGrade / membersGraded : 0;
        submission.finalGrade = submission.grade;

      } else {
        submission.useIndividualGrades = false;
        // Only validate grade if it's provided and not approving auto-grade
        if (grade !== undefined && !approveGrade) {
          const parsedGrade = parseFloat(grade);
          if (isNaN(parsedGrade)) {
            return res.status(400).json({ message: 'Invalid grade format' });
          }
          submission.grade = parsedGrade;
          submission.finalGrade = parsedGrade;
        }
      }
      
      if (questionGrades) {
        submission.questionGrades = new Map(
          Object.entries(questionGrades).map(([key, value]) => [key, parseFloat(value) || 0])
        );
        
        // Recalculate final grade combining manual grades with auto-grades
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions) {
          let earnedPoints = 0;
          
          for (let i = 0; i < assignment.questions.length; i++) {
            const questionIndex = i.toString();
            
            // Check if there's a manual grade override
            const teacherGrade = submission.questionGrades.get(questionIndex);
            if (teacherGrade !== undefined) {
              // Use manual grade if provided
              earnedPoints += teacherGrade;
            } else {
              // If no manual grade, use auto-grade if available
              let autoGrade = 0;
              if (submission.autoQuestionGrades instanceof Map) {
                autoGrade = submission.autoQuestionGrades.get(questionIndex) || 0;
              } else if (submission.autoQuestionGrades && typeof submission.autoQuestionGrades === 'object') {
                autoGrade = submission.autoQuestionGrades[questionIndex] || 0;
              }
              earnedPoints += autoGrade;
            }
          }
          
          submission.finalGrade = earnedPoints;
          submission.grade = submission.finalGrade;
          submission.teacherApproved = true;
          submission.gradedBy = req.user._id;
          submission.gradedAt = new Date();
        }
      }
    }

    submission.feedback = feedback;

    const assignmentDoc = await Assignment.findById(submission.assignment);
    if (assignmentDoc) {
      await applyTeacherFeedbackFiles(submission, assignmentDoc, req);
    }
    
    // Update quiz feedback options if provided
    if (showCorrectAnswers !== undefined) {
      submission.showCorrectAnswers = showCorrectAnswers;
    }
    if (showStudentAnswers !== undefined) {
      submission.showStudentAnswers = showStudentAnswers;
    }

    gradeReleaseService.applyReleaseFields(submission, {
      releaseGrade: releaseGrade === true || releaseGrade === 'true',
      hideGrade: hideGrade === true || hideGrade === 'true',
      releaseFeedback: releaseFeedback === true || releaseFeedback === 'true',
      idempotencyKey: getIdempotencyKey(req, 'release'),
    });
    
    await saveGradedSubmission(submission, { user: req.user, userId: req.user._id, ip: req.ip, requestId: req.requestId });
    await invalidateStudentGradeCacheForSubmission(submission);
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'group',
        populate: {
          path: 'members',
          select: 'firstName lastName email'
        }
      })
      .populate('memberGrades.student', 'firstName lastName email')
      .populate('memberGrades.gradedBy', 'firstName lastName');

    // Notify student when assignment is graded
    // Initialize notificationCreated outside the if block
    let notificationCreated = false;
    
    if (submission.teacherApproved) {
      try {
        const courseContext = await resolveAssignmentCourseContext(submission.assignment);
        
        // Get student ID - handle both populated and unpopulated cases
        let studentId = null;
        if (populatedSubmission.student) {
          studentId = populatedSubmission.student._id || populatedSubmission.student;
        } else if (submission.student) {
          studentId = submission.student._id || submission.student;
        }
        
        if (studentId) {
          const studentName = populatedSubmission.student ? 
            `${populatedSubmission.student.firstName} ${populatedSubmission.student.lastName}` : 'Student';
          const grade = submission.finalGrade || submission.grade || submission.autoGrade || 0;
          const assignmentTitle = courseContext?.assignmentTitle || 'Assignment';
          const courseId = courseContext?.courseId || null;
          const courseCode = courseContext?.courseCode || null;
          
          // Ensure studentId is ObjectId format (not string)
          const mongoose = require('mongoose');
          const studentObjectId = mongoose.Types.ObjectId.isValid(studentId) ? 
            (typeof studentId === 'string' ? new mongoose.Types.ObjectId(studentId) : studentId) : 
            studentId;
          
          // Build notification message with course code if available
          let notificationMessage = `Your submission for "${assignmentTitle}" has been graded. You received ${grade} points.`;
          if (courseCode) {
            notificationMessage = `[${courseCode}] Your submission for "${assignmentTitle}" has been graded. You received ${grade} points.`;
          }
          
          const notification = await createNotification(studentObjectId, {
            type: 'assignment_graded',
            title: 'Assignment Graded',
            message: notificationMessage,
            link: courseId ? 
              `/courses/${courseId}/assignments/${courseContext?.assignmentId || submission.assignment}` : null,
            relatedId: courseContext?.assignmentId || submission.assignment,
            relatedType: 'assignment',
            priority: 'high'
          }, {
            source: 'submission.graded',
            actorId: req.user._id,
            eventWindow: `graded:${String(submission._id)}`,
            requestId: req.requestId || null,
          });
          
          if (notification) {
            notificationCreated = true;
          }

          const {
            recordDomainEvent,
            DOMAIN_EVENT_TYPES,
            AGGREGATE_TYPES,
            AUDIENCE_SCOPES,
          } = require('../services/domainEvents');
          void recordDomainEvent({
            eventType: DOMAIN_EVENT_TYPES.ASSIGNMENT_GRADED,
            aggregateType: AGGREGATE_TYPES.SUBMISSION,
            aggregateId: submission._id,
            actorId: req.user._id,
            audienceScope: AUDIENCE_SCOPES.USER,
            correlationId: req.requestId,
            payload: {
              studentId: String(studentObjectId),
              assignmentId: String(courseContext?.assignmentId || submission.assignment),
              courseId: courseId ? String(courseId) : null,
              grade,
            },
            metadata: { source: 'submission.controller.grade' },
          });
        }
      } catch (notifError) {
        console.error('grade_notification_create_failed', {
          error: notifError?.message || String(notifError),
          submissionId: String(submission?._id || ''),
          assignmentId: String(submission?.assignment || ''),
          requestId: req.requestId || null,
          actorId: String(req.user?._id || ''),
        });
        // Don't fail the grading if notification fails
      }
    }

    // Add notification status to response
    let responseData;
    try {
      if (populatedSubmission && typeof populatedSubmission.toObject === 'function') {
        responseData = serializeSubmissionForApi(populatedSubmission);
      } else if (populatedSubmission && typeof populatedSubmission === 'object') {
        responseData = { ...populatedSubmission };
      } else {
        responseData = populatedSubmission;
      }
      
      // Ensure responseData is an object
      if (!responseData || typeof responseData !== 'object') {
        responseData = {};
      }
      
      responseData.notificationCreated = notificationCreated || false;
      responseData.teacherApproved = submission.teacherApproved || false;
      responseData.teacherFeedbackClientFiles = await buildTeacherFeedbackClientFiles(submission, req.user._id);
      
      res.json(responseData);
    } catch (responseError) {
      console.error('Error formatting response:', responseError);
      const fallback = populatedSubmission
        ? serializeSubmissionForApi(populatedSubmission)
        : serializeSubmissionForApi(submission);
      res.json({
        ...fallback,
        notificationCreated: notificationCreated || false,
        teacherApproved: submission.teacherApproved || false,
      });
    }
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Error grading submission',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Get a student's submission for an assignment
exports.getStudentSubmission = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    await assignmentAccess.assertStudentCanViewAssignment(req.user, assignment);

    let submission;

    if (assignment.isGroupAssignment) {
      // For group assignments, find the student's group and then the submission
      const group = await Group.findOne({
        groupSet: assignment.groupSet,
        members: req.user._id
      });
      
      if (!group) {
        return res.status(404).json({ message: 'You are not a member of any group for this assignment' });
      }
      
      submission = await Submission.findOne({
        assignment: req.params.assignmentId,
        group: group._id
      }).populate('assignment');
    } else {
      // For regular assignments, find submission by student
      submission = await Submission.findOne({
        assignment: req.params.assignmentId,
        student: req.user._id
      }).populate('assignment');
    }

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const visibility = gradeReleaseService.resolveStudentGradeVisibility(submission, assignment);
    const payload = gradeReleaseService.redactSubmissionForStudent(submission, assignment);
    payload.files = await buildClientFileList(submission, req.user._id);
    if (visibility.feedbackVisible) {
      const feedbackClientFiles = await buildTeacherFeedbackClientFiles(submission, req.user._id);
      payload.teacherFeedbackFiles = feedbackClientFiles;
      payload.teacherFeedbackClientFiles = feedbackClientFiles;
    }
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single submission
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'group',
        populate: {
          path: 'members',
          select: 'firstName lastName email'
        }
      })
      .populate('memberGrades.student', 'firstName lastName email')
      .populate('memberGrades.gradedBy', 'firstName lastName');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const payload = serializeSubmissionForApi(submission);
    payload.clientFiles = await buildClientFileList(submission, req.user._id);
    payload.teacherFeedbackClientFiles = await buildTeacherFeedbackClientFiles(submission, req.user._id);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 

exports.getSubmissionVersions = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const isOwner = String(submission.student) === String(req.user._id);
    const isStaff = req.user.role === 'teacher' || req.user.role === 'admin';
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized to view submission versions' });
    }

    const versions = await submissionVersionService.listSubmissionVersions(submission._id, {
      limit: req.query.limit,
      beforeVersion: req.query.beforeVersion,
    });
    res.json({
      success: true,
      data: versions,
      nextBeforeVersion: versions.length ? versions[versions.length - 1].version : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSubmissionTimeline = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('assignment', 'title')
      .populate('submittedBy', 'firstName lastName')
      .populate('gradedBy', 'firstName lastName')
      .lean();
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const isOwner = String(submission.student) === String(req.user._id);
    const isStaff = req.user.role === 'teacher' || req.user.role === 'admin';
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized to view submission timeline' });
    }

    const versions = await submissionVersionService.listSubmissionVersions(submission._id, {
      limit: req.query.limit || 25,
      beforeVersion: req.query.beforeVersion,
    });
    const events = [
      submission.attemptStartedAt && {
        type: 'attempt_started',
        at: submission.attemptStartedAt,
        actorId: String(submission.student),
      },
      submission.submittedAt && {
        type: 'submitted',
        at: submission.submittedAt,
        actorId: String(submission.submittedBy?._id || submission.submittedBy || submission.student),
      },
      submission.gradedAt && {
        type: 'graded',
        at: submission.gradedAt,
        actorId: String(submission.gradedBy?._id || submission.gradedBy || ''),
      },
      submission.gradesReleasedAt && {
        type: 'grade_released',
        at: submission.gradesReleasedAt,
        releaseRevision: submission.releaseRevision || 0,
      },
      submission.feedbackReleasedAt && {
        type: 'feedback_released',
        at: submission.feedbackReleasedAt,
        releaseRevision: submission.releaseRevision || 0,
      },
      ...versions.map((version) => ({
        type: 'version_snapshot',
        at: version.createdAt,
        version: version.version,
        actorId: String(version.createdBy || ''),
      })),
    ]
      .filter(Boolean)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    res.json({
      success: true,
      data: {
        submissionId: String(submission._id),
        assignmentId: String(submission.assignment?._id || submission.assignment),
        attemptStatus: submission.attemptStatus || 'not_started',
        releaseRevision: submission.releaseRevision || 0,
        events,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create or update a manual grade for an offline assignment
exports.createOrUpdateManualGrade = async (req, res) => {
  try {
    const { assignmentId, studentId, grade, feedback } = req.body;
    
    if (!assignmentId || !studentId) {
      return res.status(400).json({ message: 'Assignment ID and Student ID are required' });
    }
    
    // Verify assignment exists and is offline
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    if (!assignment.isOfflineAssignment) {
      return res.status(400).json({ message: 'This endpoint is only for offline assignments' });
    }
    
    // Check if submission already exists
    let submission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId
    });
    
    if (!submission) {
      // Create new manual grade submission
      submission = new Submission({
        assignment: assignmentId,
        student: studentId,
        submittedBy: req.user._id, // Teacher is creating this
        isManualGrade: true,
        submittedAt: new Date()
      });
    }
    
    // Update grade if provided
    if (grade !== undefined && grade !== null) {
      const gradeNum = parseFloat(grade);
      if (isNaN(gradeNum) || gradeNum < 0) {
        return res.status(400).json({ message: 'Invalid grade format' });
      }
      
      // Validate grade doesn't exceed max points
      const maxPoints = assignment.questions && assignment.questions.length > 0
        ? assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        : assignment.totalPoints || 0;
      
      if (gradeNum > maxPoints) {
        return res.status(400).json({ message: `Grade cannot exceed ${maxPoints} points` });
      }
      
      submission.grade = gradeNum;
      submission.gradedBy = req.user._id;
      submission.gradedAt = new Date();
    } else if (grade === null) {
      // Remove grade
      submission.grade = undefined;
    }
    
    if (feedback !== undefined) {
      submission.feedback = feedback;
    }
    
    await saveGradedSubmission(submission, { user: req.user, userId: req.user._id, ip: req.ip, requestId: req.requestId });
    
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate('gradedBy', 'firstName lastName');
    
    res.json(serializeSubmissionForApi(populatedSubmission));
  } catch (error) {
    console.error('Error creating/updating manual grade:', error);
    res.status(500).json({ message: error.message });
  }
}; 

// Delete a submission
exports.deleteSubmission = async (req, res) => {
  try {
    
    const submission = await Submission.findById(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }



    // Check if user is authorized to delete this submission
    // Teachers and admins can delete any submission
    // Students can only delete their own submissions
    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    const isOwnSubmission = submission.student.toString() === req.user._id.toString();



    if (!isTeacher && !isOwnSubmission) {

      return res.status(403).json({ message: 'Not authorized to delete this submission' });
    }

    // Delete any uploaded files
    if (submission.files && submission.files.length > 0) {
      await Promise.all(submission.files.map(async (file) => {
        const filePath = path.join(__dirname, '..', file);
        try {
          await fs.unlink(filePath);

        } catch (err) {
          console.error('[DeleteSubmission] Error deleting file:', err);
        }
      }));
    }


    
    // Try using findByIdAndDelete instead of deleteOne
    const result = await Submission.findByIdAndDelete(submission._id);
    if (result) {
      res.json({ message: 'Submission deleted successfully' });
    } else {
      res.status(404).json({ message: 'Submission not found' });
    }
  } catch (error) {
    console.error('[DeleteSubmission] Error:', error);
    res.status(500).json({ message: error.message });
  }
}; 