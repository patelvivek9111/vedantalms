import { DEFAULT_GRADING_POLICY } from './policyDefaults.mjs';

export function validateGradingPolicy(policy, { partial = false } = {}) {
  const errors = [];
  if (!policy || typeof policy !== 'object') {
    return { valid: false, errors: ['Policy must be an object'] };
  }

  const missing = policy.missingAssignment || {};
  if (missing.mode && !['count_as_zero', 'exclude_until_graded'].includes(missing.mode)) {
    errors.push('missingAssignment.mode must be count_as_zero or exclude_until_graded');
  }

  const late = policy.latePenalty || {};
  if (late.enabled) {
    if (late.mode && !['fixed', 'per_day'].includes(late.mode)) {
      errors.push('latePenalty.mode must be fixed or per_day');
    }
    if (late.fixedPercent != null && (late.fixedPercent < 0 || late.fixedPercent > 100)) {
      errors.push('latePenalty.fixedPercent must be between 0 and 100');
    }
    if (late.perDayPercent != null && (late.perDayPercent < 0 || late.perDayPercent > 100)) {
      errors.push('latePenalty.perDayPercent must be between 0 and 100');
    }
    if (late.capPercent != null && (late.capPercent < 0 || late.capPercent > 100)) {
      errors.push('latePenalty.capPercent must be between 0 and 100');
    }
  }

  const drop = policy.dropLowest || {};
  if (drop.enabled && Array.isArray(drop.rules)) {
    drop.rules.forEach((rule, i) => {
      if (!rule?.groupName) errors.push(`dropLowest.rules[${i}].groupName is required`);
      if (rule?.count != null && (rule.count < 0 || rule.count > 50)) {
        errors.push(`dropLowest.rules[${i}].count must be between 0 and 50`);
      }
    });
  }

  const dropHigh = policy.dropHighest || {};
  if (dropHigh.enabled && Array.isArray(dropHigh.rules)) {
    dropHigh.rules.forEach((rule, i) => {
      if (!rule?.groupName) errors.push(`dropHighest.rules[${i}].groupName is required`);
      if (rule?.count != null && (rule.count < 0 || rule.count > 50)) {
        errors.push(`dropHighest.rules[${i}].count must be between 0 and 50`);
      }
    });
  }

  const visibility = policy.gradeVisibility || {};
  if (
    visibility.mutedAssignmentsInTotals &&
    !['exclude', 'include'].includes(visibility.mutedAssignmentsInTotals)
  ) {
    errors.push('gradeVisibility.mutedAssignmentsInTotals must be exclude or include');
  }

  const caps = policy.categoryCaps || {};
  if (caps.enabled && Array.isArray(caps.caps)) {
    caps.caps.forEach((cap, i) => {
      if (!cap?.groupName) errors.push(`categoryCaps.caps[${i}].groupName is required`);
      const max = Number(cap?.maxWeightPercent);
      if (!Number.isFinite(max) || max < 0 || max > 100) {
        errors.push(`categoryCaps.caps[${i}].maxWeightPercent must be 0–100`);
      }
    });
  }

  const attendance = policy.attendance || {};
  if (
    attendance.mode &&
    !['weighted_group', 'excluded', 'separate_weight'].includes(attendance.mode)
  ) {
    errors.push('attendance.mode must be weighted_group, excluded, or separate_weight');
  }
  if (attendance.mode === 'separate_weight') {
    const w = Number(attendance.weightPercent);
    if (!Number.isFinite(w) || w < 0 || w > 100) {
      errors.push('attendance.weightPercent must be 0–100 when mode is separate_weight');
    }
  }

  const gpa = policy.gpaScale || {};
  if (gpa.type && !['letter', 'four_point', 'percentage'].includes(gpa.type)) {
    errors.push('gpaScale.type must be letter, four_point, or percentage');
  }

  void partial;
  return { valid: errors.length === 0, errors };
}

export function deepMergePolicy(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMergePolicy(target[key], source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export function sanitizeGradingPolicy(policy) {
  const base = JSON.parse(JSON.stringify(DEFAULT_GRADING_POLICY));
  if (!policy || typeof policy !== 'object') return base;
  return deepMergePolicy(base, policy);
}
