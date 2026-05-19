const assert = require('assert');
const {
  computeQuestionScore,
  getStreakBeforeAnswer,
  formatRankMovement
} = require('../../../services/quizScoringEngine');

describe('quizScoringEngine', () => {
  it('computes scores, streaks, and rank movement labels', () => {
// Fast correct with no prior streak: base 1000 + ~500 speed * 1.0 mult
const fast = computeQuestionScore({
  isCorrect: true,
  responseTimeMs: 1000,
  totalQuestionTimeMs: 30000,
  streakBefore: 0,
  questionType: 'multiple-choice'
});
assert(fast.points > 1400, `fast answer should score high, got ${fast.points}`);

// Slow correct: lower than fast
const slow = computeQuestionScore({
  isCorrect: true,
  responseTimeMs: 28000,
  totalQuestionTimeMs: 30000,
  streakBefore: 0,
  questionType: 'multiple-choice'
});
assert(slow.points < fast.points, 'slow should score less than fast');
assert(slow.points >= 1000, 'slow correct still earns base');

// Streak multiplier: 2 prior correct → +20%
const streaked = computeQuestionScore({
  isCorrect: true,
  responseTimeMs: 5000,
  totalQuestionTimeMs: 30000,
  streakBefore: 2,
  questionType: 'multiple-choice'
});
assert(streaked.streakMultiplier === 1.2);
assert(streaked.points > fast.points * 0.9, 'streak should boost score');

// Incorrect = 0
const wrong = computeQuestionScore({
  isCorrect: false,
  responseTimeMs: 1000,
  totalQuestionTimeMs: 30000,
  streakBefore: 3,
  questionType: 'multiple-choice'
});
assert.strictEqual(wrong.points, 0);

// Streak before answer helper
const participant = {
  answers: [
    { questionIndex: 0, isCorrect: true },
    { questionIndex: 1, isCorrect: true },
    { questionIndex: 2, isCorrect: false }
  ]
};
assert.strictEqual(getStreakBeforeAnswer(participant), 0);
participant.answers.pop();
assert.strictEqual(getStreakBeforeAnswer(participant), 2);

assert.strictEqual(formatRankMovement(3), 'Moved up 3 places');
assert.strictEqual(formatRankMovement(-1), 'Dropped 1 place');
  });
});
