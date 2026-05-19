const { QuizSession } = require('../models/quizwave.model');
const jwt = require('jsonwebtoken');
const { setSession } = require('../utils/quizwaveSessionStore');
const { allowQuizWaveEvent } = require('../utils/quizwaveSocketThrottle');
const engine = require('../services/quizwaveSessionEngine');
const { PHASES } = engine;

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
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-123');
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    socketMetrics.authErrors += 1;
    next(new Error('Authentication error: Invalid token'));
  }
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

        // Check if correct
        const correctOptions = question.options
          .map((opt, idx) => opt.isCorrect ? idx : -1)
          .filter(idx => idx !== -1)
          .sort();

        // Normalize selectedOptions to ensure it's an array and sorted
        const normalizedSelected = Array.isArray(selectedOptions) 
          ? [...selectedOptions].sort() 
          : [selectedOptions].sort();
        
        const isCorrect = JSON.stringify(normalizedSelected) === JSON.stringify(correctOptions);
        
        console.log(`✅ Answer check for question ${questionIndex} (${question.questionType}):`, {
          questionText: question.questionText.substring(0, 50) + '...',
          selectedOptions: normalizedSelected,
          correctOptions: correctOptions,
          isCorrect: isCorrect,
          questionOptions: question.options.map((opt, idx) => ({ idx, text: opt.text, isCorrect: opt.isCorrect }))
        });

        // Calculate streak (consecutive correct answers before this question)
        // Streak is the number of consecutive correct answers ending with the previous question
        let streak = 0;
        const sortedAnswers = [...participant.answers].sort((a, b) => a.questionIndex - b.questionIndex);
        // Count backwards from the most recent answer (before current question)
        for (let i = sortedAnswers.length - 1; i >= 0; i--) {
          if (sortedAnswers[i].isCorrect) {
            streak++;
          } else {
            break;
          }
        }
        // If current answer is correct, it will be part of the streak for the next question

        // Authoritative time taken (clamp client value to server phase window)
        const phaseStart = session.phaseStartedAt ? session.phaseStartedAt.getTime() : Date.now();
        const maxTime = question.timeLimit * 1000;
        const serverElapsed = Math.min(maxTime, Math.max(0, Date.now() - phaseStart));
        const authoritativeTimeTaken = Math.min(
          maxTime,
          Math.max(0, typeof timeTaken === 'number' ? timeTaken : serverElapsed)
        );

        // Calculate points using new formula
        let points = 0;
        if (isCorrect) {
          // points = 500 * (1 - (time_taken / max_time))
          points = 500 * (1 - (authoritativeTimeTaken / maxTime));
          // Ensure points is not negative
          if (points < 0) {
            points = 0;
          }
          // Add streak bonus
          points += (streak * 50);
          // Round to whole number
          points = Math.round(points);
        } else {
          // Incorrect answer = 0 points
          points = 0;
        }

        // Save answer
        participant.answers.push({
          questionIndex,
          selectedOptions,
          isCorrect,
          points,
          timeTaken: authoritativeTimeTaken,
          answeredAt: new Date()
        });

        participant.totalScore += points;
        await session.save();

        const sessionFresh = await QuizSession.findById(sessionId).populate('quiz');
        if (sessionFresh?.quiz) {
          engine.broadcastGameState(io, sessionFresh, sessionFresh.quiz);
        }

        await engine.checkAllAnswered(io, sessionId);

        // Emit answer received
        socket.emit('quizwave:answer-received', {
          isCorrect,
          points,
          correctOptions: question.options
            .map((opt, idx) => opt.isCorrect ? idx : -1)
            .filter(idx => idx !== -1)
        });

        // Notify teacher of answer submission
        const answerSubmittedData = {
          participantId: socket.userId,
          nickname: participant.nickname,
          questionIndex,
          selectedOptions,
          timeTaken
        };
        console.log(`📤 Emitting answer-submitted to teacher room: quizwave:teacher:${session.gamePin}`, answerSubmittedData);
        io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:answer-submitted', answerSubmittedData);
        
        console.log(`✅ Answer saved for ${participant.nickname}: ${isCorrect ? 'Correct' : 'Incorrect'}, ${points} points`);
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

        const leaderboard = session.participants
          .map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore,
            answers: p.answers.length
          }))
          .sort((a, b) => b.totalScore - a.totalScore);

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

