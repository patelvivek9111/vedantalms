const Event = require('../models/event.model');

exports.getEvents = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { calendar, start, end } = req.query;
    const filter = {};
    
    // Validate calendar ID if provided
    if (calendar) {
      if (!mongoose.Types.ObjectId.isValid(calendar)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid calendar ID' 
        });
      }
    }
    
    // Validate date range
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid date format' 
        });
      }
      if (endDate < startDate) {
        return res.status(400).json({ 
          success: false,
          message: 'End date must be after start date' 
        });
      }
      filter.start = { $gte: startDate, $lte: endDate };
    }
    
    // For students, allow events from their own calendar and enrolled courses
    if (req.user.role === 'student') {
      const Course = require('../models/course.model');
      const courses = await Course.find({ students: req.user._id, published: true }).select('_id');
      const courseIds = courses.map(c => c._id.toString());
      // If a specific calendar is requested, only show that
      if (calendar) {
        // Only allow if it's their own or an enrolled course
        if ([req.user._id.toString(), ...courseIds].includes(calendar)) {
          filter.calendar = calendar;
        } else {
          // Not authorized to see this calendar
          return res.status(403).json({ success: false, message: 'Not authorized to view this calendar' });
        }
      } else {
        filter.calendar = { $in: [req.user._id.toString(), ...courseIds] };
      }
    } else {
      // Teachers/admins: filter by calendar if provided
      if (calendar) {
        filter.calendar = calendar;
      }
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
    const { title, start, end, type, color, location, calendar } = req.body;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Title is required' 
      });
    }
    if (!start) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date is required' 
      });
    }
    if (!end) {
      return res.status(400).json({ 
        success: false,
        error: 'End date is required' 
      });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date format' 
      });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date' 
      });
    }
    
    const event = new Event({
      title: title.trim(),
      start: startDate,
      end: endDate,
      type: type || 'event',
      color: color || '#3788d8',
      location: location,
      calendar: calendar || req.user._id.toString(), // Default to user's calendar if not provided
      createdBy: req.user._id
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error('Create event error:', err);
    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        error: err.message 
      });
    }
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const eventId = req.params.id;
    
    // Validate ObjectId
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid event ID' 
      });
    }
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    // Check if user has access to this event
    if (req.user.role === 'student' && event.createdBy.toString() !== req.user._id.toString()) {
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
    const mongoose = require('mongoose');
    const eventId = req.params.id;
    const { title, start, end, type, color, location, calendar } = req.body;
    
    // Validate ObjectId
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid event ID' 
      });
    }
    
    // Check if event exists and user has permission
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ 
        success: false,
        error: 'Event not found' 
      });
    }
    
    // Check authorization (admin or creator)
    if (req.user.role !== 'admin' && existingEvent.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to update this event' 
      });
    }
    
    // Validate dates if provided
    const startDate = start !== undefined ? new Date(start) : existingEvent.start;
    const endDate = end !== undefined ? new Date(end) : existingEvent.end;
    
    if (start !== undefined && isNaN(startDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid start date format' 
      });
    }
    if (end !== undefined && isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid end date format' 
      });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date' 
      });
    }
    
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (start !== undefined) updateData.start = startDate;
    if (end !== undefined) updateData.end = endDate;
    if (type !== undefined) updateData.type = type;
    if (color !== undefined) updateData.color = color;
    if (location !== undefined) updateData.location = location;
    if (calendar !== undefined) updateData.calendar = calendar;
    
    const event = await Event.findByIdAndUpdate(eventId, updateData, { new: true });
    res.json(event);
  } catch (err) {
    console.error('Update event error:', err);
    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        error: err.message 
      });
    }
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const eventId = req.params.id;
    
    // Validate ObjectId
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid event ID' 
      });
    }
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    // Check if user is authorized to delete this event
    // Allow if user is admin OR if user created the event
    if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }
    
    await Event.findByIdAndDelete(eventId);
    
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