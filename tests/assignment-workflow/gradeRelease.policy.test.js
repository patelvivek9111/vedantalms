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
      feedback: 'Visible with the grade',
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.grade).toBe(88);
    // Overall written feedback ships with the visible score (not a separate manual post).
    expect(redacted.feedback).toBe('Visible with the grade');
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

  it('hides rubricAssessment when the score is not released', () => {
    const assignment = {
      _id: 'a1',
      gradeReleaseMode: 'manual',
      rubric: {
        criteria: [{ id: 'c1', description: 'Clarity', points: 4, ratings: [] }],
        pointsPossible: 4,
      },
    };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      grade: 4,
      rubricAssessment: {
        score: 4,
        pointsPossible: 4,
        criterionAssessments: { c1: { points: 4, ratingId: null, comments: 'Clear' } },
      },
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.rubricAssessment).toBeUndefined();
    expect(redacted.assignmentRubric).toBeUndefined();
  });

  it('keeps rubric criterion comments with the graded rubric even on score-only release', () => {
    const assignment = {
      _id: 'a1',
      gradeReleaseMode: 'manual',
      rubric: {
        criteria: [{ id: 'c1', description: 'Clarity', points: 4, ratings: [] }],
        pointsPossible: 4,
      },
    };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      grade: 4,
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
      feedback: 'Overall note for the student',
      rubricAssessment: {
        score: 4,
        pointsPossible: 4,
        criterionAssessments: { c1: { points: 4, ratingId: 'r1', comments: 'Clear writing' } },
      },
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.gradeVisibility.mode).toBe('score_only');
    expect(redacted.feedback).toBe('Overall note for the student');
    expect(redacted.assignmentRubric).toEqual(assignment.rubric);
    expect(redacted.rubricAssessment.criterionAssessments.c1).toMatchObject({
      points: 4,
      ratingId: 'r1',
      comments: 'Clear writing',
    });
  });

  it('keeps rubric criterion comments when feedback is released', () => {
    const assignment = {
      _id: 'a1',
      gradeReleaseMode: 'manual',
      rubric: {
        criteria: [{ id: 'c1', description: 'Clarity', points: 4, ratings: [] }],
        pointsPossible: 4,
      },
    };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      grade: 4,
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
      feedbackReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
      rubricAssessment: {
        score: 4,
        pointsPossible: 4,
        criterionAssessments: { c1: { points: 4, ratingId: null, comments: 'Clear writing' } },
      },
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.gradeVisibility.mode).toBe('score_and_feedback');
    expect(redacted.rubricAssessment.criterionAssessments.c1.comments).toBe('Clear writing');
    expect(redacted.assignmentRubric).toEqual(assignment.rubric);
  });

  it('shows rubric criterion comments with immediate grade release (no separate feedback post)', () => {
    const assignment = {
      _id: 'a1',
      gradeReleaseMode: 'immediate',
      rubric: {
        criteria: [{ id: 'c1', description: 'Clarity', points: 4, ratings: [] }],
        pointsPossible: 4,
      },
    };
    const submission = {
      _id: 's1',
      assignment: 'a1',
      grade: 4,
      gradeHidden: false,
      rubricAssessment: {
        score: 4,
        pointsPossible: 4,
        criterionAssessments: {
          c1: { points: 3, ratingId: 'r1', comments: 'there are few mistakes' },
        },
      },
    };

    const redacted = redactSubmissionForStudent(submission, assignment);
    expect(redacted.gradeVisibility.mode).toBe('score_and_feedback');
    expect(redacted.rubricAssessment.criterionAssessments.c1.comments).toBe(
      'there are few mistakes'
    );
  });
});
