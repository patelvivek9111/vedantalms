const PlannerItemState = require('../../models/plannerItemState.model');
const { resolveItemKeyFromFeedItem } = require('./plannerItemKey.service');

function isPlannerUxEnabled() {
  return process.env.PLANNER_UX_ENABLED === 'true';
}

function parseSnoozeUntil(input = {}) {
  if (input.until) {
    const dt = new Date(input.until);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const hours = parseInt(input.hours, 10);
  if (Number.isFinite(hours) && hours > 0) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  const defaultHours = parseInt(process.env.PLANNER_SNOOZE_DEFAULT_HOURS || '24', 10);
  return new Date(Date.now() + defaultHours * 60 * 60 * 1000);
}

async function getActiveStateMapForUser(userId) {
  const now = new Date();
  const rows = await PlannerItemState.find({ user: userId }).lean();
  const map = new Map();

  for (const row of rows) {
    if (row.status === 'dismissed') {
      map.set(row.itemKey, row);
      continue;
    }
    if (row.status === 'snoozed' && row.snoozeUntil && new Date(row.snoozeUntil) > now) {
      map.set(row.itemKey, row);
    } else if (row.status === 'snoozed') {
      await PlannerItemState.deleteOne({ _id: row._id });
    }
  }

  return map;
}

function isItemHiddenByState(itemKey, stateMap, now = new Date()) {
  const row = stateMap.get(itemKey);
  if (!row) return false;
  if (row.status === 'dismissed') return true;
  if (row.status === 'snoozed' && row.snoozeUntil && new Date(row.snoozeUntil) > now) {
    return true;
  }
  return false;
}

function filterItemsByUxState(items, stateMap) {
  return items.filter((item) => {
    const key = resolveItemKeyFromFeedItem(item);
    if (!key) return true;
    item.plannerItemKey = key;
    return !isItemHiddenByState(key, stateMap);
  });
}

async function dismissPlannerItem(userId, itemKey, metadata = {}) {
  return PlannerItemState.findOneAndUpdate(
    { user: userId, itemKey },
    {
      $set: {
        user: userId,
        itemKey,
        status: 'dismissed',
        snoozeUntil: null,
        surface: metadata.surface || 'derived',
        metadata,
      },
    },
    { upsert: true, new: true }
  ).lean();
}

async function snoozePlannerItem(userId, itemKey, snoozeInput = {}, metadata = {}) {
  const snoozeUntil = parseSnoozeUntil(snoozeInput);
  return PlannerItemState.findOneAndUpdate(
    { user: userId, itemKey },
    {
      $set: {
        user: userId,
        itemKey,
        status: 'snoozed',
        snoozeUntil,
        surface: metadata.surface || 'derived',
        metadata,
      },
    },
    { upsert: true, new: true }
  ).lean();
}

async function clearPlannerItemState(userId, itemKey) {
  return PlannerItemState.findOneAndDelete({ user: userId, itemKey }).lean();
}

module.exports = {
  isPlannerUxEnabled,
  parseSnoozeUntil,
  getActiveStateMapForUser,
  filterItemsByUxState,
  dismissPlannerItem,
  snoozePlannerItem,
  clearPlannerItemState,
  resolveItemKeyFromFeedItem,
};
