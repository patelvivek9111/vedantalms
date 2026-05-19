/** Read-only mirror of server config — clients must not compute scores. */
export const QUIZWAVE_SCORING_CONFIG = {
  basePoints: 1000,
  maxSpeedBonusMultiplier: 0.5,
  streakBonusPerLevel: 0.1,
  maxStreakMultiplier: 1.5,
  streakCap: 5
} as const;
