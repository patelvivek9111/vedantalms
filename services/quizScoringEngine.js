/**
 * QuizWave scoring engine — deterministic, server-authoritative.
 * Separate from socket transport and FSM timing.
 */
const SCORING = require('../config/quizwaveScoringConfig');

const sortParticipantsByScore = (participants) =>
  [...participants].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const aj = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
    const bj = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
    return aj - bj;
  });

/** Consecutive correct answers before the current question */
const getStreakBeforeAnswer = (participant) => {
  const sorted = [...participant.answers].sort((a, b) => a.questionIndex - b.questionIndex);
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].isCorrect) streak += 1;
    else break;
  }
  return streak;
};

const computeAuthoritativeResponseTime = (session, question, clientTimeTaken) => {
  const phaseStart = session.phaseStartedAt ? session.phaseStartedAt.getTime() : Date.now();
  const maxTime = (question.timeLimit || 30) * 1000;
  const serverElapsed = Math.min(maxTime, Math.max(0, Date.now() - phaseStart));
  const clamped =
    typeof clientTimeTaken === 'number' && clientTimeTaken >= 0
      ? Math.min(maxTime, clientTimeTaken)
      : serverElapsed;
  return Math.min(maxTime, Math.max(0, clamped));
};

const checkAnswerCorrect = (question, selectedOptions) => {
  const correctOptions = question.options
    .map((opt, idx) => (opt.isCorrect ? idx : -1))
    .filter((idx) => idx !== -1)
    .sort();
  const normalized = Array.isArray(selectedOptions)
    ? [...selectedOptions].sort()
    : [selectedOptions].sort();
  return JSON.stringify(normalized) === JSON.stringify(correctOptions);
};

const getQuestionTypeMultiplier = (questionType) =>
  SCORING.questionTypeMultipliers[questionType] ?? 1;

/**
 * Kahoot-style formula:
 * speedBonus = floor(basePoints * (remainingTime / totalTime) * maxSpeedBonusMultiplier)
 * streakMultiplier = 1 + min(streakBefore, streakCap) * streakBonusPerLevel (capped)
 * finalScore = round((basePoints + speedBonus) * streakMultiplier * typeMultiplier)
 */
const computeQuestionScore = ({
  isCorrect,
  responseTimeMs,
  totalQuestionTimeMs,
  streakBefore,
  questionType
}) => {
  if (!isCorrect) {
    return {
      points: 0,
      basePoints: 0,
      speedBonus: 0,
      streakMultiplier: 1,
      timeFactor: 0
    };
  }

  const basePoints = SCORING.basePoints;
  const maxTime = Math.max(1, totalQuestionTimeMs);
  const remainingTime = Math.max(0, maxTime - responseTimeMs);
  const timeFactor = remainingTime / maxTime;
  const speedBonus = Math.floor(
    basePoints * timeFactor * SCORING.maxSpeedBonusMultiplier
  );
  const effectiveStreak = Math.min(streakBefore, SCORING.streakCap);
  const rawMultiplier = 1 + effectiveStreak * SCORING.streakBonusPerLevel;
  const streakMultiplier = Math.min(rawMultiplier, SCORING.maxStreakMultiplier);
  const typeMultiplier = getQuestionTypeMultiplier(questionType);
  const points = Math.round((basePoints + speedBonus) * streakMultiplier * typeMultiplier);

  return {
    points,
    basePoints,
    speedBonus,
    streakMultiplier,
    timeFactor
  };
};

const computeRank = (session, studentId) => {
  const ranked = sortParticipantsByScore(session.participants);
  const idx = ranked.findIndex((p) => p.student.toString() === studentId);
  return idx >= 0 ? idx + 1 : 0;
};

const getStreakLabel = (streak) => {
  const milestones = Object.keys(SCORING.streakMilestones)
    .map(Number)
    .sort((a, b) => b - a);
  for (const threshold of milestones) {
    if (streak >= threshold) return SCORING.streakMilestones[threshold];
  }
  return null;
};

const buildFeedbackLabels = ({
  isCorrect,
  streak,
  timeFactor,
  responseTimeMs,
  totalQuestionTimeMs
}) => {
  if (!isCorrect) return [];

  const labels = [];
  const streakLabel = getStreakLabel(streak);
  if (streakLabel) labels.push(`${streakLabel} 🔥`);
  else if (streak >= 2) labels.push(`${streak} Answer Streak`);

  const fastThreshold = SCORING.fastAnswerTimeFactor;
  if (timeFactor >= 1 - fastThreshold) {
    labels.push('Fast Answer ⚡');
  }

  return labels;
};

