import { describe, expect, it } from 'vitest';
import { deriveDiscussionWorkflowState, sanitizeDiscussionHtml } from '@/utils/discussionWorkflowStatus';

describe('discussionWorkflowStatus', () => {
  it('derives locked and hidden grade states', () => {
    const state = deriveDiscussionWorkflowState({
      published: true,
      isGraded: true,
      locked: true,
      discussionReleaseMode: 'hidden',
      gradeHidden: true,
    });

    expect(state.locked).toBe(true);
    expect(state.released).toBe(false);
  });

  it('sanitizes unsafe discussion HTML while preserving formatting', () => {
    const sanitized = sanitizeDiscussionHtml('<p onclick="alert(1)">Hi</p><script>alert(1)</script><strong>there</strong>');
    expect(sanitized).toContain('<p>Hi</p>');
    expect(sanitized).toContain('<strong>there</strong>');
    expect(sanitized).not.toContain('script');
    expect(sanitized).not.toContain('onclick');
  });

  it('treats omitted published as published for workflow badges', () => {
    const state = deriveDiscussionWorkflowState({});
    expect(state.published).toBe(true);
    expect(state.draft).toBe(false);
  });
});
