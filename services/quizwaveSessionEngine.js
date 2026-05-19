/**
 * Authoritative QuizWave game progression (Kahoot-style FSM).
 * Server owns phase, timers, and question advancement.
 */
const { QuizSession } = require('../models/quizwave.model');
const { setSession, deleteSession } = require('../utils/quizwaveSessionStore');
const { buildLeaderboard, computeGameSummary } = require('./quizScoringEngine');
const { leaderboardTopN } = require('../config/quizwaveScoringConfig');

const PHASES = Object.freeze({
  LOBBY: 'LOBBY',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  QUESTION_LOCKED: 'QUESTION_LOCKED',
  ANSWER_REVEAL: 'ANSWER_REVEAL',
  SCOREBOARD: 'SCOREBOARD',
  TRANSITION: 'TRANSITION',
  FINISHED: 'FINISHED'
});

/** Phase durations in ms (except QUESTION_ACTIVE which uses question timeLimit) */
const PHASE_MS = Object.freeze({
  QUESTION_LOCKED: 500,
  ANSWER_REVEAL: 4000,
  SCOREBOARD: 5000,
  TRANSITION: 3000
});

const DEBUG = process.env.QUIZWAVE_SYNC_DEBUG === '1';

const log = (tag, ...args) => {
  if (DEBUG) console.log(`[QuizWave ${tag}]`, ...args);
};

/** @type {Map<string, { timeouts: NodeJS.Timeout[], lock: boolean }>} */
const runtimeByPin = new Map();

const getRuntime = (gamePin) => {
  if (!runtimeByPin.has(gamePin)) {
    runtimeByPin.set(gamePin, { timeouts: [], lock: false });
  }
  return runtimeByPin.get(gamePin);
};

const clearTimers = (gamePin) => {
  const rt = runtimeByPin.get(gamePin);
  if (!rt) return;
  rt.timeouts.forEach((t) => clearTimeout(t));
  rt.timeouts = [];
};

const schedule = (gamePin, fn, delayMs) => {
  const rt = getRuntime(gamePin);
  const handle = setTimeout(() => {
    rt.timeouts = rt.timeouts.filter((t) => t !== handle);
    fn().catch((err) => console.error('[QuizWave ENGINE] scheduled task error:', err));
  }, delayMs);
  rt.timeouts.push(handle);
  return handle;
};

const computeAnswerDistribution = (session, questionIndex) => {
  const dist = {};
  session.participants.forEach((p) => {
    const answer = p.answers.find((a) => a.questionIndex === questionIndex);
    if (answer?.selectedOptions) {
      answer.selectedOptions.forEach((idx) => {
        dist[idx] = (dist[idx] || 0) + 1;
      });
    }
  });
  return dist;
};

const getCorrectIndices = (question) =>
  question.options
    .map((opt, idx) => (opt.isCorrect ? idx : -1))
    .filter((idx) => idx !== -1);

const mapQuestionForRole = (question, questionIndex, role) => {
  const includeCorrect = role === 'teacher' || role === 'broadcast';
  return {
    questionIndex,
    questionText: question.questionText,
    questionType: question.questionType,
    options: question.options.map((opt) => {
      const base = { text: opt.text };
      if (includeCorrect) {
        return { ...base, isCorrect: opt.isCorrect };
      }
      return base;
    }),
    timeLimit: question.timeLimit
  };
};

/**
 * Build authoritative snapshot for clients.
 * @param {import('mongoose').Document} session
 * @param {import('mongoose').Document} quiz
 * @param {'student'|'teacher'} role
 */