const formatRankMovement = (rankDelta) => {
  if (rankDelta > 0) {
    return `Moved up ${rankDelta} place${rankDelta === 1 ? '' : 's'}`;
  }
  if (rankDelta < 0) {
    const n = Math.abs(rankDelta);
    return `Dropped ${n} place${n === 1 ? '' : 's'}`;
  }
  return null;
};

const getAverageResponseTimeMs = (participant) => {
  const n = participant.answers?.length || 0;
  if (n === 0) return 0;
  const total = participant.totalResponseTimeMs || 0;
  return Math.round(total / n);
};

/**
 * Memo-friendly leaderboard builder (single sort per call).
 */
const buildLeaderboard = (session, { limit = null } = {}) => {
  const ranked = sortParticipantsByScore(session.participants);
  const entries = ranked.map((p, index) => ({
    rank: index + 1,
    studentId: p.student.toString(),
    nickname: p.nickname,
    totalScore: p.totalScore,
    streak: p.streak || 0,
    correctAnswers: p.correctAnswers || 0,
    answers: p.answers.length,
    rankDelta: p.lastRankDelta || 0,
    lastEarnedPoints: p.lastEarnedPoints || 0,
    averageResponseTimeMs: getAverageResponseTimeMs(p)
  }));
  if (limit && limit > 0) return entries.slice(0, limit);
  return entries;
};

const buildPlayerResult = ({
  participant,
  session,
  questionIndex,
  isCorrect,
  points,
  scoreBreakdown,
  streakBefore,
  previousRank,
  currentRank,
  rankDelta
}) => {
  const streak = participant.streak || 0;
  const feedback = buildFeedbackLabels({
    isCorrect,
    streak,
    timeFactor: scoreBreakdown.timeFactor,
    responseTimeMs: scoreBreakdown.responseTimeMs,
    totalQuestionTimeMs: scoreBreakdown.totalQuestionTimeMs
  });

  return {
    isCorrect,
    points,
    totalScore: participant.totalScore,
    streak,
    answerStreak: streak,
    rank: currentRank,
    previousRank,
    rankDelta,
    rankMovementText: formatRankMovement(rankDelta),
    feedback,
    streakLabel: getStreakLabel(streak),
    correctAnswers: participant.correctAnswers || 0,
    averageResponseTimeMs: getAverageResponseTimeMs(participant),
    lastEarnedPoints: points,
    scoreBreakdown: {
      basePoints: scoreBreakdown.basePoints,
      speedBonus: scoreBreakdown.speedBonus,
      streakMultiplier: scoreBreakdown.streakMultiplier,
      timeFactor: scoreBreakdown.timeFactor
    },
    correctOptions: scoreBreakdown.correctOptions,
    responseTimeMs: scoreBreakdown.responseTimeMs
  };
};

/**
 * Process one answer: score, update participant stats, return player result.
 */
const processAnswer = ({
  participant,
  session,
  question,
  questionIndex,
  selectedOptions,
  clientTimeTaken
}) => {
  const isCorrect = checkAnswerCorrect(question, selectedOptions);
  const streakBefore = getStreakBeforeAnswer(participant);
  const previousRank = computeRank(session, participant.student.toString());
  const totalQuestionTimeMs = (question.timeLimit || 30) * 1000;
  const responseTimeMs = computeAuthoritativeResponseTime(
    session,
    question,
    clientTimeTaken
  );

  const scoreResult = computeQuestionScore({
    isCorrect,
    responseTimeMs,
    totalQuestionTimeMs,
    streakBefore,
    questionType: question.questionType
  });

  const newStreak = isCorrect ? streakBefore + 1 : 0;
  participant.streak = newStreak;
  participant.lastEarnedPoints = scoreResult.points;
  participant.totalScore = (participant.totalScore || 0) + scoreResult.points;
  participant.totalResponseTimeMs =
    (participant.totalResponseTimeMs || 0) + responseTimeMs;
  if (isCorrect) {
    participant.correctAnswers = (participant.correctAnswers || 0) + 1;
  }

  const correctOptions = question.options
    .map((opt, idx) => (opt.isCorrect ? idx : -1))
    .filter((idx) => idx !== -1);

  participant.answers.push({
    questionIndex,
    selectedOptions,
    isCorrect,
    points: scoreResult.points,
    timeTaken: responseTimeMs,
    answeredAt: new Date()
  });

  const currentRank = computeRank(session, participant.student.toString());
  const rankDelta =
    previousRank > 0 && currentRank > 0 ? previousRank - currentRank : 0;
  participant.lastRankDelta = rankDelta;
  if (!participant.rankHistory) participant.rankHistory = [];
  participant.rankHistory.push({ questionIndex, rank: currentRank });

  const playerResult = buildPlayerResult({
    participant,
    session,
    questionIndex,
    isCorrect,
    points: scoreResult.points,
    scoreBreakdown: {
      ...scoreResult,
      responseTimeMs,
      totalQuestionTimeMs,
      correctOptions
    },
    streakBefore,
    previousRank,
    currentRank,
    rankDelta
  });

  return { playerResult, scoreResult };
};

