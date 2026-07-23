/**
 * Student self-enrollment: catalog vs QR.
 * - catalog: unchanged — join roster immediately if there is capacity (or teacher override when full); else waitlist.
 * - qr: when there is capacity, student/admin goes to instructor pending approval (not on roster). Full course → same waitlist as catalog.
 * @param {{ userId: string, userRole: string, course: import('mongoose').Document, enrollmentSource?: 'catalog'|'qr' }} params
 * @param {object} Todo — todo model (injected to avoid circular requires in tests)
 * @param {() => Promise<void>} migrateExistingNotifications
 * @param {(course: object, Todo: object) => Promise<void>} removeEnrollmentSummaryTodos
 * @param {(course: object, Todo: object) => Promise<void>} syncEnrollmentAttentionTodo
 */
async function courseSelfEnroll(
  { userId, userRole, course, enrollmentSource = 'catalog' },
  Todo,
  migrateExistingNotifications,
  removeEnrollmentSummaryTodos,
  syncEnrollmentAttentionTodo
) {
  await migrateExistingNotifications();

  // Phase 3: institution term enrollment window
  if (course.academicTermId) {
    try {
      const { assertTermEnrollmentOpen } = require('../services/tenancy/academicStructure.service');
      const gate = await assertTermEnrollmentOpen(course.academicTermId);
      if (!gate.ok) {
        return {
          statusCode: 403,
          body: {
            success: false,
            joinState: 'term_enrollment_closed',
            message: gate.message,
          },
        };
      }
    } catch (err) {
      console.warn('Term enrollment check skipped:', err.message);
    }
  }

  // Phase 4: registration holds
  if (course.rootAccountId && (userRole === 'student' || enrollmentSource === 'catalog' || enrollmentSource === 'qr')) {
    try {
      const StudentHold = require('../models/studentHold.model');
      const hold = await StudentHold.hasBlockingHold(course.rootAccountId, userId, {
        registration: true,
      });
      if (hold) {
        return {
          statusCode: 403,
          body: {
            success: false,
            joinState: 'hold_blocks_registration',
            message: `Registration hold: ${hold.reason}`,
            holdType: hold.holdType,
          },
        };
      }
    } catch (err) {
      console.warn('Hold check skipped:', err.message);
    }
  }

  // R7: enforce CourseSection.enrollmentMethod on self-enroll
  let forceApprovalRequest = false;
  if (course.sectionId && userRole === 'student') {
    try {
      const CourseSection = require('../models/courseSection.model');
      const section = await CourseSection.findById(course.sectionId).select('enrollmentMethod').lean();
      const method = section?.enrollmentMethod || 'open';
      if (method === 'sis_only' || method === 'registrar_only') {
        return {
          statusCode: 403,
          body: {
            success: false,
            joinState: 'enrollment_method_blocked',
            message:
              method === 'sis_only'
                ? 'This section only accepts enrollments from SIS'
                : 'This section only accepts registrar-managed enrollments',
            enrollmentMethod: method,
          },
        };
      }
      if (method === 'approval') {
        forceApprovalRequest = true;
      }
    } catch (err) {
      console.warn('enrollmentMethod check skipped:', err.message);
    }
  }

  const refreshInstructorEnrollmentTodos = async (doc) => {
    await removeEnrollmentSummaryTodos(doc, Todo);
    await syncEnrollmentAttentionTodo(doc, Todo);
  };

  const sid = userId.toString();
  const fromQr = enrollmentSource === 'qr';

  if (course.students.some((id) => id.toString() === sid)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        joinState: 'already_enrolled',
        message: fromQr
          ? "You're already enrolled in this course — you don't need to scan the QR code again."
          : 'Already enrolled in this course',
      },
    };
  }

  const onWaitlist = course.waitlist.some((entry) => entry.student.toString() === sid);
  if (onWaitlist) {
    return {
      statusCode: 400,
      body: {
        success: false,
        joinState: 'already_waitlist',
        message: fromQr
          ? "You're already on the instructor's waitlist for this course. Please wait — scanning the QR code again won't change your place."
          : 'You are already on the waitlist for this course',
      },
    };
  }

  const existingPending = course.enrollmentRequests.find(
    (request) => request.student.toString() === sid && request.status === 'pending'
  );
  if (existingPending) {
    return {
      statusCode: 400,
      body: {
        success: false,
        joinState: 'already_pending',
        message: fromQr
          ? "You're already on the instructor's approval list for this course — waiting for them to approve your join request. You don't need to scan the QR code again."
          : 'Enrollment request already pending',
      },
    };
  }

  const existingWaitlistedRequest = course.enrollmentRequests.find(
    (request) => request.student.toString() === sid && request.status === 'waitlisted'
  );
  if (existingWaitlistedRequest) {
    return {
      statusCode: 400,
      body: {
        success: false,
        joinState: 'already_waitlist',
        message: fromQr
          ? "You're already on the instructor's waitlist for this course. Please wait — scanning the QR code again won't change your place."
          : 'You are already on the waitlist for this course',
      },
    };
  }

  const maxStudents = course.catalog?.maxStudents;
  const courseFull = maxStudents && course.students.length >= maxStudents;

  if (courseFull) {
    if (userRole === 'teacher') {
      course.students.push(userId);
      await course.save();
      await dualWriteActive(course, userId, userId, 'teacher');
      await refreshInstructorEnrollmentTodos(course);
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Successfully enrolled in the course! (Capacity overridden by teacher)',
          capacityOverridden: true,
        },
      };
    }
    const waitlistPosition = course.waitlist.length + 1;
    course.waitlist.push({
      student: userId,
      position: waitlistPosition,
      addedDate: new Date(),
    });
    course.enrollmentRequests.push({
      student: userId,
      status: 'waitlisted',
      requestDate: new Date(),
    });
    await course.save();
    await refreshInstructorEnrollmentTodos(course);
    return {
      statusCode: 200,
      body: {
        success: true,
        message: `Course is full. You have been added to the waitlist at position ${waitlistPosition}. Teacher approval required.`,
        waitlisted: true,
        position: waitlistPosition,
      },
    };
  }

  const needsQrApproval =
    forceApprovalRequest ||
    (enrollmentSource === 'qr' && (userRole === 'student' || userRole === 'admin'));

  if (needsQrApproval) {
    course.enrollmentRequests.push({
      student: userId,
      status: 'pending',
      requestDate: new Date(),
    });
    await course.save();
    await refreshInstructorEnrollmentTodos(course);
    return {
      statusCode: 200,
      body: {
        success: true,
        awaitingTeacherApproval: true,
        courseTitle: course.title,
        message: forceApprovalRequest
          ? `This section requires instructor approval. Your request to join "${course.title}" has been sent.`
          : `Your request to join "${course.title}" has been sent. Please wait for your instructor to approve your enrollment.`,
        enrollmentMethod: forceApprovalRequest ? 'approval' : undefined,
      },
    };
  }

  course.students.push(userId);
  await course.save();
  await dualWriteActive(course, userId, userId, 'self');
  await refreshInstructorEnrollmentTodos(course);
  return {
    statusCode: 200,
    body: { success: true, message: 'Successfully enrolled in the course!' },
  };
}