const buildSnapshot = (session, quiz, role = 'student') => {
  const phase = session.phase || PHASES.LOBBY;
  const idx = session.currentQuestionIndex;
  const totalQuestions = quiz?.questions?.length ?? 0;
  const phaseStartedAt = session.phaseStartedAt ? session.phaseStartedAt.getTime() : Date.now();
  const phaseEndsAt = session.phaseEndsAt ? session.phaseEndsAt.getTime() : phaseStartedAt;

  const snapshot = {
    sessionId: session._id.toString(),
    gamePin: session.gamePin,
    phase,
    status: session.status,
    currentQuestionIndex: idx,
    phaseStartedAt,
    phaseEndsAt,
    totalQuestions,
    participantCount: session.participants.length,
    answerCount: 0,
    serverTime: Date.now()
  };

  if (idx >= 0 && quiz?.questions?.[idx]) {
    const q = quiz.questions[idx];
    const revealPhases = [
      PHASES.ANSWER_REVEAL,
      PHASES.SCOREBOARD,
      PHASES.TRANSITION
    ];
    const showCorrect = revealPhases.includes(phase);
    snapshot.question = mapQuestionForRole(q, idx, showCorrect ? 'teacher' : 'student');
    snapshot.correctOptionIndices = showCorrect ? getCorrectIndices(q) : undefined;
    snapshot.answerDistribution = computeAnswerDistribution(session, idx);
    snapshot.answerCount = session.participants.filter((p) =>
      p.answers.some((a) => a.questionIndex === idx)
    ).length;
  }

  if ([PHASES.SCOREBOARD, PHASES.TRANSITION, PHASES.FINISHED].includes(phase)) {
    snapshot.leaderboard = buildLeaderboard(session, {
      limit: phase === PHASES.SCOREBOARD ? leaderboardTopN : null
    });
  }

  if (phase === PHASES.FINISHED) {
    const summary = computeGameSummary(session);
    snapshot.leaderboard = summary.leaderboard;
    snapshot.gameSummary = summary;
  }

  return snapshot;
};

const broadcastGameState = (io, session, quiz) => {
  const pin = session.gamePin;
  const studentSnapshot = buildSnapshot(session, quiz, 'student');
  const teacherSnapshot = buildSnapshot(session, quiz, 'teacher');

  log('SERVER PHASE', pin, studentSnapshot.phase, 'Q', studentSnapshot.currentQuestionIndex);

  io.to(`quizwave:${pin}`).emit('quizwave:game-state', studentSnapshot);
  io.to(`quizwave:teacher:${pin}`).emit('quizwave:game-state', teacherSnapshot);

  // Legacy events for gradual compatibility (students)
  if (studentSnapshot.phase === PHASES.QUESTION_ACTIVE && studentSnapshot.question) {
    io.to(`quizwave:${pin}`).emit('quizwave:question-started', studentSnapshot.question);
  }
  if (studentSnapshot.phase === PHASES.FINISHED && studentSnapshot.leaderboard) {
    io.to(`quizwave:${pin}`).emit('quizwave:quiz-ended', {
      leaderboard: studentSnapshot.leaderboard,
      gameSummary: studentSnapshot.gameSummary
    });
  }
  if (studentSnapshot.phase === PHASES.SCOREBOARD && studentSnapshot.leaderboard) {
    io.to(`quizwave:${pin}`).emit('quizwave:leaderboard-update', {
      leaderboard: studentSnapshot.leaderboard
    });
    io.to(`quizwave:teacher:${pin}`).emit('quizwave:leaderboard-update', {
      leaderboard: studentSnapshot.leaderboard
    });
  }
};

const emitToSocket = (socket, session, quiz) => {
  const teacherRoom = `quizwave:teacher:${session.gamePin}`;
  const isTeacher =
    socket.rooms &&
    (typeof socket.rooms.has === 'function'
      ? socket.rooms.has(teacherRoom)
      : Array.from(socket.rooms || []).includes(teacherRoom));
  const snapshot = buildSnapshot(session, quiz, isTeacher ? 'teacher' : 'student');
  socket.emit('quizwave:game-state', snapshot);
  log('CLIENT SYNC', session.gamePin, '-> socket', snapshot.phase);
};

const persistPhase = async (session, phase, durationMs) => {
  const now = new Date();
  session.phase = phase;
  session.phaseStartedAt = now;
  session.phaseEndsAt = new Date(now.getTime() + durationMs);

  if (phase === PHASES.QUESTION_ACTIVE) {
    session.status = 'active';
  } else if (phase === PHASES.FINISHED) {
    session.status = 'ended';
    session.endedAt = now;
  }

  await session.save();
  log('STATE TRANSITION', session.gamePin, phase, 'ends', session.phaseEndsAt.toISOString());
};

const updateSessionStore = async (session) => {
  const state = {
    sessionId: session._id.toString(),
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    phase: session.phase,
    participantCount: session.participants.length
  };
  await setSession(session.gamePin, state);
};