/** End-of-game summary with MVP badges */
const computeGameSummary = (session) => {
  const leaderboard = buildLeaderboard(session);
  if (leaderboard.length === 0) {
    return { leaderboard, mvpBadges: {}, participantStats: [] };
  }

  const participants = session.participants;
  let fastest = null;
  let bestAccuracy = null;
  let biggestClimber = null;
  let longestStreak = null;

  participants.forEach((p) => {
    const studentId = p.student.toString();
    const correct = p.correctAnswers || 0;
    const total = p.answers.length;
    const accuracy = total > 0 ? correct / total : 0;

    const fastestAnswer = [...p.answers]
      .filter((a) => a.isCorrect)
      .sort((a, b) => a.timeTaken - b.timeTaken)[0];

    if (fastestAnswer) {
      if (!fastest || fastestAnswer.timeTaken < fastest.timeMs) {
        fastest = {
          studentId,
          nickname: p.nickname,
          timeMs: fastestAnswer.timeTaken,
          questionIndex: fastestAnswer.questionIndex
        };
      }
    }

    if (!bestAccuracy || accuracy > bestAccuracy.accuracy) {
      bestAccuracy = { studentId, nickname: p.nickname, accuracy, correct, total };
    }

    const totalClimb = (p.rankHistory || []).reduce((sum, h, i, arr) => {
      if (i === 0) return sum;
      const prev = arr[i - 1].rank;
      return sum + Math.max(0, prev - h.rank);
    }, 0);
    if (!biggestClimber || totalClimb > biggestClimber.climb) {
      biggestClimber = { studentId, nickname: p.nickname, climb: totalClimb };
    }

    const maxStreak = Math.max(p.streak || 0, ...p.answers.map(() => 0));
    const runStreak = getMaxConsecutiveCorrect(p);
    const streakVal = Math.max(maxStreak, runStreak);
    if (!longestStreak || streakVal > longestStreak.streak) {
      longestStreak = { studentId, nickname: p.nickname, streak: streakVal };
    }
  });

  const mvpBadges = {};
  if (fastest?.nickname) mvpBadges.fastestAnswer = fastest;
  if (bestAccuracy?.nickname) mvpBadges.highestAccuracy = bestAccuracy;
  if (biggestClimber?.climb > 0) mvpBadges.biggestClimber = biggestClimber;
  if (longestStreak?.streak > 0) mvpBadges.longestStreak = longestStreak;

  const participantStats = participants.map((p) => {
    const total = p.answers.length;
    const correct = p.correctAnswers || 0;
    return {
      studentId: p.student.toString(),
      nickname: p.nickname,
      totalScore: p.totalScore,
      correctAnswers: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      averageResponseTimeMs: getAverageResponseTimeMs(p),
      biggestStreak: Math.max(p.streak || 0, getMaxConsecutiveCorrect(p))
    };
  });

  return { leaderboard, mvpBadges, participantStats };
};

const getMaxConsecutiveCorrect = (participant) => {
  const sorted = [...participant.answers].sort((a, b) => a.questionIndex - b.questionIndex);
  let max = 0;
  let current = 0;
  sorted.forEach((a) => {
    if (a.isCorrect) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  });
  return max;
};

module.exports = {
  SCORING,
  getStreakBeforeAnswer,
  computeAuthoritativeResponseTime,
  checkAnswerCorrect,
  computeQuestionScore,
  computeRank,
  buildLeaderboard,
  buildPlayerResult,
  processAnswer,
  computeGameSummary,
  formatRankMovement,
  getStreakLabel
};
