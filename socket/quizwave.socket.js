const { QuizSession, QuizWave } = require('../models/quizwave.model');
const jwt = require('jsonwebtoken');

// Store active sessions in memory (for quick access)
const activeSessions = new Map(); // gamePin -> session data

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
    next(new Error('Authentication error: Invalid token'));
  }
};

// Initialize QuizWave socket handlers
const initializeQuizWaveSocket = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`✅ QuizWave: User connected - ${socket.userId}`);

    // Join a game session (student)
    socket.on('quizwave:join', async (data) => {
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
            participantCount: session.participants.length
          });
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
        activeSessions.set(gamePin, {
          sessionId: session._id.toString(),
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          participantCount: session.participants.length
        });

        // Notify all in room (including teacher)
        io.to(`quizwave:${gamePin}`).emit('quizwave:participant-joined', {
          participantCount: session.participants.length,
          nickname
        });

        socket.emit('quizwave:joined', {
          sessionId: session._id,
          gamePin,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          participantCount: session.participants.length
        });
      } catch (error) {
        console.error('Join error:', error);
        socket.emit('quizwave:error', { message: 'Error joining session' });
      }
    });

    // Start game (teacher)
    socket.on('quizwave:start', async (data) => {
      try {
        const { sessionId } = data;

        const session = await QuizSession.findById(sessionId)
          .populate('quiz')
          .populate('course');

        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Check if user is the creator
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        if (session.status !== 'waiting') {
          socket.emit('quizwave:error', { message: 'Session is not in waiting state' });
          return;
        }

        // Start session
        session.status = 'active';
        session.currentQuestionIndex = 0;
        session.startedAt = new Date();
        await session.save();

        // Update active sessions
        activeSessions.set(session.gamePin, {
          sessionId: session._id.toString(),
          status: 'active',
          currentQuestionIndex: 0,
          participantCount: session.participants.length
        });

        // Get first question
        const quiz = session.quiz;
        const questions = quiz.settings?.randomizeQuestions 
          ? [...quiz.questions].sort(() => Math.random() - 0.5)
          : quiz.questions;

        const firstQuestion = questions[0];
        
        // For students - hide correct answers
        const studentQuestionData = {
          questionIndex: 0,
          questionText: firstQuestion.questionText,
          questionType: firstQuestion.questionType,
          options: quiz.settings?.randomizeAnswers && firstQuestion.questionType === 'multiple-choice'
            ? [...firstQuestion.options].sort(() => Math.random() - 0.5).map(opt => ({ text: opt.text }))
            : firstQuestion.options.map(opt => ({ text: opt.text })),
          timeLimit: firstQuestion.timeLimit,
          points: firstQuestion.points
        };
        
        // For teacher - include correct answers
        const teacherQuestionData = {
          questionIndex: 0,
          questionText: firstQuestion.questionText,
          questionType: firstQuestion.questionType,
          options: quiz.settings?.randomizeAnswers && firstQuestion.questionType === 'multiple-choice'
            ? [...firstQuestion.options].sort(() => Math.random() - 0.5).map(opt => ({ text: opt.text, isCorrect: opt.isCorrect }))
            : firstQuestion.options.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect })),
          timeLimit: firstQuestion.timeLimit,
          points: firstQuestion.points
        };

        // Broadcast to all participants (students)
        io.to(`quizwave:${session.gamePin}`).emit('quizwave:question-started', studentQuestionData);

        // Send to teacher with correct answers
        socket.emit('quizwave:started', {
          sessionId: session._id,
          questionData: teacherQuestionData
        });
      } catch (error) {
        console.error('Start error:', error);
        socket.emit('quizwave:error', { message: 'Error starting session' });
      }
    });

    // Submit answer (student)
    socket.on('quizwave:answer', async (data) => {
      try {
        const { sessionId, questionIndex, selectedOptions, timeTaken } = data;

        if (!socket.gamePin) {
          socket.emit('quizwave:error', { message: 'Not in a session' });
          return;
        }

        const session = await QuizSession.findById(sessionId).populate('quiz');
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
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
        const questions = session.quiz.settings?.randomizeQuestions 
          ? [...session.quiz.questions].sort(() => Math.random() - 0.5)
          : session.quiz.questions;

        const question = questions[questionIndex];
        if (!question) {
          socket.emit('quizwave:error', { message: 'Question not found' });
          return;
        }

        // Check if correct
        const correctOptions = question.options
          .map((opt, idx) => opt.isCorrect ? idx : -1)
          .filter(idx => idx !== -1)
          .sort();

        const isCorrect = JSON.stringify(selectedOptions.sort()) === JSON.stringify(correctOptions);

        // Calculate points (speed-based)
        let points = 0;
        if (isCorrect) {
          const timeLimit = question.timeLimit * 1000; // Convert to milliseconds
          const timeRatio = Math.max(0, (timeLimit - timeTaken) / timeLimit);
          points = Math.floor(question.points * (0.5 + 0.5 * timeRatio)); // 50-100% of points based on speed
        }

        // Save answer
        participant.answers.push({
          questionIndex,
          selectedOptions,
          isCorrect,
          points,
          timeTaken,
          answeredAt: new Date()
        });

        participant.totalScore += points;
        await session.save();

        // Emit answer received
        socket.emit('quizwave:answer-received', {
          isCorrect,
          points,
          correctOptions: question.options
            .map((opt, idx) => opt.isCorrect ? idx : -1)
            .filter(idx => idx !== -1)
        });

        // Notify teacher of answer submission
        io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:answer-submitted', {
          participantId: socket.userId,
          nickname: participant.nickname,
          questionIndex,
          selectedOptions,
          timeTaken
        });
      } catch (error) {
        console.error('Answer error:', error);
        socket.emit('quizwave:error', { message: 'Error submitting answer' });
      }
    });

    // Next question (teacher)
    socket.on('quizwave:next-question', async (data) => {
      try {
        const { sessionId } = data;

        const session = await QuizSession.findById(sessionId).populate('quiz');
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Check authorization
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        const quiz = session.quiz;
        const questions = quiz.settings?.randomizeQuestions 
          ? [...quiz.questions].sort(() => Math.random() - 0.5)
          : quiz.questions;

        const nextIndex = session.currentQuestionIndex + 1;

        if (nextIndex >= questions.length) {
          // End quiz
          session.status = 'ended';
          session.endedAt = new Date();
          await session.save();

          activeSessions.delete(session.gamePin);

          // Get leaderboard
          const leaderboard = session.participants
            .map(p => ({
              studentId: p.student.toString(),
              nickname: p.nickname,
              totalScore: p.totalScore,
              answers: p.answers.length
            }))
            .sort((a, b) => b.totalScore - a.totalScore);

          io.to(`quizwave:${session.gamePin}`).emit('quizwave:quiz-ended', {
            leaderboard
          });

          socket.emit('quizwave:ended', { leaderboard });
          return;
        }

        // Move to next question
        session.currentQuestionIndex = nextIndex;
        await session.save();

        const nextQuestion = questions[nextIndex];
        const questionData = {
          questionIndex: nextIndex,
          questionText: nextQuestion.questionText,
          questionType: nextQuestion.questionType,
          options: quiz.settings?.randomizeAnswers && nextQuestion.questionType === 'multiple-choice'
            ? [...nextQuestion.options].sort(() => Math.random() - 0.5).map(opt => ({ text: opt.text }))
            : nextQuestion.options.map(opt => ({ text: opt.text })),
          timeLimit: nextQuestion.timeLimit,
          points: nextQuestion.points
        };

        // Update active sessions
        activeSessions.set(session.gamePin, {
          sessionId: session._id.toString(),
          status: 'active',
          currentQuestionIndex: nextIndex,
          participantCount: session.participants.length
        });

        // Broadcast to all participants
        io.to(`quizwave:${session.gamePin}`).emit('quizwave:question-started', questionData);

        socket.emit('quizwave:question-advanced', questionData);
      } catch (error) {
        console.error('Next question error:', error);
        socket.emit('quizwave:error', { message: 'Error advancing to next question' });
      }
    });

    // End session (teacher)
    socket.on('quizwave:end', async (data) => {
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

        session.status = 'ended';
        session.endedAt = new Date();
        await session.save();

        activeSessions.delete(session.gamePin);

        // Get leaderboard
        const leaderboard = session.participants
          .map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore,
            answers: p.answers.length
          }))
          .sort((a, b) => b.totalScore - a.totalScore);

        io.to(`quizwave:${session.gamePin}`).emit('quizwave:quiz-ended', {
          leaderboard
        });

        socket.emit('quizwave:ended', { leaderboard });
      } catch (error) {
        console.error('End error:', error);
        socket.emit('quizwave:error', { message: 'Error ending session' });
      }
    });

    // Teacher joins session room
    socket.on('quizwave:teacher-join', async (data) => {
      try {
        const { gamePin } = data;

        const session = await QuizSession.findOne({ gamePin });
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Check authorization
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        socket.join(`quizwave:teacher:${gamePin}`);
        socket.gamePin = gamePin;

        // Send current session state
        socket.emit('quizwave:teacher-joined', {
          sessionId: session._id,
          gamePin,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          participantCount: session.participants.length,
          participants: session.participants.map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore
          }))
        });
      } catch (error) {
        console.error('Teacher join error:', error);
        socket.emit('quizwave:error', { message: 'Error joining as teacher' });
      }
    });

    // Get leaderboard (teacher)
    socket.on('quizwave:get-leaderboard', async (data) => {
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
        console.error('Leaderboard error:', error);
        socket.emit('quizwave:error', { message: 'Error fetching leaderboard' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ QuizWave: User disconnected - ${socket.userId}`);
      // Cleanup handled by session management
    });
  });
};

module.exports = { initializeQuizWaveSocket, activeSessions };

