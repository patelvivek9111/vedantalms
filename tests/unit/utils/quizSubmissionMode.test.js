const {
  parseQuizSubmissionMode,
  isPaperUploadQuiz,
  applyPaperUploadQuizFields,
  validatePaperUploadQuizPayload,
} = require('../../../utils/quizSubmissionMode');

describe('utils/quizSubmissionMode', () => {
  test('parseQuizSubmissionMode defaults to online', () => {
    expect(parseQuizSubmissionMode(undefined, false)).toBe('online');
    expect(parseQuizSubmissionMode('paper_upload', false)).toBe('online');
    expect(parseQuizSubmissionMode(undefined, true)).toBe('online');
    expect(parseQuizSubmissionMode('paper_upload', true)).toBe('paper_upload');
  });

  test('isPaperUploadQuiz detects paper upload graded quizzes', () => {
    expect(isPaperUploadQuiz({ isGradedQuiz: true, quizSubmissionMode: 'paper_upload' })).toBe(true);
    expect(isPaperUploadQuiz({ isGradedQuiz: true, quizSubmissionMode: 'online' })).toBe(false);
    expect(isPaperUploadQuiz({ isGradedQuiz: false, quizSubmissionMode: 'paper_upload' })).toBe(false);
  });

  test('applyPaperUploadQuizFields enforces upload + manual grading defaults', () => {
    const payload = {
      isGradedQuiz: true,
      quizSubmissionMode: 'online',
      allowStudentUploads: false,
      isTimedQuiz: true,
      quizTimeLimit: 30,
      questions: [{ id: 'q1' }],
      gradeReleaseMode: 'immediate',
      defaultGradeHidden: false,
    };
    applyPaperUploadQuizFields(payload);
    expect(payload).toMatchObject({
      quizSubmissionMode: 'paper_upload',
      allowStudentUploads: true,
      isTimedQuiz: false,
      quizTimeLimit: null,
      questions: [],
      gradeReleaseMode: 'manual',
      defaultGradeHidden: true,
    });
  });

  test('validatePaperUploadQuizPayload requires graded quiz and points', () => {
    expect(validatePaperUploadQuizPayload({ isGradedQuiz: false, totalPoints: 10 })).toEqual([
      'Paper upload mode requires a graded quiz',
    ]);
    expect(validatePaperUploadQuizPayload({ isGradedQuiz: true, totalPoints: 0 })).toEqual([
      'Total points must be greater than zero for paper upload quizzes',
    ]);
    expect(validatePaperUploadQuizPayload({ isGradedQuiz: true, totalPoints: 25 })).toEqual([]);
  });
});
