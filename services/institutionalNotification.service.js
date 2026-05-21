const Notification = require('../models/notification.model');

const EVENT_COPY = {
  upload_completed: { type: 'course', title: 'Upload complete', tone: 'success' },
  export_ready: { type: 'course', title: 'Export ready', tone: 'success' },
  grades_finalized: { type: 'course', title: 'Grades finalized', tone: 'info' },
  submission_locked: { type: 'assignment', title: 'Submission locked', tone: 'warning' },
  file_unsafe_blocked: { type: 'course', title: 'File blocked', tone: 'danger' },
  lifecycle_transition: { type: 'course', title: 'Grade lifecycle updated', tone: 'info' },
  course_archived: { type: 'course', title: 'Course archived', tone: 'info' },
  course_copied: { type: 'course', title: 'Course copy complete', tone: 'success' },
  maintenance_completed: { type: 'system', title: 'Maintenance completed', tone: 'info' },
};

async function notifyUser(userId, eventKey, { message, courseId, assignmentId, link, metadata } = {}) {
  const template = EVENT_COPY[eventKey] || { type: 'course', title: eventKey, tone: 'info' };
  return Notification.create({
    user: userId,
    type: template.type,
    title: template.title,
    message: message || template.title,
    course: courseId,
    assignment: assignmentId,
    link,
    metadata: { eventKey, tone: template.tone, ...metadata },
    read: false,
  });
}

module.exports = {
  notifyUser,
  EVENT_COPY,
};
