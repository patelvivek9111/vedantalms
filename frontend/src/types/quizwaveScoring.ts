/** Server-authoritative player result (quizwave:player-result / answer-received). */
export interface QuizWavePlayerResult {
  isCorrect: boolean;
  points: number;
  totalScore: number;
  streak: number;
  answerStreak: number;
  rank: number;
  previousRank: number;
  rankDelta: number;
  rankMovementText: string | null;
  feedback: string[];
  streakLabel: string | null;
  correctAnswers: number;
  averageResponseTimeMs: number;
  lastEarnedPoints: number;
  responseTimeMs?: number;
  scoreBreakdown?: {
    basePoints: number;
    speedBonus: number;
    streakMultiplier: number;
    timeFactor: number;
  };
  correctOptions?: number[];
}

export interface QuizWaveMvpBadges {
  fastestAnswer?: { nickname: string; timeMs: number };
  highestAccuracy?: { nickname: string; accuracy: number; correct: number; total: number };
  biggestClimber?: { nickname: string; climb: number };
  longestStreak?: { nickname: string; streak: number };
}

export interface QuizWaveGameSummary {
  leaderboard: QuizWaveLeaderboardEntry[];
  mvpBadges: QuizWaveMvpBadges;
  participantStats?: Array<{
    nickname: string;
    totalScore: number;
    correctAnswers: number;
    accuracy: number;
    averageResponseTimeMs: number;
    biggestStreak: number;
  }>;
}

export interface QuizWaveLeaderboardEntry {
  rank: number;
  studentId: string;
  nickname: string;
  totalScore: number;
  streak: number;
  correctAnswers: number;
  answers: number;
  rankDelta: number;
  lastEarnedPoints: number;
  averageResponseTimeMs?: number;
}