/**
 * Idempotent phase transition with DB guard.
 */
const transitionTo = async (io, sessionId, expectedPhase, nextPhase, durationMs) => {
  const session = await QuizSession.findById(sessionId).populate('quiz');
  if (!session?.quiz) return null;

  const pin = session.gamePin;
  const rt = getRuntime(pin);

  if (rt.lock) {
    log('STATE TRANSITION', pin, 'skipped — lock held');
    return session;
  }

  if (expectedPhase && session.phase !== expectedPhase) {
    log('STATE TRANSITION', pin, `skipped — expected ${expectedPhase}, got ${session.phase}`);
    return session;
  }

  rt.lock = true;
  try {
    clearTimers(pin);
    await persistPhase(session, nextPhase, durationMs);
    await updateSessionStore(session);
    broadcastGameState(io, session, session.quiz);
    scheduleNext(io, session._id.toString(), nextPhase, durationMs);
    return session;
  } finally {
    rt.lock = false;
  }
};

const scheduleNext = (io, sessionId, currentPhase, _durationMs) => {
  const run = async () => {
    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) return;
    if (session.phase !== currentPhase) return;

    switch (currentPhase) {
      case PHASES.QUESTION_ACTIVE:
        await transitionTo(io, sessionId, PHASES.QUESTION_ACTIVE, PHASES.QUESTION_LOCKED, PHASE_MS.QUESTION_LOCKED);
        break;
      case PHASES.QUESTION_LOCKED:
        await transitionTo(io, sessionId, PHASES.QUESTION_LOCKED, PHASES.ANSWER_REVEAL, PHASE_MS.ANSWER_REVEAL);
        break;
      case PHASES.ANSWER_REVEAL:
        await transitionTo(io, sessionId, PHASES.ANSWER_REVEAL, PHASES.SCOREBOARD, PHASE_MS.SCOREBOARD);
        break;
      case PHASES.SCOREBOARD:
        await advanceOrFinish(io, sessionId);
        break;
      case PHASES.TRANSITION:
        await startQuestion(io, sessionId, session.currentQuestionIndex + 1);
        break;
      default:
        break;
    }
  };

  QuizSession.findById(sessionId)
    .then((s) => {
      if (!s?.phaseEndsAt) return;
      const delay = Math.max(0, s.phaseEndsAt.getTime() - Date.now());
      log('TIMER', s.gamePin, currentPhase, `fire in ${delay}ms`);
      schedule(s.gamePin, run, delay);
    })
    .catch((err) => console.error('[QuizWave ENGINE] scheduleNext error:', err));
};

const advanceOrFinish = async (io, sessionId) => {
  const session = await QuizSession.findById(sessionId).populate('quiz');
  if (!session) return;

  const nextIndex = session.currentQuestionIndex + 1;
  if (nextIndex >= session.quiz.questions.length) {
    await finishGame(io, sessionId);
    return;
  }

  await transitionTo(io, sessionId, PHASES.SCOREBOARD, PHASES.TRANSITION, PHASE_MS.TRANSITION);
};

const startQuestion = async (io, sessionId, questionIndex) => {
  const session = await QuizSession.findById(sessionId).populate('quiz');
  if (!session?.quiz) return;

  const quiz = session.quiz;
  if (questionIndex >= quiz.questions.length) {
    await finishGame(io, sessionId);
    return;
  }

  const question = quiz.questions[questionIndex];
  const durationMs = (question.timeLimit || 30) * 1000;

  clearTimers(session.gamePin);
  session.currentQuestionIndex = questionIndex;
  session.status = 'active';
  await session.save();

  await transitionTo(io, sessionId, null, PHASES.QUESTION_ACTIVE, durationMs);

  // Teacher legacy event on first question only path handled via game-state
  const teacherQuestion = mapQuestionForRole(question, questionIndex, 'teacher');
  io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:question-advanced', teacherQuestion);
  if (questionIndex === 0) {
    io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:started', {
      sessionId: session._id,
      questionData: teacherQuestion,
      participantCount: session.participants.length
    });
  }
};

