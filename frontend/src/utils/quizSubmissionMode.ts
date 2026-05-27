export type QuizSubmissionMode = 'online' | 'paper_upload';

export function isPaperUploadQuiz(assignment?: {
  isGradedQuiz?: boolean;
  quizSubmissionMode?: QuizSubmissionMode | string;
} | null): boolean {
  return Boolean(
    assignment?.isGradedQuiz && assignment.quizSubmissionMode === 'paper_upload'
  );
}
