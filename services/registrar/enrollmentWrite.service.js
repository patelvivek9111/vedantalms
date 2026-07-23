const Enrollment = require('../../models/enrollment.model');
const Course = require('../../models/course.model');
const StudentHold = require('../../models/studentHold.model');

/**
 * Dual-write Enrollment of record alongside Course.students[].
 * Teaching UX continues to read Course roster.
 */

async function resolveCourseContext(courseOrId) {
  const course =
    courseOrId && courseOrId._id
      ? courseOrId
      : await Course.findById(courseOrId).select(
          'rootAccountId accountId academicTermId sectionId students catalog offeringId'
        );
  if (!course) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }
  // Ensure tenant fields are present even if caller passed a lean/partial doc
  if (!course.rootAccountId) {
    const fresh = await Course.findById(course._id).select('rootAccountId accountId').lean();
    if (fresh?.rootAccountId) {
      course.rootAccountId = fresh.rootAccountId;
      course.accountId = course.accountId || fresh.accountId;
    }
  }
  return course;
}

function pushHistory(enrollment, status, by, reason = '') {
  enrollment.statusHistory = enrollment.statusHistory || [];
  enrollment.statusHistory.push({
    status,
    at: new Date(),
    by: by || null,
    reason,
  });
}

/**
 * Upsert active enrollment and ensure Course.students contains the student.
 */
async function activateEnrollment({
  course: courseInput,
  studentId,
  actorId = null,
  source = 'system',
  enrollmentType = 'regular',
  role = 'student',
  sisEnrollmentId = null,
  mirrorCourseStudents = true,
}) {
  const course = await resolveCourseContext(courseInput);
  const rootAccountId = course.rootAccountId;
  if (!rootAccountId) {
    const err = new Error('Course is missing rootAccountId');
    err.status = 400;
    throw err;
  }

  const User = require('../../models/user.model');
  const student = await User.findById(studentId).select('rootAccountId').lean();
  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  if (student.rootAccountId && String(student.rootAccountId) !== String(rootAccountId)) {
    const err = new Error('Student belongs to a different institution');
    err.status = 403;
    err.code = 'CROSS_TENANT_ENROLLMENT';
    throw err;
  }

  const hold = await StudentHold.hasBlockingHold(rootAccountId, studentId, {
    registration: true,
  });
  if (hold && source === 'self') {
    const err = new Error(`Registration hold: ${hold.reason}`);
    err.status = 403;
    err.code = 'HOLD_BLOCKS_REGISTRATION';
    err.hold = hold;
    throw err;
  }

  let enrollment = await Enrollment.findOne({
    rootAccountId,
    lmsCourseId: course._id,
    studentId,
  });

  if (!enrollment) {
    enrollment = new Enrollment({
      rootAccountId,
      accountId: course.accountId || rootAccountId,
      studentId,
      lmsCourseId: course._id,
      sectionId: course.sectionId || null,
      academicTermId: course.academicTermId || null,
      role,
      status: 'active',
      enrollmentType,
      enrolledAt: new Date(),
      enrolledBy: { userId: actorId, source },
      sisEnrollmentId: sisEnrollmentId || undefined,
      syncStatus: source === 'sis' ? 'synced' : 'local',
      lastSyncAt: source === 'sis' ? new Date() : null,
      holdBlocked: Boolean(hold),
      statusHistory: [],
    });
    pushHistory(enrollment, 'active', actorId, `Activated via ${source}`);
  } else {
    enrollment.status = 'active';
    enrollment.droppedAt = null;
    enrollment.sectionId = enrollment.sectionId || course.sectionId || null;
    enrollment.academicTermId = enrollment.academicTermId || course.academicTermId || null;
    enrollment.enrolledBy = { userId: actorId, source };
    enrollment.holdBlocked = Boolean(hold);
    if (sisEnrollmentId) enrollment.sisEnrollmentId = sisEnrollmentId;
    if (source === 'sis') {
      enrollment.syncStatus = 'synced';
      enrollment.lastSyncAt = new Date();
    }
    pushHistory(enrollment, 'active', actorId, `Reactivated via ${source}`);
  }

  await enrollment.save();

  if (mirrorCourseStudents) {
    const sid = String(studentId);
    const onRoster = (course.students || []).some((id) => String(id) === sid);
    if (!onRoster) {
      await Course.updateOne({ _id: course._id }, { $addToSet: { students: studentId } });
    }
  }

  return enrollment;
}

