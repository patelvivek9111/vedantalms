/**
 * Late penalty application (deterministic, policy-driven).
 */
function applyLatePenaltyToEarned(earned, submission, assignment, latePenalty) {
  if (!latePenalty?.enabled || typeof earned !== 'number' || !Number.isFinite(earned)) {
    return earned;
  }
  if (!submission?.submittedAt) return earned;

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return earned;

  const submittedAt = new Date(submission.submittedAt);
  if (Number.isNaN(submittedAt.getTime())) return earned;

  const graceMs = (Number(latePenalty.gracePeriodHours) || 0) * 3600000;
  const deadlineWithGrace = dueDate.getTime() + graceMs;
  if (submittedAt.getTime() <= deadlineWithGrace) return earned;

  let penaltyPercent = 0;
  if (latePenalty.mode === 'fixed') {
    penaltyPercent = Number(latePenalty.fixedPercent) || 0;
  } else {
    const msLate = submittedAt.getTime() - deadlineWithGrace;
    const daysLate = Math.max(1, Math.ceil(msLate / 86400000));
    penaltyPercent = daysLate * (Number(latePenalty.perDayPercent) || 0);
  }

  const cap = Number(latePenalty.capPercent);
  if (Number.isFinite(cap) && cap >= 0) {
    penaltyPercent = Math.min(penaltyPercent, cap);
  }

  const factor = Math.max(0, 1 - penaltyPercent / 100);
  return earned * factor;
}

module.exports = { applyLatePenaltyToEarned };
