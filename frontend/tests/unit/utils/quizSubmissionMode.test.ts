import { describe, it, expect } from 'vitest';
import { isPaperUploadQuiz } from '@/utils/quizSubmissionMode';

describe('isPaperUploadQuiz', () => {
  it('returns true for graded quizzes in paper upload mode', () => {
    expect(isPaperUploadQuiz({ isGradedQuiz: true, quizSubmissionMode: 'paper_upload' })).toBe(true);
  });

  it('returns false for online graded quizzes', () => {
    expect(isPaperUploadQuiz({ isGradedQuiz: true, quizSubmissionMode: 'online' })).toBe(false);
  });
});
