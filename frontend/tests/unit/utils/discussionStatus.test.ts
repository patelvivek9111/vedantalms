import { describe, expect, it } from 'vitest';
import { resolveDiscussionStatus } from '@/utils/discussionStatus';

describe('discussionStatus', () => {
  it('reports locked and hidden grade states for discussion badges', () => {
    expect(resolveDiscussionStatus({ published: true, locked: true })).toBe('locked');
    expect(resolveDiscussionStatus({
      published: true,
      isGraded: true,
      gradeHidden: true,
      discussionReleaseMode: 'hidden',
    })).toBe('graded_pending_release');
  });

  it('prefers server-provided status contracts', () => {
    expect(resolveDiscussionStatus({ discussionStatus: 'archived' })).toBe('archived');
  });
});
