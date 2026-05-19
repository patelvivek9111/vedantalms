/**
 * Centralized QuizWave scoring configuration (server-authoritative).
 * Future-ready for double points, team mode, power-ups.
 */
module.exports = Object.freeze({
  basePoints: 1000,
  maxSpeedBonusMultiplier: 0.5,
  streakBonusPerLevel: 0.1,
  maxStreakMultiplier: 1.5,
  streakCap: 5,
  /** Response time below this fraction of question time → "Fast Answer" */
  fastAnswerTimeFactor: 0.25,
  questionTypeMultipliers: {
    'multiple-choice': 1,
    'true-false': 1
  },
  streakMilestones: Object.freeze({
    3: 'On Fire',
    5: 'Unstoppable',
    8: 'Quiz Master'
  }),
  leaderboardTopN: 5
});
