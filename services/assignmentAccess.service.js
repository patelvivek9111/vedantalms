const Assignment = require('../models/Assignment');
const Module = require('../models/module.model');
const GroupSet = require('../models/GroupSet');
const Submission = require('../models/Submission');
const Group = require('../models/Group');
const gradeLifecycleService = require('./gradeLifecycle.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const {
  isCourseGradingStaff,
  isEnrolledStudent,
} = require('../middleware/academicPermissions');
const observability = require('./workflowObservability.service');

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function accessError(message, statusCode, code, details = {}) {
  observability.metric('assignment_access_denied', { code, statusCode });
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function isStaffPreviewUser(user, course) {
  return isCourseGradingStaff(user, course);
}

function isArchivedCourse(course) {
  return course?.operationalStatus === 'archived';
}

async function loadAssignmentContext(assignmentOrId) {
  const assignment =
    assignmentOrId && typeof assignmentOrId === 'object' && assignmentOrId._id
      ? assignmentOrId
      : await Assignment.findById(assignmentOrId);

  if (!assignment) {
    throw accessError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  let moduleDoc = null;
  let groupSet = null;
  let course = null;

  if (assignment.module) {
    moduleDoc = await Module.findById(normalizeId(assignment.module)).populate('course');
    course = moduleDoc?.course || null;
  } else if (assignment.groupSet) {
    groupSet = await GroupSet.findById(normalizeId(assignment.groupSet)).populate('course');
    course = groupSet?.course || null;
  }

  if (!course) {
    throw accessError('Assignment course could not be resolved', 404, 'COURSE_NOT_FOUND');
  }

  return { assignment, module: moduleDoc, groupSet, course };
}

function assertStudentEnrollment(user, course) {
  if (!isEnrolledStudent(user, course)) {
    throw accessError('Student is not enrolled in this course', 403, 'NOT_ENROLLED');
  }
}

function assertPublishedVisibility({ assignment, module }, now = new Date()) {
  if (module && module.published === false) {
    throw accessError('Module is not published', 403, 'MODULE_NOT_PUBLISHED', {
      moduleId: normalizeId(module),
    });
  }

  if (assignment.published !== true) {
    throw accessError('Assignment is not published', 404, 'ASSIGNMENT_NOT_PUBLISHED', {
      assignmentId: normalizeId(assignment),
    });
  }

  if (assignment.availableFrom) {
    const availableFrom = new Date(assignment.availableFrom);
    if (Number.isFinite(availableFrom.getTime()) && now < availableFrom) {
      throw accessError('Assignment is not available yet', 403, 'ASSIGNMENT_NOT_AVAILABLE', {
        availableFrom: availableFrom.toISOString(),
      });
    }
  }
}

async function assertCourseAllowsSubmission(course) {
  if (isArchivedCourse(course)) {
    throw accessError('Course is archived and no longer accepts submissions', 403, 'COURSE_ARCHIVED');
  }

  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await gradeLifecycleService.getLifecycle(course._id, term, year);
  if (lifecycle && gradeLifecycleService.FINALIZED_STATUSES.has(lifecycle.status)) {
    throw accessError(
      'Grades are finalized for this course term. New submissions are locked.',
      403,
      'COURSE_GRADES_FINALIZED',
      { lifecycleStatus: lifecycle.status }
    );
  }
}

const GRADED_SUBMISSION_FILTER = {
  gradeHidden: { $ne: true },
  $or: [
    { finalGrade: { $exists: true, $ne: null } },
    { grade: { $exists: true, $ne: null } },
    { autoGrade: { $exists: true, $ne: null } },
    { gradedAt: { $exists: true, $ne: null } },
  ],
};

async function studentHasGradedSubmission(userId, assignment) {
  const assignmentId = normalizeId(assignment);
  const studentObjectId = normalizeId(userId);

  const directSubmission = await Submission.findOne({
    assignment: assignmentId,
    student: studentObjectId,
    ...GRADED_SUBMISSION_FILTER,
  })
    .select('_id')
    .lean();

  if (directSubmission) {
    return true;
  }

  if (!assignment?.isGroupAssignment || !assignment.groupSet) {
    return false;
  }

  const group = await Group.findOne({
    groupSet: normalizeId(assignment.groupSet),
    members: studentObjectId,
  })
    .select('_id')
    .lean();

  if (!group) {
    return false;
  }

  const groupSubmission = await Submission.findOne({
    assignment: assignmentId,
    group: group._id,
    ...GRADED_SUBMISSION_FILTER,
  })
    .select('_id')
    .lean();

  return Boolean(groupSubmission);
}

async function assertStudentCanViewAssignment(user, assignmentOrId, options = {}) {
  const context = await loadAssignmentContext(assignmentOrId);
  const { assignment, module, course } = context;
  const preview = options.preview === true;

  if (user?.role !== 'student') {
    if (!isStaffPreviewUser(user, course)) {
      throw accessError('Not authorized to view this assignment', 403, 'ASSIGNMENT_VIEW_NOT_AUTHORIZED');
    }
    return {
      ...context,
      previewMetadata: preview
        ? {
            preview: true,
            assignmentPublished: assignment.published === true,
            modulePublished: module ? module.published !== false : true,
            availableFrom: assignment.availableFrom || null,
          }
        : null,
    };
  }

  assertStudentEnrollment(user, course);

  try {
    assertPublishedVisibility({ assignment, module }, options.now || new Date());
  } catch (visibilityError) {
    if (await studentHasGradedSubmission(user._id, assignment)) {
      return { ...context, previewMetadata: null, gradedAccess: true };
    }
    throw visibilityError;
  }

  return { ...context, previewMetadata: null };
}

async function assertStudentCanSubmitAssignment(user, assignmentOrId, options = {}) {
  const context = await assertStudentCanViewAssignment(user, assignmentOrId, {
    now: options.now,
    preview: false,
  });
  const { assignment, course } = context;
  const now = options.now || new Date();

  await assertCourseAllowsSubmission(course);

  if (assignment.dueDate && assignment.lockAfterDue !== false) {
    const dueDate = new Date(assignment.dueDate);
    if (Number.isFinite(dueDate.getTime()) && now > dueDate) {
      throw accessError('Assignment is past due', 400, 'ASSIGNMENT_PAST_DUE', {
        dueDate: dueDate.toISOString(),
      });
    }
  }

  return context;
}

module.exports = {
  assertStudentCanViewAssignment,
  assertStudentCanSubmitAssignment,
  loadAssignmentContext,
  studentHasGradedSubmission,
};