async function dualWriteActive(course, studentId, actorId, source) {
  try {
    const { activateEnrollment } = require('../services/registrar/enrollmentWrite.service');
    await activateEnrollment({
      course,
      studentId,
      actorId,
      source,
      mirrorCourseStudents: false,
    });
  } catch (err) {
    console.warn('Enrollment dual-write failed:', err.message);
  }
}

async function ensureEnrollmentQrToken(Course, courseDoc) {
  if (courseDoc.enrollmentQrToken) return courseDoc.enrollmentQrToken;
  const crypto = require('crypto');
  for (let i = 0; i < 8; i++) {
    const token = crypto.randomBytes(18).toString('base64url');
    const exists = await Course.exists({ enrollmentQrToken: token, _id: { $ne: courseDoc._id } });
    if (!exists) {
      courseDoc.enrollmentQrToken = token;
      courseDoc.markModified('enrollmentQrToken');
      await courseDoc.save();
      return token;
    }
  }
  throw new Error('Failed to allocate enrollment QR token');
}

/** Crockford-style alphabet (no 0/O, 1/I/L) for an 8-character join code. */
const ENROLLMENT_JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

async function ensureEnrollmentJoinCode(Course, courseDoc) {
  const existing = courseDoc.enrollmentJoinCode;
  if (existing && String(existing).length === 8) return String(existing).toUpperCase();
  const crypto = require('crypto');
  for (let attempt = 0; attempt < 24; attempt++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += ENROLLMENT_JOIN_CODE_ALPHABET[crypto.randomInt(0, ENROLLMENT_JOIN_CODE_ALPHABET.length)];
    }
    const exists = await Course.exists({ enrollmentJoinCode: code, _id: { $ne: courseDoc._id } });
    if (!exists) {
      courseDoc.enrollmentJoinCode = code;
      courseDoc.markModified('enrollmentJoinCode');
      await courseDoc.save();
      return code;
    }
  }
  throw new Error('Failed to allocate enrollment join code');
}

module.exports = { courseSelfEnroll, ensureEnrollmentQrToken, ensureEnrollmentJoinCode };
