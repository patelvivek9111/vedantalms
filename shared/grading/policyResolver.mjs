import { DEFAULT_GRADING_POLICY, DEFAULT_GRADE_SCALE } from './policyDefaults.mjs';
import { deepMergePolicy, sanitizeGradingPolicy } from './policyValidation.mjs';
import { buildPolicyApplication } from './policyApplication.mjs';

export function resolveGradingPolicy({
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
    (coursePolicy?.groups?.length ? coursePolicy.groups : null) ||
    (course?.groups?.length ? course.groups : null);

  const courseGradeScale =
    (coursePolicy?.gradeScale?.length ? coursePolicy.gradeScale : null) ||
    (course?.gradeScale?.length ? course.gradeScale : null);

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
    if (att) att.weight = resolved.attendance.weightPercent;
  }

  return {
    ...resolved,
    groups: effectiveGroups,
    gradeScale,
    policyApplication: buildPolicyApplication(coursePolicy),
    _meta: {
      courseId: course?._id ? String(course._id) : null,
      policyVersion: coursePolicy?.version || institutionPolicy?.version || resolved.version || 1,
      sources: {
        institution: !!institutionPolicy,
        course: !!coursePolicy,
        teacher: !!teacherPolicy,
        legacyCourseFields: !coursePolicy && !!course,
      },
    },
  };
}

export function courseContextFromResolvedPolicy(resolved) {
  return {
    groups: resolved.groups || [],
    gradeScale: resolved.gradeScale || DEFAULT_GRADE_SCALE,
    gradingPolicy: resolved,
  };
}
