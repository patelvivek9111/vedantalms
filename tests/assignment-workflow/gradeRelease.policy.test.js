const {
  resolveStudentGradeVisibility,
  redactSubmissionForStudent,
  applyReleaseFields,
} = require('../../services/gradeRelease.service');

describe('grade release visibility', () => {
  it('keeps manual-release grades hidden from student payloads', () => {
    const assignment = { _id: 'a1', gradeReleaseMode: 'manual' };
    const submission = { _id: 's1', assignment: 'a1', grade: 95, finalGrade: 95, feedback: 'Nice' };

    expect(resolveStudentGradeVisibility(submission, assignment)).toMatchObject({
      mode: 'hidden',
      scoreVisible: false,
    });
    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.grade).toBeUndefined();
    expect(redacted.finalGrade).toBeUndefined();
    expect(redacted.feedback).toBeUndefined();
    expect(redacted.gradeVisibility.mode).toBe('hidden');
  });

  it('supports score-only visibility when feedback is not released', () => {
    const assignment = { _id: 'a1', gradeReleaseMode: 'manual' };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      grade: 88,
      feedback: 'Private until later',
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.grade).toBe(88);
    expect(redacted.feedback).toBeUndefined();
    expect(redacted.gradeVisibility.mode).toBe('score_only');
  });

  it('supports score-and-feedback visibility after feedback release', () => {
    const assignment = { _id: 'a1', gradeReleaseMode: 'manual' };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      grade: 88,
      feedback: 'Visible',
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
      feedbackReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.grade).toBe(88);
    expect(redacted.feedback).toBe('Visible');
    expect(redacted.gradeVisibility.mode).toBe('score_and_feedback');
  });

  it('applies save-and-release fields without relying on teacherApproved', () => {
    const submission = { _id: 's1', assignment: 'a1', teacherApproved: true };
    applyReleaseFields(submission, { releaseGrade: true, releaseFeedback: true, now: new Date('2026-01-02T00:00:00.000Z') });
    expect(submission.gradesReleasedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(submission.feedbackReleasedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(submission.gradeHidden).toBe(false);
  });

  it('recognizes group member grades as scored submissions for release checks', () => {
    const assignment = { _id: 'a1', gradeReleaseMode: 'manual' };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      useIndividualGrades: true,
      memberGrades: [{ student: 'student1', grade: 91 }],
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    expect(resolveStudentGradeVisibility(submission, assignment)).toMatchObject({
      mode: 'score_only',
      scoreVisible: true,
    });
  });
});
