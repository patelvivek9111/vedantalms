const mongoose = require('mongoose');
const Event = require('../models/event.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');

function parseCalendarIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((id) => id.trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
}

async function resolveAuthorizedCalendarIds(user, calendarIds) {
  const userId = String(user._id);
  const allowed = new Set([userId]);

  if (user.role === 'student') {
    const courses = await Course.find({ students: user._id, published: true }).select('_id').lean();
    courses.forEach((course) => allowed.add(String(course._id)));
  } else if (user.role !== 'admin') {
    const courses = await Course.find({
      $or: [{ instructor: user._id }, { teachingAssistants: user._id }, { admins: user._id }],
    })
      .select('_id')
      .lean();
    courses.forEach((course) => allowed.add(String(course._id)));
  } else {
    calendarIds.forEach((id) => allowed.add(id));
  }

  if (calendarIds.length === 0) {
    return [...allowed];
  }

  return calendarIds.filter((id) => allowed.has(id));
}

async function loadCalendarEvents(calendarIds, { start, end } = {}) {
  if (!calendarIds.length) return [];

  const filter = { calendar: { $in: calendarIds } };
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      filter.start = { $gte: startDate, $lte: endDate };
    }
  }

  return Event.find(filter).lean();
}

async function loadAssignmentEventsForCourses(courseIds, { start, end } = {}) {
  if (!courseIds.length) return [];

  const modules = await Module.find({ course: { $in: courseIds } }).select('_id course').lean();
  if (!modules.length) return [];

  const moduleIds = modules.map((m) => m._id);
  const moduleCourseMap = new Map(modules.map((m) => [String(m._id), String(m.course)]));

  const assignmentFilter = {
    module: { $in: moduleIds },
    published: true,
    dueDate: { $ne: null },
  };

  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      assignmentFilter.dueDate = { $gte: startDate, $lte: endDate };
    }
  }

  const assignments = await Assignment.find(assignmentFilter)
    .select('title dueDate module pointsPossible')
    .lean();

  return assignments.map((assignment) => {
    const courseId = moduleCourseMap.get(String(assignment.module));
    const dueDate = new Date(assignment.dueDate);
    return {
      _id: `assignment:${assignment._id}`,
      title: assignment.title,
      start: dueDate,
      end: dueDate,
      type: 'Assignment',
      calendar: courseId,
      source: 'assignment',
      assignmentId: String(assignment._id),
      courseId,
      pointsPossible: assignment.pointsPossible,
    };
  });
}

async function buildCalendarFeed(user, { calendarIds = [], start, end } = {}) {
  const resolvedIds = await resolveAuthorizedCalendarIds(user, calendarIds);
  const userId = String(user._id);
  const personalIds = resolvedIds.filter((id) => id === userId);
  const courseIds = resolvedIds.filter((id) => id !== userId);

  const [personalEvents, courseEvents, assignmentEvents] = await Promise.all([
    loadCalendarEvents(personalIds, { start, end }),
    loadCalendarEvents(courseIds, { start, end }),
    loadAssignmentEventsForCourses(courseIds, { start, end }),
  ]);

  const events = [...personalEvents, ...courseEvents, ...assignmentEvents].map((event) => ({
    ...event,
    start: event.start instanceof Date ? event.start.toISOString() : event.start,
    end: event.end instanceof Date ? event.end.toISOString() : event.end,
  }));

  return {
    calendars: resolvedIds,
    events,
    counts: {
      personal: personalEvents.length,
      course: courseEvents.length,
      assignments: assignmentEvents.length,
      total: events.length,
    },
  };
}

module.exports = {
  parseCalendarIds,
  buildCalendarFeed,
};