const finishGame = async (io, sessionId) => {
  const session = await QuizSession.findById(sessionId);
  if (!session) return;

  clearTimers(session.gamePin);
  session.currentQuestionIndex = session.currentQuestionIndex;
  await persistPhase(session, PHASES.FINISHED, 365 * 24 * 60 * 60 * 1000);
  await deleteSession(session.gamePin);
  runtimeByPin.delete(session.gamePin);

  const sessionPop = await QuizSession.findById(sessionId).populate('quiz');
  broadcastGameState(io, sessionPop, sessionPop.quiz);

  const endSummary = computeGameSummary(sessionPop);
  io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:ended', {
    leaderboard: endSummary.leaderboard,
    gameSummary: endSummary
  });
};

const startGame = async (io, sessionId) => {
  const session = await QuizSession.findById(sessionId).populate('quiz');
  if (!session) throw new Error('Session not found');
  if (session.status !== 'waiting' && session.phase !== PHASES.LOBBY) {
    throw new Error('Session is not in waiting state');
  }

  session.startedAt = new Date();
  session.currentQuestionIndex = 0;
  await session.save();

  log('STATE TRANSITION', session.gamePin, 'start game');
  await startQuestion(io, sessionId, 0);
};

const checkAllAnswered = async (io, sessionId) => {
  const session = await QuizSession.findById(sessionId);
  if (!session || session.phase !== PHASES.QUESTION_ACTIVE) return;

  const idx = session.currentQuestionIndex;
  const total = session.participants.length;
  if (total === 0) return;

  const answered = session.participants.filter((p) =>
    p.answers.some((a) => a.questionIndex === idx)
  ).length;

  if (answered >= total) {
    log('TIMER', session.gamePin, 'all answered — early lock');
    await transitionTo(io, sessionId, PHASES.QUESTION_ACTIVE, PHASES.QUESTION_LOCKED, PHASE_MS.QUESTION_LOCKED);
  }
};

const syncGameState = async (io, socket, { sessionId, gamePin }) => {
  const query = sessionId ? { _id: sessionId } : { gamePin };
  const session = await QuizSession.findOne(query).populate('quiz');
  if (!session) {
    socket.emit('quizwave:error', { message: 'Session not found' });
    return;
  }
  emitToSocket(socket, session, session.quiz);
};

const forceEnd = async (io, sessionId) => {
  clearTimers((await QuizSession.findById(sessionId))?.gamePin);
  await finishGame(io, sessionId);
};

const destroyEngine = (gamePin) => {
  clearTimers(gamePin);
  runtimeByPin.delete(gamePin);
};

/** Teacher manual skip — advances one phase or to next question from scoreboard. */
const skipToNextQuestion = async (io, sessionId) => {
  const session = await QuizSession.findById(sessionId);
  if (!session) return;
  clearTimers(session.gamePin);

  switch (session.phase) {
    case PHASES.QUESTION_ACTIVE:
      await transitionTo(io, sessionId, PHASES.QUESTION_ACTIVE, PHASES.QUESTION_LOCKED, PHASE_MS.QUESTION_LOCKED);
      break;
    case PHASES.QUESTION_LOCKED:
      await transitionTo(io, sessionId, PHASES.QUESTION_LOCKED, PHASES.ANSWER_REVEAL, PHASE_MS.ANSWER_REVEAL);
      break;
    case PHASES.ANSWER_REVEAL:
      await transitionTo(io, sessionId, PHASES.ANSWER_REVEAL, PHASES.SCOREBOARD, PHASE_MS.SCOREBOARD);
      break;
    case PHASES.SCOREBOARD:
      await advanceOrFinish(io, sessionId);
      break;
    case PHASES.TRANSITION: {
      const fresh = await QuizSession.findById(sessionId);
      if (fresh) {
        await startQuestion(io, sessionId, fresh.currentQuestionIndex + 1);
      }
      break;
    }
    default:
      break;
  }
};

module.exports = {
  PHASES,
  PHASE_MS,
  buildSnapshot,
  broadcastGameState,
  emitToSocket,
  startGame,
  transitionTo,
  checkAllAnswered,
  syncGameState,
  finishGame,
  forceEnd,
  destroyEngine,
  skipToNextQuestion,
  buildLeaderboard,
  computeAnswerDistribution
};