/**
 * Mark enrollment dropped/withdrawn and optionally remove from Course.students.
 */
async function deactivateEnrollment({
  course: courseInput,
  studentId,
  actorId = null,
  status = 'dropped',
  reason = '',
  mirrorCourseStudents = true,
}) {
  const course = await resolveCourseContext(courseInput);
  const rootAccountId = course.rootAccountId;

  let enrollment = await Enrollment.findOne({
    rootAccountId,
    lmsCourseId: course._id,
    studentId,
  });

  if (!enrollment) {
    enrollment = new Enrollment({
      rootAccountId,
      accountId: course.accountId || rootAccountId,
      studentId,
      lmsCourseId: course._id,
      sectionId: course.sectionId || null,
      academicTermId: course.academicTermId || null,
      status,
      enrolledAt: new Date(),
      droppedAt: new Date(),
      enrolledBy: { userId: actorId, source: 'system' },
      statusHistory: [],
    });
  } else {
    enrollment.status = status;
    enrollment.droppedAt = new Date();
  }
  pushHistory(enrollment, status, actorId, reason);
  await enrollment.save();

  if (mirrorCourseStudents) {
    await Course.updateOne({ _id: course._id }, { $pull: { students: studentId } });
  }

  return enrollment;
}

async function concludeEnrollment({ course, studentId, actorId = null }) {
  const doc = await resolveCourseContext(course);
  const enrollment = await Enrollment.findOne({
    rootAccountId: doc.rootAccountId,
    lmsCourseId: doc._id,
    studentId,
  });
  if (!enrollment) return null;
  enrollment.status = 'completed';
  enrollment.completedAt = new Date();
  pushHistory(enrollment, 'completed', actorId, 'Concluded');
  await enrollment.save();
  return enrollment;
}

/**
 * Sync Enrollment rows from a Course.students[] snapshot (backfill / repair).
 */
async function syncEnrollmentsFromCourseStudents(course) {
  const doc = await resolveCourseContext(course);
  const studentIds = (doc.students || []).map((id) => String(id));
  const results = [];
  for (const sid of studentIds) {
    results.push(
      await activateEnrollment({
        course: doc,
        studentId: sid,
        source: 'system',
        mirrorCourseStudents: false,
      })
    );
  }
  // Mark missing active enrollments as dropped if no longer on roster
  await Enrollment.updateMany(
    {
      rootAccountId: doc.rootAccountId,
      lmsCourseId: doc._id,
      status: 'active',
      studentId: { $nin: doc.students || [] },
    },
    {
      $set: { status: 'dropped', droppedAt: new Date() },
      $push: {
        statusHistory: {
          status: 'dropped',
          at: new Date(),
          reason: 'Removed from course roster sync',
        },
      },
    }
  );
  return results;
}

/**
 * Move a student from one LMS course/section to another. Preserves history on both rows.
 */
async function transferEnrollment({
  enrollmentId,
  toCourseId,
  actorId = null,
  reason = 'Section transfer',
  rootAccountId = null,
}) {
  const filter = { _id: enrollmentId };
  if (rootAccountId) filter.rootAccountId = rootAccountId;
  const source = await Enrollment.findOne(filter);
  if (!source) {
    const err = new Error('Enrollment not found');
    err.status = 404;
    throw err;
  }

  const fromCourse = await resolveCourseContext(source.lmsCourseId);
  const toCourse = await resolveCourseContext(toCourseId);
  const fromRoot = fromCourse.rootAccountId || source.rootAccountId;
  const toRoot = toCourse.rootAccountId || rootAccountId;
  if (!fromRoot || !toRoot || String(fromRoot) !== String(toRoot)) {
    const err = new Error('Cannot transfer across institutions');
    err.status = 403;
    throw err;
  }
  if (rootAccountId && String(fromRoot) !== String(rootAccountId)) {
    const err = new Error('Enrollment not found');
    err.status = 404;
    throw err;
  }
  if (String(fromCourse._id) === String(toCourse._id)) {
    const err = new Error('Source and target course are the same');
    err.status = 400;
    throw err;
  }

  await deactivateEnrollment({
    course: fromCourse,
    studentId: source.studentId,
    actorId,
    status: 'dropped',
    reason: `Transferred out: ${reason}`,
    mirrorCourseStudents: true,
  });

  const target = await activateEnrollment({
    course: toCourse,
    studentId: source.studentId,
    actorId,
    source: 'registrar',
    enrollmentType: source.enrollmentType || 'regular',
    role: source.role || 'student',
    mirrorCourseStudents: true,
  });

  pushHistory(target, target.status, actorId, `Transferred in from course ${fromCourse._id}: ${reason}`);
  const prior = (source.statusHistory || []).slice(-10);
  target.statusHistory = [...prior, ...(target.statusHistory || [])];
  await target.save();

  return {
    from: await Enrollment.findById(source._id).lean(),
    to: target,
  };
}

