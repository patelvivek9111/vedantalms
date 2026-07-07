export function isExtraCreditGroup(group) {
  return group?.isExtraCreditGroup === true;
}

export function isExtraCreditAssignment(assignment, courseGroups = []) {
  if (assignment?.isExtraCredit === true) return true;
  if (!assignment?.group || !Array.isArray(courseGroups)) return false;
  const group = courseGroups.find((g) => g && g.name === assignment.group);
  return isExtraCreditGroup(group);
}

export function extraCreditEnabled(policy) {
  if (!policy?.extraCredit || policy.extraCredit.enabled === undefined) return true;
  return policy.extraCredit.enabled === true;
}

export function assignmentBonusPoints(assignment) {
  const bonus = Number(assignment?.bonusPoints);
  return Number.isFinite(bonus) && bonus > 0 ? bonus : 0;
}

export function applyExtraCreditToCourseTotal(basePercent, extraCreditEarned, regularPossible, policy) {
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
