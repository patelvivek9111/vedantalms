import { describe, it, expect } from 'vitest';
import { matchesInboxFilters } from '@/utils/inboxFilters';

const baseConversation = {
  _id: 'conv-1',
  course: 'course-1',
  subject: 'Project update',
  hasReceivedMessage: true,
  hasSentMessage: false,
  lastMessage: { body: 'Latest project note' },
  participants: [
    { _id: 'me', folder: 'inbox', starred: false, firstName: 'Me', lastName: 'User' },
    { _id: 'u2', firstName: 'Alex', lastName: 'Stone' },
  ],
};

const runFilter = (overrides: any = {}, opts: any = {}) =>
  matchesInboxFilters({
    conversation: { ...baseConversation, ...overrides },
    currentUserId: 'me',
    selectedCourse: opts.selectedCourse || 'all',
    selectedFolder: opts.selectedFolder || 'inbox',
    search: opts.search || '',
    userRole: opts.userRole || 'student',
  });

describe('matchesInboxFilters', () => {
  it('includes received, non-archived threads in Inbox', () => {
    expect(runFilter()).toBe(true);
  });

  it('excludes archived, deleted, and sent folders from Inbox', () => {
    expect(
      runFilter({
        participants: [{ _id: 'me', folder: 'archived', starred: false }],
      })
    ).toBe(false);
    expect(
      runFilter({
        participants: [{ _id: 'me', folder: 'deleted', starred: false }],
      })
    ).toBe(false);
    expect(
      runFilter({
        participants: [{ _id: 'me', folder: 'sent', starred: false }],
        hasReceivedMessage: true,
      })
    ).toBe(false);
  });

  it('includes sent threads in Sent even if current user did not create thread', () => {
    expect(
      runFilter(
        { hasSentMessage: true, hasReceivedMessage: false },
        { selectedFolder: 'sent' }
      )
    ).toBe(true);
  });

  it('excludes non-starred or deleted threads from Favorite', () => {
    expect(
      runFilter(
        { participants: [{ _id: 'me', folder: 'inbox', starred: false }] },
        { selectedFolder: 'favorite' }
      )
    ).toBe(false);
    expect(
      runFilter(
        { participants: [{ _id: 'me', folder: 'deleted', starred: true }] },
        { selectedFolder: 'favorite' }
      )
    ).toBe(false);
  });

  it('search includes inbox/sent/archived/favorite matches but excludes deleted', () => {
    expect(
      runFilter(
        { subject: 'Budget Planning', hasSentMessage: true },
        { search: 'budget', selectedFolder: 'inbox' }
      )
    ).toBe(true);

    expect(
      runFilter(
        {
          subject: 'Budget Planning',
          participants: [{ _id: 'me', folder: 'deleted', starred: true }],
          hasSentMessage: true,
        },
        { search: 'budget', selectedFolder: 'inbox' }
      )
    ).toBe(false);
  });

  it('applies course filter for non-admin users', () => {
    expect(
      runFilter({ course: 'course-2' }, { selectedCourse: 'course-1', userRole: 'student' })
    ).toBe(false);
    expect(
      runFilter({ course: 'course-2' }, { selectedCourse: 'course-1', userRole: 'admin' })
    ).toBe(true);
  });
});