/**
 * Patch enrollment status / type / role with audit reason. Mirrors Course.students when needed.
 */
async function patchEnrollment({
  enrollmentId,
  actorId = null,
  reason = '',
  status,
  enrollmentType,
  role,
  rootAccountId = null,
}) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('reason is required');
    err.status = 400;
    throw err;
  }
  const filter = { _id: enrollmentId };
  if (rootAccountId) filter.rootAccountId = rootAccountId;
  const enrollment = await Enrollment.findOne(filter);
  if (!enrollment) {
    const err = new Error('Enrollment not found');
    err.status = 404;
    throw err;
  }

  const course = await resolveCourseContext(enrollment.lmsCourseId);
  const prevStatus = enrollment.status;

  if (status) enrollment.status = status;
  if (enrollmentType) enrollment.enrollmentType = enrollmentType;
  if (role) enrollment.role = role;

  if (status === 'dropped' || status === 'withdrawn' || status === 'inactive') {
    enrollment.droppedAt = enrollment.droppedAt || new Date();
  }
  if (status === 'completed') {
    enrollment.completedAt = enrollment.completedAt || new Date();
  }
  if (status === 'active') {
    enrollment.droppedAt = null;
  }

  pushHistory(enrollment, enrollment.status, actorId, reason);
  await enrollment.save();

  if (status && status !== prevStatus) {
    if (status === 'active') {
      await Course.updateOne({ _id: course._id }, { $addToSet: { students: enrollment.studentId } });
    } else if (['dropped', 'withdrawn', 'inactive', 'rejected'].includes(status)) {
      await Course.updateOne({ _id: course._id }, { $pull: { students: enrollment.studentId } });
    }
  }

  return enrollment;
}

/**
 * Promote the first (or specified) waitlisted student onto the roster.
 */
async function promoteFromWaitlist({ course: courseInput, studentId = null, actorId = null }) {
  const full = await Course.findById(courseInput._id || courseInput);
  if (!full) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }

  const waitlist = full.waitlist || [];
  if (!waitlist.length) {
    const err = new Error('Waitlist is empty');
    err.status = 400;
    err.code = 'WAITLIST_EMPTY';
    throw err;
  }

  let idx = 0;
  if (studentId) {
    idx = waitlist.findIndex((w) => String(w.student) === String(studentId));
    if (idx < 0) {
      const err = new Error('Student is not on the waitlist');
      err.status = 404;
      throw err;
    }
  }

  const [entry] = waitlist.splice(idx, 1);
  waitlist.forEach((w, i) => {
    w.position = i + 1;
  });
  full.waitlist = waitlist;

  const sid = entry.student;
  if (!(full.students || []).some((id) => String(id) === String(sid))) {
    full.students.push(sid);
  }

  if (Array.isArray(full.enrollmentRequests)) {
    full.enrollmentRequests.forEach((req) => {
      if (String(req.student) === String(sid) && req.status === 'waitlisted') {
        req.status = 'approved';
      }
    });
  }

  await full.save();

  const enrollment = await activateEnrollment({
    course: full,
    studentId: sid,
    actorId,
    source: 'registrar',
    mirrorCourseStudents: false,
  });
  pushHistory(enrollment, 'active', actorId, 'Promoted from waitlist');
  await enrollment.save();

  return {
    enrollment,
    studentId: sid,
    courseId: full._id,
    remainingWaitlist: full.waitlist.length,
  };
}

module.exports = {
  activateEnrollment,
  deactivateEnrollment,
  concludeEnrollment,
  syncEnrollmentsFromCourseStudents,
  transferEnrollment,
  patchEnrollment,
  promoteFromWaitlist,
};
