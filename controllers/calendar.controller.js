const { buildCalendarFeed, parseCalendarIds } = require('../services/calendarFeed.service');

exports.getCalendarFeed = async (req, res) => {
  try {
    const calendarIds = parseCalendarIds(req.query.calendarIds || req.query.calendars);
    const { start, end } = req.query;
    const feed = await buildCalendarFeed(req.user, { calendarIds, start, end });
    res.json({ success: true, data: feed });
  } catch (error) {
    console.error('calendar_feed_error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load calendar feed' });
  }
};
