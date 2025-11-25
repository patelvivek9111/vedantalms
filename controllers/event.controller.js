const mongoose = require('mongoose');
const Event = require('../models/event.model');

exports.getEvents = async (req, res) => {
  try {
    const { calendar, start, end } = req.query;
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }
    
    const filter = {};
    // For students, allow events from their own calendar and enrolled courses
    if (req.user.role === 'student') {
      const Course = require('../models/course.model');
      const courses = await Course.find({ students: userId, published: true }).select('_id');
      const courseIds = courses.map(c => c._id.toString());
      // If a specific calendar is requested, only show that
      if (calendar) {
        // Validate calendar ID format
        if (!mongoose.Types.ObjectId.isValid(calendar)) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid calendar ID format' 
          });
        }
        // Only allow if it's their own or an enrolled course
        if ([userId.toString(), ...courseIds].includes(calendar)) {
          filter.calendar = calendar;
        } else {
          // Not authorized to see this calendar
          return res.status(403).json({ success: false, message: 'Not authorized to view this calendar' });
        }
      } else {
        filter.calendar = { $in: [userId, ...courseIds] };
      }
    } else {
      // Teachers/admins: filter by calendar if provided
      if (calendar) {
        if (!mongoose.Types.ObjectId.isValid(calendar)) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid calendar ID format' 
          });
        }
        filter.calendar = calendar;
      }
    }
    // Filter by date range if provided
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
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }
    
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
    
    // Validate dates
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid start date format' 
      });
    }
    
    if (isNaN(endDate.getTime())) {
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
    
    // Validate calendar if provided
    if (calendar && !mongoose.Types.ObjectId.isValid(calendar)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid calendar ID format' 
      });
    }
    
    const event = new Event({
      title: title.trim(),
      start: startDate,
      end: endDate,
      type: type || 'event',
      color: color || '#3788d8',
      location: location || '',
      calendar: calendar || userId,
      createdBy: userId
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid event ID format' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    // Check if user has access to this event
    if (req.user.role === 'student' && event.createdBy.toString() !== userId.toString()) {
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
    const { id } = req.params;
    const { title, start, end, type, color, location, calendar } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid event ID format' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }
    
    // Check if event exists and user is authorized
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        error: 'Event not found' 
      });
    }
    
    // Check authorization (user must be creator or admin)
    if (event.createdBy.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this event'
      });
    }
    
    // Validate dates if provided
    if (start && end) {
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
    } else if (start || end) {
      // If only one date is provided, validate against existing date
      const existingStart = event.start;
      const existingEnd = event.end;
      const newStart = start ? new Date(start) : existingStart;
      const newEnd = end ? new Date(end) : existingEnd;
      
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid date format' 
        });
      }
      
      if (newEnd <= newStart) {
        return res.status(400).json({ 
          success: false,
          error: 'End date must be after start date' 
        });
      }
    }
    
    // Validate calendar if provided
    if (calendar && !mongoose.Types.ObjectId.isValid(calendar)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid calendar ID format' 
      });
    }
    
    // Build update object
    const updateData = {};
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({ 
          success: false,
          error: 'Title cannot be empty' 
        });
      }
      updateData.title = title.trim();
    }
    if (start) updateData.start = new Date(start);
    if (end) updateData.end = new Date(end);
    if (type) updateData.type = type;
    if (color) updateData.color = color;
    if (location !== undefined) updateData.location = location;
    if (calendar) updateData.calendar = calendar;
    
    const updatedEvent = await Event.findByIdAndUpdate(id, updateData, { new: true });
    res.json(updatedEvent);
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid event ID format' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    // Check if user is authorized to delete this event
    // Allow if user is admin OR if user created the event
    if (req.user.role !== 'admin' && event.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }
    
    await Event.findByIdAndDelete(id);
    
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