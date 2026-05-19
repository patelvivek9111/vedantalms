/**
 * Sliding-window per-socket rate limit for QuizWave inbound events.
 * Env overrides (all optional):
 * - QUIZWAVE_THROTTLE_WINDOW_MS (default 1000)
 * - QUIZWAVE_THROTTLE_JOIN_MAX, QUIZWAVE_THROTTLE_ANSWER_MAX, QUIZWAVE_THROTTLE_TEACHER_ACTION_MAX,
 *   QUIZWAVE_THROTTLE_LEADERBOARD_MAX, QUIZWAVE_THROTTLE_DEFAULT_MAX
 */

const parseIntEnv = (key, fallback) => {
  const v = parseInt(process.env[key] || String(fallback), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const windowMs = () => parseIntEnv('QUIZWAVE_THROTTLE_WINDOW_MS', 1000);

const maxForEvent = (eventName) => {
  const limits = {
    'quizwave:join': parseIntEnv('QUIZWAVE_THROTTLE_JOIN_MAX', 6),
    'quizwave:teacher-join': parseIntEnv('QUIZWAVE_THROTTLE_JOIN_MAX', 6),
    'quizwave:answer': parseIntEnv('QUIZWAVE_THROTTLE_ANSWER_MAX', 10),
    'quizwave:start': parseIntEnv('QUIZWAVE_THROTTLE_TEACHER_ACTION_MAX', 20),
    'quizwave:next-question': parseIntEnv('QUIZWAVE_THROTTLE_TEACHER_ACTION_MAX', 20),
    'quizwave:end': parseIntEnv('QUIZWAVE_THROTTLE_TEACHER_ACTION_MAX', 20),
    'quizwave:get-leaderboard': parseIntEnv('QUIZWAVE_THROTTLE_LEADERBOARD_MAX', 24),
    'quizwave:sync-game-state': parseIntEnv('QUIZWAVE_THROTTLE_LEADERBOARD_MAX', 30)
  };
  return limits[eventName] ?? parseIntEnv('QUIZWAVE_THROTTLE_DEFAULT_MAX', 40);
};

/** @returns {boolean} true if the event is allowed */
const allowQuizWaveEvent = (socket, eventName) => {
  const max = maxForEvent(eventName);
  const w = windowMs();
  const now = Date.now();
  const cutoff = now - w;
  if (!socket.__qwThrottle) {
    socket.__qwThrottle = {};
  }
  let hits = socket.__qwThrottle[eventName];
  if (!hits) {
    hits = [];
    socket.__qwThrottle[eventName] = hits;
  }
  while (hits.length > 0 && hits[0] < cutoff) {
    hits.shift();
  }
  if (hits.length >= max) {
    return false;
  }
  hits.push(now);
  return true;
};

module.exports = { allowQuizWaveEvent, windowMs, maxForEvent };
