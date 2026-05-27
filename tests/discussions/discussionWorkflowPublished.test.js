const discussionWorkflow = require('../../services/discussionWorkflow.service');

describe('discussionWorkflow isDiscussionPublished (legacy compat)', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('treats missing published as published', () => {
    expect(discussionWorkflow.isDiscussionPublished({})).toBe(true);
    expect(discussionWorkflow.isDiscussionPublished({ published: undefined })).toBe(true);
    expect(discussionWorkflow.isDiscussionPublished({ published: null })).toBe(true);
  });

  it('treats explicit false as unpublished', () => {
    expect(discussionWorkflow.isDiscussionPublished({ published: false })).toBe(false);
  });

  it('keeps availableFrom enforcement when published is legacy-missing', () => {
    expect(
      discussionWorkflow.isDiscussionAvailable({ availableFrom: new Date('2026-12-01T00:00:00.000Z') }, now)
    ).toBe(false);
    expect(discussionWorkflow.isDiscussionAvailable({ availableFrom: new Date('2026-01-01T00:00:00.000Z') }, now)).toBe(
      true
    );
  });

  it('marks draft only when explicitly unpublished', () => {
    const state = discussionWorkflow.deriveDiscussionWorkflowState(
      { published: false, dueDate: null, locked: false },
      { now, finalized: false }
    );
    expect(state.draft).toBe(true);
    expect(state.published).toBe(false);

    const legacy = discussionWorkflow.deriveDiscussionWorkflowState({}, { now, finalized: false });
    expect(legacy.draft).toBe(false);
    expect(legacy.published).toBe(true);
  });
});
