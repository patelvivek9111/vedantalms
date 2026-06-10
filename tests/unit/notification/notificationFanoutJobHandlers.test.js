const { buildFanoutContextFromPayload } = require('../../../services/notificationFanoutJobHandlers');

describe('notificationFanoutJobHandlers', () => {
  it('builds announcement context from payload', () => {
    const build = buildFanoutContextFromPayload('announcement_created', {
      courseId: 'c1',
      courseTitle: 'Math',
      announcementTitle: 'Exam moved',
      link: '/courses/c1/announcements',
    });
    const ctx = build();
    expect(ctx.title).toBe('New Announcement');
    expect(ctx.message).toContain('Math');
    expect(ctx.message).toContain('Exam moved');
    expect(ctx.courseId).toBe('c1');
  });

  it('throws for unknown handler', () => {
    expect(() => buildFanoutContextFromPayload('unknown_handler', {})).toThrow(
      /Unknown notification fanout handler/
    );
  });

  it('builds discussion reply context with staff role', () => {
    const build = buildFanoutContextFromPayload('discussion_reply', {
      courseId: 'c1',
      threadTitle: 'Week 1',
      actorName: 'Alex',
      link: '/courses/c1/discussions/t1',
      staffRecipientIds: ['staff1'],
      replySuffix: 'reply:r1',
    });
    const studentCtx = build('student1');
    const staffCtx = build('staff1');
    expect(studentCtx.recipientRole).toBe('student');
    expect(staffCtx.recipientRole).toBe('teacher');
    expect(studentCtx.message).toContain('Alex');
  });
});
