/**
 * Resolves effective grading policy: teacher → course → institution → defaults.
 * Also merges legacy course.groups / course.gradeScale when no policy document exists.
 */
const { DEFAULT_GRADING_POLICY, DEFAULT_GRADE_SCALE } = require('./policyDefaults.cjs');
const { deepMergePolicy, sanitizeGradingPolicy } = require('./policyValidation.cjs');

/**
 * @param {object} options
 * @param {object} [options.course] - Mongoose course or lean { groups, gradeScale, _id }
 * @param {object} [options.institutionPolicy] - InstitutionGradingPolicy document
 * @param {object} [options.coursePolicy] - CourseGradingPolicy document
 * @param {object} [options.teacherPolicy] - Future teacher override document
 */
function resolveGradingPolicy({
  course = null,
  institutionPolicy = null,
  coursePolicy = null,
  teacherPolicy = null,
} = {}) {
  let resolved = sanitizeGradingPolicy(null);

  if (institutionPolicy?.policy) {
    resolved = deepMergePolicy(resolved, institutionPolicy.policy);
  }
  if (coursePolicy?.policy) {
    resolved = deepMergePolicy(resolved, coursePolicy.policy);
  }
  if (teacherPolicy?.policy) {
    resolved = deepMergePolicy(resolved, teacherPolicy.policy);
  }

  const courseGroups =
    (coursePolicy?.groups && coursePolicy.groups.length > 0
      ? coursePolicy.groups
      : null) ||
    (course?.groups && course.groups.length > 0 ? course.groups : null);

  const courseGradeScale =
    (coursePolicy?.gradeScale && coursePolicy.gradeScale.length > 0
      ? coursePolicy.gradeScale
      : null) ||
    (course?.gradeScale && course.gradeScale.length > 0 ? course.gradeScale : null);

  const groups = courseGroups || resolved.groups || [];
  const gradeScale = courseGradeScale || resolved.gradeScale || DEFAULT_GRADE_SCALE;

  const attendanceGroupName =
    resolved.attendance?.groupName || DEFAULT_GRADING_POLICY.attendance.groupName;

  let effectiveGroups = groups.map((g) => ({ ...g }));

  if (resolved.attendance?.mode === 'excluded') {
    effectiveGroups = effectiveGroups.filter((g) => g.name !== attendanceGroupName);
  } else if (
    resolved.attendance?.mode === 'separate_weight' &&
    typeof resolved.attendance.weightPercent === 'number'
  ) {
    const att = effectiveGroups.find((g) => g.name === attendanceGroupName);
    if (att) {
      att.weight = resolved.attendance.weightPercent;
    }
  }

  return {
    ...resolved,
    groups: effectiveGroups,
    gradeScale,
    _meta: {
      courseId: course?._id ? String(course._id) : null,
      policyVersion:
        coursePolicy?.version ||
        institutionPolicy?.version ||
        resolved.version ||
        1,
      sources: {
        institution: !!institutionPolicy,
        course: !!coursePolicy,
        teacher: !!teacherPolicy,
        legacyCourseFields: !coursePolicy && !!course,
      },
    },
  };
}

/**
 * Build course-like object for calculateFinalGradeWithWeightedGroups from resolved policy.
 */
function courseContextFromResolvedPolicy(resolved) {
  return {
    groups: resolved.groups || [],
    gradeScale: resolved.gradeScale || DEFAULT_GRADE_SCALE,
    gradingPolicy: resolved,
  };
}

module.exports = {
  resolveGradingPolicy,
  courseContextFromResolvedPolicy,
};
