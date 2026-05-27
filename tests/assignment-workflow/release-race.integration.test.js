const gradeReleaseService = require('../../services/gradeRelease.service');

describe('grade release race hardening', () => {
  it('release idempotency keys prevent duplicate release revisions', () => {
    const submission = { _id: 's1', assignment: 'a1', releaseRevision: 0 };
    const now = new Date('2026-01-01T00:00:00.000Z');

    gradeReleaseService.applyReleaseFields(submission, {
      releaseGrade: true,
      releaseFeedback: true,
      idempotencyKey: 'release:key1',
      now,
    });
    gradeReleaseService.applyReleaseFields(submission, {
      releaseGrade: true,
      releaseFeedback: true,
      idempotencyKey: 'release:key1',
      now: new Date('2026-01-01T00:01:00.000Z'),
    });

    expect(submission.releaseRevision).toBe(1);
    expect(submission.gradesReleasedAt).toBe(now);
    expect(submission.feedbackReleasedAt).toBe(now);
  });

  it('hide after release creates a new auditable release revision', () => {
    const submission = {
      _id: 's1',
      assignment: 'a1',
      releaseRevision: 1,
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
      gradeHidden: false,
    };

    gradeReleaseService.applyReleaseFields(submission, {
      hideGrade: true,
      idempotencyKey: 'release:key2',
    });

    expect(submission.releaseRevision).toBe(2);
    expect(submission.gradesReleasedAt).toBeUndefined();
    expect(submission.gradeHidden).toBe(true);
  });
});
