/** Authoritative gameplay snapshot from server (quizwave:game-state). */
export type QuizWavePhase =
  | 'LOBBY'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_LOCKED'
  | 'ANSWER_REVEAL'
  | 'SCOREBOARD'
  | 'TRANSITION'
  | 'FINISHED';

export interface QuizWaveQuestionPayload {
  questionIndex: number;
  questionText: string;
  questionType: string;
  options: Array<{ text: string; isCorrect?: boolean }>;
  timeLimit: number;
}

export interface QuizWaveLeaderboardEntry {
  rank?: number;
  studentId: string;
  nickname: string;
  totalScore: number;
  streak?: number;
  correctAnswers?: number;
  answers: number;
  rankDelta?: number;
  lastEarnedPoints?: number;
  averageResponseTimeMs?: number;
}

export interface QuizWaveGameSummary {
  leaderboard: QuizWaveLeaderboardEntry[];
  mvpBadges?: Record<string, { nickname: string; [key: string]: unknown }>;
  participantStats?: Array<{
    nickname: string;
    totalScore: number;
    correctAnswers: number;
    accuracy: number;
    averageResponseTimeMs: number;
    biggestStreak: number;
  }>;
}

export interface QuizWaveGameSnapshot {
  sessionId: string;
  gamePin: string;
  phase: QuizWavePhase;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  currentQuestionIndex: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  totalQuestions: number;
  participantCount: number;
  answerCount: number;
  serverTime: number;
  question?: QuizWaveQuestionPayload;
  correctOptionIndices?: number[];
  answerDistribution?: Record<number, number>;
  leaderboard?: QuizWaveLeaderboardEntry[];
  gameSummary?: QuizWaveGameSummary;
}

export const isQuestionPhase = (phase: QuizWavePhase) =>
  phase === 'QUESTION_ACTIVE' || phase === 'QUESTION_LOCKED';

export const isRevealPhase = (phase: QuizWavePhase) =>
  phase === 'ANSWER_REVEAL' || phase === 'SCOREBOARD' || phase === 'TRANSITION';
