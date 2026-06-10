/**
 * Cross-course priority ranking for planner feed items (due proximity + workload signals).
 */

const DEFAULT_FEED_CAP = parseInt(process.env.PLANNER_FEED_CAP || '50', 10);

function computePriorityScore(item, now = new Date()) {
  let score = 0;
  const nowMs = now.getTime();

  if (item.dueDate) {
    const dueMs = new Date(item.dueDate).getTime();
    if (!Number.isNaN(dueMs)) {
      const hoursUntil = (dueMs - nowMs) / (1000 * 60 * 60);
      if (hoursUntil < 0) score += 120;
      else if (hoursUntil <= 24) score += 100;
      else if (hoursUntil <= 72) score += 65;
      else score += 35;
    }
  }

  const ungraded = Number(item.ungradedCount) || 0;
  if (ungraded > 0) {
    score += Math.min(80, 15 + ungraded * 4);
  }

  if (item.subType === 'overdue') score += 140;
  else if (item.subType === 'missing') score += 130;

  if (item.type === 'enrollment_request') score += 90;
  if (item.type === 'waitlist_promotion') score += 70;
  if (item.type === 'discussion') score += 15;

  return score;
}

function rankPlannerItems(items, now = new Date()) {
  return [...items]
    .map((item) => ({
      ...item,
      priorityScore: computePriorityScore(item, now),
    }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
}

function applyFeedCap(items, cap = DEFAULT_FEED_CAP) {
  const limit = Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_FEED_CAP;
  if (items.length <= limit) {
    return { items, capped: false, totalBeforeCap: items.length };
  }
  return {
    items: items.slice(0, limit),
    capped: true,
    totalBeforeCap: items.length,
  };
}

module.exports = {
  DEFAULT_FEED_CAP,
  computePriorityScore,
  rankPlannerItems,
  applyFeedCap,
};
