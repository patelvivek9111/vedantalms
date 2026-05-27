const gradeReleaseService = require('../../services/gradeRelease.service');
const { resolveAssignmentGrade, buildGradesMapForStudent } = require('../../utils/gradeCalculation');

describe('student grade visibility integration', () => {
  function visibleSubmission(submission, assignment) {
    return gradeReleaseService.resolveStudentGradeVisibility(submission, assignment).scoreVisible
      ? submission
      : null;
  }

  it('excludes hidden grades from student aggregate grade maps until release', () => {
    const studentId = 'student1';
    const hiddenAssignment = { _id: 'a-hidden', gradeReleaseMode: 'manual', totalPoints: 100, published: true };
    const visibleAssignment = { _id: 'a-visible', gradeReleaseMode: 'manual', totalPoints: 100, published: true };
    const hiddenSubmission = { _id: 's-hidden', assignment: 'a-hidden', grade: 40 };
    const visibleSubmissionDoc = {
      _id: 's-visible',
      assignment: 'a-visible',
      grade: 95,
      gradesReleasedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const allAssignments = [
      {
        ...hiddenAssignment,
        grade: resolveAssignmentGrade({ submission: visibleSubmission(hiddenSubmission, hiddenAssignment) }),
      },
      {
        ...visibleAssignment,
        grade: resolveAssignmentGrade({ submission: visibleSubmission(visibleSubmissionDoc, visibleAssignment) }),
      },
    ];
    const grades = {};
    buildGradesMapForStudent(grades, studentId, allAssignments);

    expect(grades[studentId]).toEqual({ 'a-visible': 95 });
  });

  it('keeps releasedAt timestamps stable across resubmit redaction', () => {
    const assignment = { _id: 'a1', gradeReleaseMode: 'manual' };
    const releasedAt = new Date('2026-01-01T00:00:00.000Z');
    const redacted = gradeReleaseService.redactSubmissionForStudent(
      { _id: 's1', assignment: 'a1', grade: 90, gradesReleasedAt: releasedAt },
      assignment
    );
    expect(redacted.gradeVisibility.releasedAt).toBe(releasedAt);
  });
});
