const { QuizSession } = require('../models/quizwave.model');
const { setSession } = require('../utils/quizwaveSessionStore');
const { allowQuizWaveEvent } = require('../utils/quizwaveSocketThrottle');
const engine = require('../services/quizwaveSessionEngine');
const { PHASES } = engine;
const { processAnswer, buildLeaderboard } = require('../services/quizScoringEngine');
const { authenticateSocket: verifySocketAuth } = require('../utils/socketAuth');

// Store active sessions through redis-backed store when available
const activeSessions = new Map(); // Legacy export for backward compatibility
const socketMetrics = {
  connected: 0,
  disconnected: 0,
  authErrors: 0,
  eventErrors: 0,
  throttled: 0
};

const emitRateLimited = (socket) => {
  socketMetrics.throttled += 1;
  socket.emit('quizwave:error', {
    message: 'Too many requests. Please slow down.',
    code: 'rate_limited'
  });
};

// Authenticate socket connection
const authenticateSocket = (socket, next) => {
  verifySocketAuth(socket, next).catch(() => {
    socketMetrics.authErrors += 1;
    next(new Error('Authentication error: Invalid token'));
  });
};

// Initialize QuizWave socket handlers
const initializeQuizWaveSocket = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    socketMetrics.connected += 1;
    console.log(`✅ QuizWave: User connected - ${socket.userId}`);

    // Join a game session (student)
    socket.on('quizwave:join', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:join')) {
        return emitRateLimited(socket);
      }
      try {
        const { gamePin, nickname } = data;

        if (!gamePin || !nickname) {
          socket.emit('quizwave:error', { message: 'Game PIN and nickname are required' });
          return;
        }

        // Find session
        const session = await QuizSession.findOne({ gamePin, status: { $in: ['waiting', 'active', 'paused'] } })
          .populate('quiz')
          .populate('course');

        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found or has ended' });
          return;
        }

        // Check if student is already in session
        const existingParticipant = session.participants.find(
          p => p.student.toString() === socket.userId
        );

        if (existingParticipant) {
          // Rejoin existing session
          socket.join(`quizwave:${gamePin}`);
          socket.gamePin = gamePin;
          socket.emit('quizwave:joined', {
            sessionId: session._id,
            gamePin,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            phase: session.phase || PHASES.LOBBY,
            participantCount: session.participants.length
          });
          await engine.emitToSocket(socket, session, session.quiz);
          return;
        }

        // Add participant
        session.participants.push({
          student: socket.userId,
          nickname: nickname.trim(),
          joinedAt: new Date()
        });

        await session.save();

        // Join socket room
        socket.join(`quizwave:${gamePin}`);
        socket.gamePin = gamePin;

        // Update active sessions map
        const sessionState = {
          sessionId: session._id.toString(),
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          participantCount: session.participants.length
        };
        activeSessions.set(gamePin, sessionState);
        await setSession(gamePin, sessionState);

        // Notify all in room (including teacher)
        io.to(`quizwave:${gamePin}`).emit('quizwave:participant-joined', {
          participantCount: session.participants.length,
          nickname,
          participants: session.participants.map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore
          }))
        });
        
        // Also notify teacher room specifically
        io.to(`quizwave:teacher:${gamePin}`).emit('quizwave:participant-joined', {
          participantCount: session.participants.length,
          nickname,
          participants: session.participants.map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore
          }))
        });

        socket.emit('quizwave:joined', {
          sessionId: session._id,
          gamePin,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          phase: session.phase || PHASES.LOBBY,
          participantCount: session.participants.length
        });
        await engine.emitToSocket(socket, session, session.quiz);
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('Join error:', error);
        socket.emit('quizwave:error', { message: 'Error joining session' });
      }
    });

    // Full authoritative snapshot (reconnect / resync)
    socket.on('quizwave:sync-game-state', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:sync-game-state')) {
        return emitRateLimited(socket);
      }
      try {
        await engine.syncGameState(io, socket, data || {});
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('Sync game state error:', error);
        socket.emit('quizwave:error', { message: 'Error syncing game state' });
      }
    });

    // Start game (teacher) — server FSM begins QUESTION_ACTIVE
    socket.on('quizwave:start', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:start')) {
        return emitRateLimited(socket);
      }
      try {
        const { sessionId } = data;

        const session = await QuizSession.findById(sessionId).populate('quiz');
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        if (session.status !== 'waiting' && session.phase !== PHASES.LOBBY) {
          socket.emit('quizwave:error', { message: 'Session is not in waiting state' });
          return;
        }

        socket.join(`quizwave:${session.gamePin}`);
        socket.join(`quizwave:teacher:${session.gamePin}`);
        socket.gamePin = session.gamePin;

        await engine.startGame(io, sessionId);

        const sessionState = {
          sessionId: session._id.toString(),
          status: 'active',
          currentQuestionIndex: 0,
          phase: PHASES.QUESTION_ACTIVE,
          participantCount: session.participants.length
        };
        activeSessions.set(session.gamePin, sessionState);
        await setSession(session.gamePin, sessionState);
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('Start error:', error);
        socket.emit('quizwave:error', { message: error.message || 'Error starting session' });
      }
    });

    // Submit answer (student)
    socket.on('quizwave:answer', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:answer')) {
        return emitRateLimited(socket);
      }
      try {
        console.log(`📝 Answer received from ${socket.userId}:`, data);
        const { sessionId, questionIndex, selectedOptions, timeTaken } = data;

        if (!sessionId) {
          console.error('Missing sessionId in answer data');
          socket.emit('quizwave:error', { message: 'Session ID is required' });
          return;
        }

        // Ensure selectedOptions is an array
        if (!selectedOptions || !Array.isArray(selectedOptions) || selectedOptions.length === 0) {
          console.error('Invalid selectedOptions:', selectedOptions);
          socket.emit('quizwave:error', { message: 'Invalid answer selection' });
          return;
        }

        if (!socket.gamePin) {
          console.error('Socket not in a session');
          socket.emit('quizwave:error', { message: 'Not in a session' });
          return;
        }

        const session = await QuizSession.findById(sessionId).populate('quiz');
        if (!session) {
          console.error('Session not found:', sessionId);
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        if (session.phase !== PHASES.QUESTION_ACTIVE) {
          socket.emit('quizwave:error', { message: 'Answers are closed for this question' });
          return;
        }

        if (questionIndex !== session.currentQuestionIndex) {
          socket.emit('quizwave:error', {
            message: `Question index mismatch (server: ${session.currentQuestionIndex})`
          });
          return;
        }

        // Find participant
        const participant = session.participants.find(
          p => p.student.toString() === socket.userId
        );

        if (!participant) {
          socket.emit('quizwave:error', { message: 'You are not a participant' });
          return;
        }

        // Check if already answered this question
        const existingAnswer = participant.answers.find(
          a => a.questionIndex === questionIndex
        );

        if (existingAnswer) {
          socket.emit('quizwave:error', { message: 'You have already answered this question' });
          return;
        }

        // Get question
        const question = session.quiz.questions[questionIndex];
        if (!question) {
          console.error('Question not found:', { questionIndex, totalQuestions: session.quiz.questions.length, sessionId });
          socket.emit('quizwave:error', { message: `Question not found at index ${questionIndex}` });
          return;
        }

        // Validate selectedOptions indices are within bounds
        const maxOptionIndex = question.options.length - 1;
        const invalidIndices = selectedOptions.filter(idx => idx < 0 || idx > maxOptionIndex);
        if (invalidIndices.length > 0) {
          console.error('Invalid option indices:', { selectedOptions, maxOptionIndex, invalidIndices });
          socket.emit('quizwave:error', { message: 'Invalid answer selection - option index out of bounds' });
          return;
        }

        const { playerResult } = processAnswer({
          participant,
          session,
          question,
          questionIndex,
          selectedOptions,
          clientTimeTaken: timeTaken
        });

        await session.save();

        const sessionFresh = await QuizSession.findById(sessionId).populate('quiz');
        if (sessionFresh?.quiz) {
          engine.broadcastGameState(io, sessionFresh, sessionFresh.quiz);
        }

        await engine.checkAllAnswered(io, sessionId);

        // Student-only personal result (teacher must not receive this card)
        socket.emit('quizwave:answer-received', playerResult);
        socket.emit('quizwave:player-result', playerResult);

        const lastAnswer = participant.answers[participant.answers.length - 1];
        const answerSubmittedData = {
          participantId: socket.userId,
          nickname: participant.nickname,
          questionIndex,
          selectedOptions,
          timeTaken: lastAnswer?.timeTaken ?? playerResult.responseTimeMs,
          answered: true
        };
        io.to(`quizwave:teacher:${session.gamePin}`).emit(
          'quizwave:answer-submitted',
          answerSubmittedData
        );

        console.log(
          `✅ Answer saved for ${participant.nickname}: ${playerResult.isCorrect ? 'Correct' : 'Incorrect'}, ${playerResult.points} points (rank ${playerResult.rank})`
        );
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('❌ Answer error:', error);
        socket.emit('quizwave:error', { message: 'Error submitting answer: ' + error.message });
      }
    });

    // Teacher skip / advance (server FSM only — no client-side index++)
    socket.on('quizwave:next-question', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:next-question')) {
        return emitRateLimited(socket);
      }
      try {
        const { sessionId } = data;
        const session = await QuizSession.findById(sessionId);
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }
        await engine.skipToNextQuestion(io, sessionId);
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('Next question error:', error);
        socket.emit('quizwave:error', { message: 'Error advancing to next question' });
      }
    });

    // End session (teacher)
    socket.on('quizwave:end', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:end')) {
        return emitRateLimited(socket);
      }
      try {
        const { sessionId } = data;
        const session = await QuizSession.findById(sessionId);
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        await engine.forceEnd(io, sessionId);
        activeSessions.delete(session.gamePin);
        console.log(`✅ Quiz session ${sessionId} ended via engine`);
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('End error:', error);
        socket.emit('quizwave:error', { message: 'Error ending session' });
      }
    });

    // Teacher joins session room
    socket.on('quizwave:teacher-join', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:teacher-join')) {
        return emitRateLimited(socket);
      }
      try {
        const { gamePin } = data;

        const session = await QuizSession.findOne({ gamePin }).populate('quiz');
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Check authorization
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        // Join both teacher room and regular room (for receiving broadcasts)
        socket.join(`quizwave:teacher:${gamePin}`);
        socket.join(`quizwave:${gamePin}`);
        socket.gamePin = gamePin;

        // Send current session state
        socket.emit('quizwave:teacher-joined', {
          sessionId: session._id,
          gamePin,
          status: session.status,
          phase: session.phase || PHASES.LOBBY,
          currentQuestionIndex: session.currentQuestionIndex,
          participantCount: session.participants.length,
          participants: session.participants.map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore
          }))
        });

        await engine.emitToSocket(socket, session, session.quiz);
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('Teacher join error:', error);
        socket.emit('quizwave:error', { message: 'Error joining as teacher' });
      }
    });

    // Get leaderboard (teacher)
    socket.on('quizwave:get-leaderboard', async (data) => {
      if (!allowQuizWaveEvent(socket, 'quizwave:get-leaderboard')) {
        return emitRateLimited(socket);
      }
      try {
        const { sessionId } = data;

        const session = await QuizSession.findById(sessionId);
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Check authorization
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        const leaderboard = buildLeaderboard(session);
        socket.emit('quizwave:leaderboard', { leaderboard });
      } catch (error) {
        socketMetrics.eventErrors += 1;
        console.error('Leaderboard error:', error);
        socket.emit('quizwave:error', { message: 'Error fetching leaderboard' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      socketMetrics.disconnected += 1;
      console.log(`❌ QuizWave: User disconnected - ${socket.userId}`);
      // Cleanup handled by session management
    });
  });
};

const getSocketMetrics = () => ({
  ...socketMetrics,
  currentlyConnected: Math.max(0, socketMetrics.connected - socketMetrics.disconnected),
  activeSessionCount: activeSessions.size
});

module.exports = { initializeQuizWaveSocket, activeSessions, getSocketMetrics };

