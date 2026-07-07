import { describe, expect, it } from 'vitest';
import {
  resolveStudentDiscussionEarnedScore,
  isDiscussionGradePendingRelease,
  buildStudentVisibleGradesMap,
  resolveStudentDiscussionFeedback,
} from '../../../src/utils/discussionGradeDisplay';

describe('resolveStudentDiscussionEarnedScore', () => {
  it('uses top-level grade when released', () => {
    expect(
      resolveStudentDiscussionEarnedScore(
        { grade: 88, gradeVisibility: { scoreVisible: true } },
        'student1'
      )
    ).toBe(88);
  });

  it('hides score when gradeVisibility blocks release', () => {
    expect(
      resolveStudentDiscussionEarnedScore(
        {
          grade: 88,
          gradeVisibility: { scoreVisible: false },
          studentGrades: [{ student: 'student1', grade: 88 }],
        },
        'student1'
      )
    ).toBeNull();
  });

  it('reads single redacted studentGrades row for current student', () => {
    expect(
      resolveStudentDiscussionEarnedScore(
        {
          studentGrades: [
            {
              student: 'student1',
              grade: 72,
              gradeVisibility: { scoreVisible: true },
            },
          ],
        },
        'student1'
      )
    ).toBe(72);
  });

  it('matches student id stored as a bare ObjectId string', () => {
    const studentId = '507f1f77bcf86cd799439011';
    expect(
      resolveStudentDiscussionEarnedScore(
        {
          studentGrades: [{ student: studentId, grade: 92, gradeVisibility: { scoreVisible: true } }],
        },
        studentId
      )
    ).toBe(92);
  });

  it('detects pending release without exposing score', () => {
    expect(
      isDiscussionGradePendingRelease({
        gradeVisibility: { scoreVisible: false, mode: 'hidden' },
      })
    ).toBe(true);
    expect(
      resolveStudentDiscussionEarnedScore(
        {
          grade: 80,
          gradeVisibility: { scoreVisible: false, mode: 'hidden' },
        },
        'student1'
      )
    ).toBeNull();
  });

  it('buildStudentVisibleGradesMap omits unreleased discussion scores', () => {
    const assignments = [
      { _id: 'd1', isDiscussion: true, grade: 80, gradeVisibility: { scoreVisible: false, mode: 'hidden' } },
      { _id: 'a1', isDiscussion: false },
    ];
    const map = buildStudentVisibleGradesMap('s1', assignments, {
      s1: { a1: 50, d1: 80 },
    });
    expect(map.s1.a1).toBe(50);
    expect(map.s1.d1).toBeUndefined();
  });

  it('resolveStudentDiscussionFeedback respects feedback visibility', () => {
    expect(
      resolveStudentDiscussionFeedback(
        {
          studentGrades: [{ student: 's1', feedback: 'Nice work', gradeVisibility: { feedbackVisible: false } }],
        },
        's1'
      )
    ).toBe('');
    expect(
      resolveStudentDiscussionFeedback(
        {
          feedback: 'Great job',
          gradeVisibility: { feedbackVisible: true },
        },
        's1'
      )
    ).toBe('Great job');
  });
});
