const {
  isPlannerUxEnabled,
  dismissPlannerItem,
  snoozePlannerItem,
  clearPlannerItemState,
  getActiveStateMapForUser,
} = require('../services/planner/plannerUxState.service');
const { buildPlannerFeedForUser } = require('../services/planner/plannerFeed.service');

function plannerUxDisabled(_req, res) {
  return res.status(404).json({ success: false, message: 'Not found' });
}

exports.getPlannerFeed = async (req, res) => {
  if (!isPlannerUxEnabled()) return plannerUxDisabled(req, res);

  try {
    const feed = await buildPlannerFeedForUser(req.user._id, req.user.role);
    res.json({
      success: true,
      data: feed.items,
      meta: feed.meta,
    });
  } catch (error) {
    console.error('planner_feed_error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPlannerStates = async (req, res) => {
  if (!isPlannerUxEnabled()) return plannerUxDisabled(req, res);

  try {
    const stateMap = await getActiveStateMapForUser(req.user._id);
    const data = [...stateMap.values()].map((row) => ({
      itemKey: row.itemKey,
      status: row.status,
      snoozeUntil: row.snoozeUntil,
      updatedAt: row.updatedAt,
    }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.dismissPlannerItem = async (req, res) => {
  if (!isPlannerUxEnabled()) return plannerUxDisabled(req, res);

  try {
    const itemKey = decodeURIComponent(req.params.itemKey || '').trim();
    if (!itemKey) {
      return res.status(400).json({ success: false, message: 'itemKey is required' });
    }

    const row = await dismissPlannerItem(req.user._id, itemKey);

    try {
      const {
        recordDomainEvent,
        DOMAIN_EVENT_TYPES,
        AGGREGATE_TYPES,
        AUDIENCE_SCOPES,
      } = require('../services/domainEvents');
      void recordDomainEvent({
        eventType: DOMAIN_EVENT_TYPES.PLANNER_ITEM_DISMISSED,
        aggregateType: AGGREGATE_TYPES.PLANNER_ITEM,
        aggregateId: itemKey,
        actorId: req.user._id,
        audienceScope: AUDIENCE_SCOPES.USER,
        correlationId: req.requestId,
        payload: { itemKey },
        metadata: { source: 'planner.controller.dismissPlannerItem' },
      });
    } catch (domainEventError) {
      console.error('planner_dismiss_domain_event_failed', domainEventError);
    }

    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.snoozePlannerItem = async (req, res) => {
  if (!isPlannerUxEnabled()) return plannerUxDisabled(req, res);

  try {
    const itemKey = decodeURIComponent(req.params.itemKey || '').trim();
    if (!itemKey) {
      return res.status(400).json({ success: false, message: 'itemKey is required' });
    }

    const row = await snoozePlannerItem(req.user._id, itemKey, req.body || {});

    try {
      const {
        recordDomainEvent,
        DOMAIN_EVENT_TYPES,
        AGGREGATE_TYPES,
        AUDIENCE_SCOPES,
      } = require('../services/domainEvents');
      void recordDomainEvent({
        eventType: DOMAIN_EVENT_TYPES.PLANNER_ITEM_SNOOZED,
        aggregateType: AGGREGATE_TYPES.PLANNER_ITEM,
        aggregateId: itemKey,
        actorId: req.user._id,
        audienceScope: AUDIENCE_SCOPES.USER,
        correlationId: req.requestId,
        payload: {
          itemKey,
          snoozeUntil: row?.snoozeUntil ? new Date(row.snoozeUntil).toISOString() : null,
        },
        metadata: { source: 'planner.controller.snoozePlannerItem' },
      });
    } catch (domainEventError) {
      console.error('planner_snooze_domain_event_failed', domainEventError);
    }

    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearPlannerItem = async (req, res) => {
  if (!isPlannerUxEnabled()) return plannerUxDisabled(req, res);

  try {
    const itemKey = decodeURIComponent(req.params.itemKey || '').trim();
    if (!itemKey) {
      return res.status(400).json({ success: false, message: 'itemKey is required' });
    }

    const row = await clearPlannerItemState(req.user._id, itemKey);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Planner state not found' });
    }
    res.json({ success: true, message: 'Planner state cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
