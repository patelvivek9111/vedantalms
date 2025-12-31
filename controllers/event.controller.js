const Event = require('../models/event.model');

exports.getEvents = async (req, res) => {
  try {
    const { calendar, start, end } = req.query;
    const filter = {};
    // For students, allow events from their own calendar and enrolled courses
    if (req.user.role === 'student') {
      const Course = require('../models/course.model');
      const courses = await Course.find({ students: req.user.id, published: true }).select('_id');
      const courseIds = courses.map(c => c._id.toString());
      // If a specific calendar is requested, only show that
      if (calendar) {
        // Only allow if it's their own or an enrolled course
        if ([req.user.id, ...courseIds].includes(calendar)) {
          filter.calendar = calendar;
        } else {
          // Not authorized to see this calendar
          return res.status(403).json({ success: false, message: 'Not authorized to view this calendar' });
        }
      } else {
        filter.calendar = { $in: [req.user.id, ...courseIds] };
      }
    } else {
      // Teachers/admins: filter by calendar if provided
      if (calendar) {
        filter.calendar = calendar;
      }
    }
    // Filter by date range if provided
    if (start && end) {
      filter.start = { $gte: new Date(start), $lte: new Date(end) };
    }
    const events = await Event.find(filter);
    res.json(events);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching events',
      error: err.message 
    });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const event = new Event({
      title: req.body.title,
      start: req.body.start,
      end: req.body.end,
      type: req.body.type,
      color: req.body.color,
      location: req.body.location,
      calendar: req.body.calendar,
      createdBy: req.user.id
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    // Check if user has access to this event
    if (req.user.role === 'student' && event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this event'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (err) {
    console.error('Get event by ID error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching event',
      error: err.message 
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        start: req.body.start,
        end: req.body.end,
        type: req.body.type,
        color: req.body.color,
        location: req.body.location,
        calendar: req.body.calendar
      },
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {

    
    const event = await Event.findById(req.params.id);
    if (!event) {

      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    

    
    // Check if user is authorized to delete this event
    // Allow if user is admin OR if user created the event
    if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user.id) {

      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }
    

    await Event.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting event',
      error: err.message 
    });
  }
}; 