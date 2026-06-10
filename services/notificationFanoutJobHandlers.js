const HANDLERS = Object.freeze({
  announcement_created: (ctx) => () => ({
    title: 'New Announcement',
    message: `New announcement in ${ctx.courseTitle}: "${ctx.announcementTitle}"`,
    link: ctx.link || `/courses/${ctx.courseId}/announcements`,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'medium',
  }),
  assignment_created: (ctx) => () => ({
    title: 'New Assignment',
    message: `A new assignment "${ctx.assignmentTitle}" was added to ${ctx.courseTitle}.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    assignmentId: ctx.assignmentId,
    priority: 'medium',
  }),
  assignment_updated: (ctx) => () => ({
    title: 'Assignment Updated',
    message: `"${ctx.assignmentTitle}" was updated in ${ctx.courseTitle}.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    assignmentId: ctx.assignmentId,
    priority: 'medium',
  }),
  assignment_published: (ctx) => () => ({
    title: 'Assignment Published',
    message: `"${ctx.assignmentTitle}" is now available in ${ctx.courseTitle}.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    assignmentId: ctx.assignmentId,
    priority: 'high',
  }),
  discussion_created: (ctx) => () => ({
    title: 'New Discussion',
    message: `A new discussion "${ctx.threadTitle}" was posted in ${ctx.courseTitle}.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'medium',
  }),
  discussion_reply: (ctx) => (recipientId) => {
    const staffSet = new Set((ctx.staffRecipientIds || []).map(String));
    return {
      title: 'New Discussion Reply',
      message: `${ctx.actorName} replied in "${ctx.threadTitle}".`,
      link: ctx.link,
      recipientRole: staffSet.has(String(recipientId)) ? 'teacher' : 'student',
      courseId: ctx.courseId,
      priority: 'medium',
      eventWindowSuffix: ctx.replySuffix || null,
    };
  },
  course_published: (ctx) => () => ({
    title: 'Course Published',
    message: `"${ctx.courseTitle}" is now published and available.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'high',
  }),
  course_unpublished: (ctx) => () => ({
    title: 'Course Unpublished',
    message: `"${ctx.courseTitle}" is no longer published.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'medium',
  }),
  grades_posted: (ctx) => () => ({
    title: 'Grades Posted',
    message: `Grades have been posted for "${ctx.courseTitle}".`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'high',
  }),
  grades_finalized: (ctx) => () => ({
    title: 'Grades Finalized',
    message: `Final grades are available for "${ctx.courseTitle}".`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'high',
  }),
  grades_amended: (ctx) => () => ({
    title: 'Grade Amendment',
    message: ctx.reason
      ? `Your grade for "${ctx.courseTitle}" was amended: ${ctx.reason}`
      : `Your grade for "${ctx.courseTitle}" was amended.`,
    link: ctx.link,
    recipientRole: 'student',
    courseId: ctx.courseId,
    priority: 'high',
    eventWindowSuffix: ctx.eventWindowSuffix || 'amended',
  }),
});

function buildFanoutContextFromPayload(handler, context = {}) {
  const builder = HANDLERS[handler];
  if (!builder) {
    const err = new Error(`Unknown notification fanout handler: ${handler}`);
    err.statusCode = 400;
    throw err;
  }
  return builder(context);
}

module.exports = {
  HANDLERS,
  buildFanoutContextFromPayload,
};
