/**
 * Canvas-style extra credit (Phase 5).
 * EC earned adds to course total without increasing the regular denominator.
 */

function isExtraCreditGroup(group) {
  return group?.isExtraCreditGroup === true;
}

function isExtraCreditAssignment(assignment, courseGroups = []) {
  if (assignment?.isExtraCredit === true) return true;
  if (!assignment?.group || !Array.isArray(courseGroups)) return false;
  const group = courseGroups.find((g) => g && g.name === assignment.group);
  return isExtraCreditGroup(group);
}

function extraCreditEnabled(policy) {
  if (!policy?.extraCredit || policy.extraCredit.enabled === undefined) return true;
  return policy.extraCredit.enabled === true;
}

function assignmentBonusPoints(assignment) {
  const bonus = Number(assignment?.bonusPoints);
  return Number.isFinite(bonus) && bonus > 0 ? bonus : 0;
}

/**
 * Apply EC bonus after weighted base percent is computed.
 * bonus = (extraCreditEarned / regularPossible) * 100
 */
function applyExtraCreditToCourseTotal(basePercent, extraCreditEarned, regularPossible, policy) {
  if (!extraCreditEnabled(policy)) return basePercent;
  const ecEarned = Number(extraCreditEarned);
  const regular = Number(regularPossible);
  if (!Number.isFinite(ecEarned) || ecEarned <= 0) return basePercent;
  if (!Number.isFinite(regular) || regular <= 0) return basePercent;

  let bonus = (ecEarned / regular) * 100;
  const rawCap = policy?.extraCredit?.capPercent;
  if (rawCap != null && rawCap !== '') {
    const cap = Number(rawCap);
    if (Number.isFinite(cap) && cap >= 0) {
      bonus = Math.min(bonus, cap);
    }
  }

  return basePercent + bonus;
}

module.exports = {
  isExtraCreditGroup,
  isExtraCreditAssignment,
  extraCreditEnabled,
  assignmentBonusPoints,
  applyExtraCreditToCourseTotal,
};
