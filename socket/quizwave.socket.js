const { QuizSession, QuizWave } = require('../models/quizwave.model');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Course = require('../models/course.model');

// Store active sessions in memory (for quick access)
const activeSessions = new Map(); // gamePin -> session data

// Simple rate limiting: track event counts per socket
const rateLimitMap = new Map(); // socketId -> { eventCount, resetTime }
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_EVENTS = 100; // max events per window

// Helper function to check rate limit
const checkRateLimit = (socketId) => {
  const now = Date.now();
  const limit = rateLimitMap.get(socketId);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(socketId, { eventCount: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.eventCount >= RATE_LIMIT_MAX_EVENTS) {
    return false;
  }
  
  limit.eventCount++;
  return true;
};

// Helper function to sanitize nickname (prevent XSS)
const sanitizeNickname = (nickname) => {
  if (!nickname || typeof nickname !== 'string') {
    return null;
  }
  // Remove HTML tags and limit length
  return nickname.trim()
    .replace(/<[^>]*>/g, '')
    .substring(0, 50);
};

// Authenticate socket connection
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-123');
    
    // Validate decoded.id exists
    if (!decoded.id) {
      return next(new Error('Authentication error: Invalid token payload'));
    }
    
    socket.userId = decoded.id;
    socket.userRole = decoded.role || 'student';
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
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { gamePin, nickname } = data;

        // Validate gamePin format (should be 6-digit numeric string)
        if (!gamePin || typeof gamePin !== 'string' || !/^\d{6}$/.test(gamePin)) {
          socket.emit('quizwave:error', { message: 'Invalid game PIN format. Must be 6 digits.' });
          return;
        }

        // Validate and sanitize nickname
        const sanitizedNickname = sanitizeNickname(nickname);
        if (!sanitizedNickname || sanitizedNickname.length === 0) {
          socket.emit('quizwave:error', { message: 'Nickname is required and must be between 1-50 characters.' });
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

        // Validate course exists
        if (!session.course) {
          socket.emit('quizwave:error', { message: 'Session course not found' });
          return;
        }

        // Check if student is enrolled in course
        const course = await Course.findById(session.course._id || session.course);
        if (!course) {
          socket.emit('quizwave:error', { message: 'Course not found' });
          return;
        }

        // Verify student is enrolled (check students array)
        const isEnrolled = course.students && course.students.some(
          studentId => studentId.toString() === socket.userId.toString()
        );
        
        if (!isEnrolled && socket.userRole !== 'admin' && socket.userRole !== 'teacher') {
          socket.emit('quizwave:error', { message: 'You must be enrolled in this course to join the quiz session' });
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
          nickname: sanitizedNickname,
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
          nickname: sanitizedNickname,
          participants: session.participants.map(p => ({
            studentId: p.student.toString(),
            nickname: p.nickname,
            totalScore: p.totalScore
          }))
        });
        
        // Also notify teacher room specifically
        io.to(`quizwave:teacher:${gamePin}`).emit('quizwave:participant-joined', {
          participantCount: session.participants.length,
          nickname: sanitizedNickname,
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
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { sessionId } = data;

        // Validate sessionId is a valid ObjectId
        if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
          socket.emit('quizwave:error', { message: 'Invalid session ID format' });
          return;
        }

        const session = await QuizSession.findById(sessionId)
          .populate('quiz')
          .populate('course');

        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Validate quiz exists
        if (!session.quiz) {
          socket.emit('quizwave:error', { message: 'Quiz not found' });
          return;
        }

        // Validate quiz has questions
        if (!session.quiz.questions || session.quiz.questions.length === 0) {
          socket.emit('quizwave:error', { message: 'Quiz has no questions' });
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

        // Get first question
        const quiz = session.quiz;
        const firstQuestion = quiz.questions[0];
        
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
        
        // For students - hide correct answers
        const studentQuestionData = {
          questionIndex: 0,
          questionText: firstQuestion.questionText,
          questionType: firstQuestion.questionType,
          options: firstQuestion.options.map(opt => ({ text: opt.text })),
          timeLimit: firstQuestion.timeLimit
        };
        
        // For teacher - include correct answers
        const teacherQuestionData = {
          questionIndex: 0,
          questionText: firstQuestion.questionText,
          questionType: firstQuestion.questionType,
          options: firstQuestion.options.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect })),
          timeLimit: firstQuestion.timeLimit
        };

        // Broadcast to all participants (students) - this includes teacher if they're in the room
        io.to(`quizwave:${session.gamePin}`).emit('quizwave:question-started', studentQuestionData);
        
        // Also broadcast to teacher room
        io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:question-started', studentQuestionData);

        // Send to teacher with correct answers (separate event)
        socket.emit('quizwave:started', {
          sessionId: session._id,
          questionData: teacherQuestionData,
          participantCount: session.participants.length
        });
      } catch (error) {
        console.error('Start error:', error);
        socket.emit('quizwave:error', { message: 'Error starting session' });
      }
    });

    // Submit answer (student)
    socket.on('quizwave:answer', async (data) => {
      try {
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { sessionId, questionIndex, selectedOptions, timeTaken } = data;

        // Validate sessionId is a valid ObjectId
        if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
          socket.emit('quizwave:error', { message: 'Invalid session ID format' });
          return;
        }

        // Validate questionIndex is a number
        if (typeof questionIndex !== 'number' || !Number.isInteger(questionIndex) || questionIndex < 0) {
          socket.emit('quizwave:error', { message: 'Invalid question index' });
          return;
        }

        // Validate selectedOptions is an array
        if (!Array.isArray(selectedOptions)) {
          socket.emit('quizwave:error', { message: 'Selected options must be an array' });
          return;
        }

        // Validate timeTaken is a positive number
        if (typeof timeTaken !== 'number' || timeTaken < 0 || !isFinite(timeTaken)) {
          socket.emit('quizwave:error', { message: 'Invalid time taken value' });
          return;
        }

        if (!socket.gamePin) {
          socket.emit('quizwave:error', { message: 'Not in a session' });
          return;
        }

        const session = await QuizSession.findById(sessionId).populate('quiz');
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Validate quiz exists
        if (!session.quiz) {
          socket.emit('quizwave:error', { message: 'Quiz not found' });
          return;
        }

        // Validate quiz has questions
        if (!session.quiz.questions || session.quiz.questions.length === 0) {
          socket.emit('quizwave:error', { message: 'Quiz has no questions' });
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

        // Validate questionIndex is within bounds
        if (questionIndex >= session.quiz.questions.length) {
          socket.emit('quizwave:error', { message: `Question index ${questionIndex} is out of bounds` });
          return;
        }

        // Validate selectedOptions indices are within question bounds
        const question = session.quiz.questions[questionIndex];
        if (!question) {
          console.error('Question not found:', { questionIndex, totalQuestions: session.quiz.questions.length, sessionId });
          socket.emit('quizwave:error', { message: `Question not found at index ${questionIndex}` });
          return;
        }

        // Validate selectedOptions are valid integers within option bounds
        if (question.options && question.options.length > 0) {
          for (const optionIndex of selectedOptions) {
            if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
              socket.emit('quizwave:error', { message: `Invalid option index: ${optionIndex}` });
              return;
            }
          }
        }

        // Check if correct
        const correctOptions = question.options
          .map((opt, idx) => opt.isCorrect ? idx : -1)
          .filter(idx => idx !== -1)
          .sort();

        const isCorrect = JSON.stringify(selectedOptions.sort()) === JSON.stringify(correctOptions);

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

        // Calculate points using new formula
        let points = 0;
        if (isCorrect) {
          const maxTime = question.timeLimit * 1000; // Convert to milliseconds
          // Validate maxTime is positive to prevent division by zero
          if (maxTime > 0) {
            // points = 500 * (1 - (time_taken / max_time))
            points = 500 * (1 - (timeTaken / maxTime));
            // Ensure points is not negative
            if (points < 0) {
              points = 0;
            }
          }
          // Add streak bonus
          points += (streak * 50);
        } else {
          // Incorrect answer = 0 points
          points = 0;
        }

        // Validate points is finite
        if (!isFinite(points) || isNaN(points)) {
          points = 0;
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
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { sessionId } = data;

        // Validate sessionId is a valid ObjectId
        if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
          socket.emit('quizwave:error', { message: 'Invalid session ID format' });
          return;
        }

        const session = await QuizSession.findById(sessionId).populate('quiz');
        if (!session) {
          socket.emit('quizwave:error', { message: 'Session not found' });
          return;
        }

        // Validate quiz exists
        if (!session.quiz) {
          socket.emit('quizwave:error', { message: 'Quiz not found' });
          return;
        }

        // Validate quiz has questions
        if (!session.quiz.questions || session.quiz.questions.length === 0) {
          socket.emit('quizwave:error', { message: 'Quiz has no questions' });
          return;
        }

        // Check authorization
        if (session.createdBy.toString() !== socket.userId && socket.userRole !== 'admin') {
          socket.emit('quizwave:error', { message: 'Unauthorized' });
          return;
        }

        const quiz = session.quiz;
        const nextIndex = session.currentQuestionIndex + 1;

        if (nextIndex >= quiz.questions.length) {
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

        // Validate nextIndex is within bounds
        if (nextIndex >= quiz.questions.length) {
          socket.emit('quizwave:error', { message: 'Next question index is out of bounds' });
          return;
        }

        const nextQuestion = quiz.questions[nextIndex];
        if (!nextQuestion) {
          socket.emit('quizwave:error', { message: 'Next question not found' });
          return;
        }

        const questionData = {
          questionIndex: nextIndex,
          questionText: nextQuestion.questionText,
          questionType: nextQuestion.questionType,
          options: nextQuestion.options ? nextQuestion.options.map(opt => ({ text: opt.text })) : [],
          timeLimit: nextQuestion.timeLimit || 30
        };

        // Update active sessions
        activeSessions.set(session.gamePin, {
          sessionId: session._id.toString(),
          status: 'active',
          currentQuestionIndex: nextIndex,
          participantCount: session.participants.length
        });

        // Broadcast to all participants (students)
        io.to(`quizwave:${session.gamePin}`).emit('quizwave:question-started', questionData);
        
        // Also broadcast to teacher room
        io.to(`quizwave:teacher:${session.gamePin}`).emit('quizwave:question-started', questionData);

        // Send to teacher with correct answers (separate event)
        const teacherQuestionData = {
          questionIndex: nextIndex,
          questionText: nextQuestion.questionText,
          questionType: nextQuestion.questionType,
          options: nextQuestion.options.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect })),
          timeLimit: nextQuestion.timeLimit
        };
        
        socket.emit('quizwave:question-advanced', teacherQuestionData);
      } catch (error) {
        console.error('Next question error:', error);
        socket.emit('quizwave:error', { message: 'Error advancing to next question' });
      }
    });

    // End session (teacher)
    socket.on('quizwave:end', async (data) => {
      try {
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { sessionId } = data;

        // Validate sessionId is a valid ObjectId
        if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
          socket.emit('quizwave:error', { message: 'Invalid session ID format' });
          return;
        }

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
        
        // Save session with all participant data and answers
        await session.save();
        console.log(`✅ Quiz session ${sessionId} ended and saved with ${session.participants.length} participants`);
        console.log(`   Total answers recorded: ${session.participants.reduce((sum, p) => sum + p.answers.length, 0)}`);

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
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { gamePin } = data;

        // Validate gamePin format
        if (!gamePin || typeof gamePin !== 'string' || !/^\d{6}$/.test(gamePin)) {
          socket.emit('quizwave:error', { message: 'Invalid game PIN format. Must be 6 digits.' });
          return;
        }

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

        // Join both teacher room and regular room (for receiving broadcasts)
        socket.join(`quizwave:teacher:${gamePin}`);
        socket.join(`quizwave:${gamePin}`);
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
        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('quizwave:error', { message: 'Too many requests. Please wait a moment.' });
          return;
        }

        const { sessionId } = data;

        // Validate sessionId is a valid ObjectId
        if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
          socket.emit('quizwave:error', { message: 'Invalid session ID format' });
          return;
        }

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
      // Cleanup rate limiting data
      rateLimitMap.delete(socket.id);
      // Cleanup handled by session management
    });
  });
};

module.exports = { initializeQuizWaveSocket, activeSessions };

