const mongoose = require('mongoose');
const { QuizWave, QuizSession, QuizResponse } = require('../models/quizwave.model');
const Course = require('../models/course.model');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError, sendErrorResponse, asyncHandler } = require('../utils/errorHandler');

// Create a new quiz
const createQuiz = asyncHandler(async (req, res, next) => {
    const { courseId } = req.params;
    
    // Validate courseId
    if (!courseId || courseId === 'undefined' || courseId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const { title, description, questions, settings } = req.body;

    // Validate course exists and user is instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return sendErrorResponse(res, new NotFoundError('Course not found'), { action: 'createQuiz', courseId });
    }

    // Check if user is the instructor or admin
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return sendErrorResponse(res, new ValidationError('User ID is required'), { action: 'createQuiz' });
    }
    
    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return sendErrorResponse(res, new ValidationError('Quiz title is required'), { action: 'createQuiz' });
    }

    // Validate title length
    if (title.trim().length > 200) {
      return sendErrorResponse(res, new ValidationError('Quiz title must be 200 characters or less'), { action: 'createQuiz' });
    }

    // Check if user is the instructor or admin
    if (!course.instructor || course.instructor.toString() !== userId.toString()) {
      if (req.user.role !== 'admin') {
        return sendErrorResponse(res, new ForbiddenError('Only course instructors can create quizzes'), { action: 'createQuiz', courseId });
      }
    }

    // Validate questions
    if (!questions || questions.length === 0) {
      return sendErrorResponse(res, new ValidationError('At least one question is required'), { action: 'createQuiz' });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || q.questionText.trim() === '') {
        return sendErrorResponse(res, new ValidationError(`Question ${i + 1} text is required`), { action: 'createQuiz', questionIndex: i + 1 });
      }

      // Validate question type
      if (!q.questionType || !['multiple-choice', 'true-false'].includes(q.questionType)) {
        return sendErrorResponse(res, new ValidationError(`Question ${i + 1} must have a valid question type (multiple-choice or true-false)`), { action: 'createQuiz', questionIndex: i + 1 });
      }

      // Validate options exist
      if (!q.options || !Array.isArray(q.options)) {
        return sendErrorResponse(res, new ValidationError(`Question ${i + 1} must have an options array`), { action: 'createQuiz', questionIndex: i + 1 });
      }

      // Validate and clean options
      const validOptions = q.options.filter(opt => opt && opt.text && opt.text.trim() !== '');
      
      if (q.questionType === 'multiple-choice') {
        if (validOptions.length < 2) {
          return sendErrorResponse(res, new ValidationError(`Question ${i + 1} must have at least 2 valid options with text`), { action: 'createQuiz', questionIndex: i + 1 });
        }
        const correctCount = validOptions.filter(opt => opt.isCorrect === true).length;
        if (correctCount !== 1) {
          return sendErrorResponse(res, new ValidationError(`Question ${i + 1} must have exactly one correct answer`), { action: 'createQuiz', questionIndex: i + 1 });
        }
      } else if (q.questionType === 'true-false') {
        if (validOptions.length !== 2) {
          return sendErrorResponse(res, new ValidationError(`True/False question ${i + 1} must have exactly 2 valid options`), { action: 'createQuiz', questionIndex: i + 1 });
        }
        const correctCount = validOptions.filter(opt => opt.isCorrect === true).length;
        if (correctCount !== 1) {
          return sendErrorResponse(res, new ValidationError(`True/False question ${i + 1} must have exactly one correct answer`), { action: 'createQuiz', questionIndex: i + 1 });
        }
      }
    }

    // Clean and prepare questions data
    const cleanedQuestions = [];
    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      // Filter out empty options and ensure proper structure
      const cleanedOptions = (q.options || [])
        .filter(opt => opt && opt.text && opt.text.trim() !== '')
        .map(opt => ({
          text: opt.text.trim(),
          isCorrect: opt.isCorrect === true || opt.isCorrect === 'true'
        }));

      // Validate timeLimit
      let timeLimit = 30; // default
      if (q.timeLimit !== undefined) {
        const parsedTimeLimit = parseInt(q.timeLimit);
        if (!isNaN(parsedTimeLimit) && parsedTimeLimit > 0 && parsedTimeLimit <= 300) {
          timeLimit = parsedTimeLimit;
        } else {
          return sendErrorResponse(res, new ValidationError(`Question ${index + 1} time limit must be between 1 and 300 seconds`), { action: 'createQuiz', questionIndex: index + 1 });
        }
      }

      cleanedQuestions.push({
        questionText: q.questionText.trim(),
        questionType: q.questionType,
        options: cleanedOptions,
        timeLimit: timeLimit,
        order: q.order !== undefined && !isNaN(q.order) ? parseInt(q.order) : index
      });
    }

    const quiz = new QuizWave({
      course: courseId,
      title: title.trim(),
      description: description && description.trim() ? description.trim() : undefined,
      questions: cleanedQuestions,
      settings: settings || {},
      createdBy: userId
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      data: quiz
    });
});

// Get all quizzes for a course
const getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Validate courseId
    if (!courseId || courseId === 'undefined' || courseId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const { user } = req;

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check access
    const userId = user._id || user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const isInstructor = course.instructor && course.instructor.toString() === userId.toString();
    const isAdmin = user.role === 'admin';
    const isStudent = course.students && Array.isArray(course.students) && 
      course.students.some(s => s && s.toString() === userId.toString());

    if (!isInstructor && !isAdmin && !isStudent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this course'
      });
    }

    const quizzes = await QuizWave.find({ course: courseId })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: quizzes
    });
  } catch (error) {
    logger.logError(error, { action: 'getQuizzesByCourse', courseId: req.params.courseId });
    res.status(500).json({
      success: false,
      message: 'Error fetching quizzes',
      error: error.message
    });
  }
};

// Get a single quiz
const getQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    
    // Validate quizId
    if (!quizId || quizId === 'undefined' || quizId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID is required'
      });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID format'
      });
    }

    const { user } = req;

    const quiz = await QuizWave.findById(quizId).populate('course').populate('createdBy', 'firstName lastName');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check access
    const userId = user._id || user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const course = quiz.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this quiz'
      });
    }
    
    const isInstructor = course.instructor && course.instructor.toString() === userId.toString();
    const isAdmin = user.role === 'admin';
    const isStudent = course.students && Array.isArray(course.students) && 
      course.students.some(s => s && s.toString() === userId.toString());

    if (!isInstructor && !isAdmin && !isStudent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this quiz'
      });
    }

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    logger.logError(error, { action: 'getQuizById', quizId: req.params.quizId });
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz',
      error: error.message
    });
  }
};

// Update a quiz
const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, description, questions, settings } = req.body;
    
    // Validate quizId
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID format'
      });
    }

    const quiz = await QuizWave.findById(quizId).populate('course');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if user is the instructor or admin
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const course = quiz.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this quiz'
      });
    }
    
    if (!course.instructor || course.instructor.toString() !== userId.toString()) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only course instructors can update quizzes'
        });
      }
    }

    // Check if quiz has active sessions
    const activeSessions = await QuizSession.countDocuments({
      quiz: quizId,
      status: { $in: ['waiting', 'active', 'paused'] }
    });

    if (activeSessions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update quiz with active sessions'
      });
    }

    // Update quiz
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty'
        });
      }
      quiz.title = title.trim();
    }
    if (description !== undefined) {
      quiz.description = description ? description.trim() : description;
    }
    if (questions !== undefined) {
      // Validate questions array
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one question is required'
        });
      }

      // Validate each question
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q || typeof q !== 'object') {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} is invalid`
          });
        }

        if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} text is required`
          });
        }

        // Validate question type
        if (!q.questionType || !['multiple-choice', 'true-false'].includes(q.questionType)) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have a valid question type (multiple-choice or true-false)`
          });
        }

        // Validate options
        if (!q.options || !Array.isArray(q.options)) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have an options array`
          });
        }

        const validOptions = q.options.filter(opt => opt && opt.text && opt.text.trim() !== '');
        
        if (q.questionType === 'multiple-choice') {
          if (validOptions.length < 2) {
            return res.status(400).json({
              success: false,
              message: `Question ${i + 1} must have at least 2 valid options`
            });
          }
          const correctCount = validOptions.filter(opt => opt.isCorrect === true).length;
          if (correctCount !== 1) {
            return res.status(400).json({
              success: false,
              message: `Question ${i + 1} must have exactly one correct answer`
            });
          }
        } else if (q.questionType === 'true-false') {
          if (validOptions.length !== 2) {
            return res.status(400).json({
              success: false,
              message: `True/False question ${i + 1} must have exactly 2 valid options`
            });
          }
          const correctCount = validOptions.filter(opt => opt.isCorrect === true).length;
          if (correctCount !== 1) {
            return res.status(400).json({
              success: false,
              message: `True/False question ${i + 1} must have exactly one correct answer`
            });
          }
        }
      }
      quiz.questions = questions;
    }
    if (settings !== undefined) quiz.settings = { ...quiz.settings, ...settings };

    await quiz.save();

    res.json({
      success: true,
      message: 'Quiz updated successfully',
      data: quiz
    });
  } catch (error) {
    logger.logError(error, { action: 'updateQuiz', quizId: req.params.quizId });
    res.status(500).json({
      success: false,
      message: 'Error updating quiz',
      error: error.message
    });
  }
};

// Delete a quiz
const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await QuizWave.findById(quizId).populate('course');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if user is the instructor or admin
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const course = quiz.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this quiz'
      });
    }
    
    // Validate quizId
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID format'
      });
    }

    if (!course.instructor || course.instructor.toString() !== userId.toString()) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only course instructors can delete quizzes'
        });
      }
    }

    // Check if quiz has active sessions
    const activeSessions = await QuizSession.countDocuments({
      quiz: quizId,
      status: { $in: ['waiting', 'active', 'paused'] }
    });

    if (activeSessions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete quiz with active sessions'
      });
    }

    // Delete related sessions and responses
    await QuizSession.deleteMany({ quiz: quizId });
    await QuizResponse.deleteMany({ quiz: quizId });

    await QuizWave.findByIdAndDelete(quizId);

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    logger.logError(error, { action: 'deleteQuiz', quizId: req.params.quizId });
    res.status(500).json({
      success: false,
      message: 'Error deleting quiz',
      error: error.message
    });
  }
};

// Create a new quiz session
const createSession = asyncHandler(async (req, res, next) => {
    const { quizId } = req.params;
    
    // Validate quizId
    if (!quizId || quizId === 'undefined' || quizId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID is required'
      });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID format'
      });
    }

    const { user } = req;
    
    // Ensure user is authenticated
    const userId = user._id || user.id;
    if (!user || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const quiz = await QuizWave.findById(quizId).populate('course');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if user is the instructor or admin
    const course = quiz.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this quiz'
      });
    }
    
    // Validate course has instructor
    if (!course.instructor) {
      return res.status(400).json({
        success: false,
        message: 'Course instructor not found'
      });
    }
    
    // Handle both populated and unpopulated course
    let instructorId;
    if (typeof course.instructor === 'object' && course.instructor._id) {
      instructorId = course.instructor._id.toString();
    } else if (typeof course.instructor === 'object' && course.instructor.toString) {
      instructorId = course.instructor.toString();
    } else {
      instructorId = String(course.instructor);
    }
    
    const userIdStr = String(userId);
    if (instructorId !== userIdStr && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can create sessions'
      });
    }

    // Check if quiz has questions
    if (!quiz.questions || quiz.questions.length === 0) {
      return sendErrorResponse(res, new ValidationError('Quiz must have at least one question'), { action: 'createSession', quizId });
    }

    // Check if there's already an active session for this quiz
    const existingSession = await QuizSession.findOne({
      quiz: quizId,
      status: { $in: ['waiting', 'active', 'paused'] },
      createdBy: userId
    });

    if (existingSession) {
      // Return existing session instead of creating a new one
      return res.status(200).json({
        success: true,
        message: 'Active session already exists',
        data: existingSession
      });
    }

    // Ensure course._id is available (handle both populated and unpopulated)
    let courseId;
    if (course._id) {
      courseId = course._id;
    } else if (typeof course === 'object' && course.toString) {
      courseId = course;
    } else {
      // Fallback: get course ID from quiz
      courseId = quiz.course;
    }
    
    // Ensure courseId is a valid ObjectId
    if (!courseId) {
      logger.error('[createSession] courseId is null or undefined', { quizId: req.params.quizId });
      return sendErrorResponse(res, new ValidationError('Course ID is missing'), { action: 'createSession', quizId });
    }
    
    // Convert to string for logging, but keep as ObjectId for MongoDB
    logger.debug('[createSession] Course ID resolved', { courseId: courseId.toString() || courseId });

    // Retry logic for handling race conditions with PIN generation
    let session;
    let retries = 0;
    const maxRetries = 5;
    let saved = false;

    while (!saved && retries < maxRetries) {
      try {
        // Generate unique game PIN
        let gamePin;
        try {
          logger.debug('Attempting to generate PIN for quiz', { quizId });
          gamePin = await QuizSession.generateGamePin();
          logger.debug('Successfully generated PIN', { quizId, gamePin });
        } catch (pinError) {
          logger.logError(pinError, { action: 'generateGamePin', quizId });
          throw pinError; // Let global error handler deal with it
        }

        logger.debug('[createSession] Creating session object', {
          quiz: quizId,
          course: courseId,
          gamePin,
          createdBy: user.id
        });

        session = new QuizSession({
          quiz: quizId,
          course: courseId,
          gamePin,
          createdBy: userId
        });

        // Validate before saving
        try {
          logger.debug('[createSession] Validating session');
          await session.validate();
          logger.debug('[createSession] Validation passed');
        } catch (validationError) {
          logger.logError(validationError, { action: 'validateSession', quizId: req.params.quizId });
          throw validationError; // Let global error handler deal with it
        }

        // Try to save - this might fail with duplicate key error in race conditions
        logger.debug('[createSession] Attempting to save session');
        try {
          await session.save();
          logger.debug('[createSession] Session saved successfully');
          saved = true;
        } catch (saveErr) {
          logger.warn('[createSession] Save failed', {
            code: saveErr.code,
            name: saveErr.name,
            message: saveErr.message,
            keyPattern: saveErr.keyPattern,
            keyValue: saveErr.keyValue
          });
          throw saveErr; // Re-throw to be caught by outer catch
        }
      } catch (saveError) {
        // Log the error for debugging
        logger.debug('Save error caught', {
          code: saveError.code,
          name: saveError.name,
          message: saveError.message,
          keyPattern: saveError.keyPattern,
          keyValue: saveError.keyValue
        });

        // Handle duplicate key errors (race condition)
        // Check for duplicate key error (code 11000) and if it's related to gamePin
        const isDuplicatePinError = saveError.code === 11000 && (
          (saveError.keyPattern && saveError.keyPattern.gamePin) ||
          (saveError.message && saveError.message.includes('gamePin')) ||
          (saveError.message && saveError.message.includes('duplicate'))
        );

        if (isDuplicatePinError) {
          retries++;
          logger.warn(`Duplicate PIN detected (attempt ${retries}/${maxRetries}), retrying`, {
            attemptedPin: session?.gamePin,
            keyValue: saveError.keyValue
          });
          
          if (retries >= maxRetries) {
            logger.error('Failed to create session after maximum retries due to duplicate PINs', { quizId: req.params.quizId, maxRetries });
            throw new ConflictError('Unable to generate unique game PIN after multiple attempts. Please try again in a moment');
          }
          // Wait a small random amount before retrying to reduce collision chance
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          continue;
        }
        // If it's not a duplicate key error, re-throw to be handled by outer catch
        throw saveError;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });
});

// Get session by PIN (for students to join)
const getSessionByPin = async (req, res) => {
  try {
    const { pin } = req.params;
    
    // Validate pin
    if (!pin || pin === 'undefined' || pin.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Game PIN is required'
      });
    }
    
    // Validate pin format (should be 6-digit numeric)
    const pinRegex = /^\d{6}$/;
    if (!pinRegex.test(pin.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PIN format. PIN must be 6 digits'
      });
    }

    const session = await QuizSession.findOne({ gamePin: pin })
      .populate('quiz')
      .populate('course')
      .populate('participants.student', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if session is joinable
    if (session.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'This session has ended'
      });
    }

    // Don't send full quiz data to students (only send basic info)
    const sessionData = session.toObject();
    if (req.user.role === 'student') {
      // Hide correct answers
      if (sessionData.quiz && sessionData.quiz.questions) {
        sessionData.quiz.questions = sessionData.quiz.questions.map(q => ({
          ...q,
          options: q.options.map(opt => ({
            text: opt.text,
            isCorrect: undefined // Hide correct answer
          }))
        }));
      }
    }

    res.json({
      success: true,
      data: sessionData
    });
  } catch (error) {
    logger.logError(error, { action: 'getSessionByPin', pin: req.params.pin });
    res.status(500).json({
      success: false,
      message: 'Error fetching session',
      error: error.message
    });
  }
};

// Get session details (for teacher)
const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Validate sessionId
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }

    const session = await QuizSession.findById(sessionId)
      .populate('quiz')
      .populate('course')
      .populate('participants.student', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check access
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const course = session.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this session'
      });
    }
    
    const isInstructor = course.instructor && course.instructor.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin && session.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this session'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.logError(error, { action: 'getSession', sessionId: req.params.sessionId });
    res.status(500).json({
      success: false,
      message: 'Error fetching session',
      error: error.message
    });
  }
};

// Get all sessions for a quiz
const getSessionsByQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await QuizWave.findById(quizId).populate('course');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check access
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Validate quizId
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID format'
      });
    }

    const course = quiz.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this quiz'
      });
    }
    
    const isInstructor = course.instructor && course.instructor.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can view sessions'
      });
    }

    const sessions = await QuizSession.find({ quiz: quizId })
      .populate('participants.student', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to recent 50 sessions

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.logError(error, { action: 'getSessions', quizId: req.params.quizId });
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions',
      error: error.message
    });
  }
};

// Cleanup old sessions (2-day retention)
const cleanupOldSessions = async (req, res) => {
  try {
    // Check authorization - only admin can trigger cleanup
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can trigger cleanup'
      });
    }

    // Validate date calculation
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    if (isNaN(twoDaysAgo.getTime())) {
      return res.status(500).json({
        success: false,
        message: 'Invalid date calculation'
      });
    }
    
    const oldSessions = await QuizSession.find({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });

    // Validate sessions array
    if (!Array.isArray(oldSessions)) {
      return res.status(500).json({
        success: false,
        message: 'Invalid sessions array returned'
      });
    }

    const sessionIds = oldSessions
      .map(s => s && s._id ? s._id : null)
      .filter(id => id !== null);

    // Delete related responses
    let responseResult = { deletedCount: 0 };
    try {
      if (sessionIds.length > 0) {
        responseResult = await QuizResponse.deleteMany({ session: { $in: sessionIds } });
      }
    } catch (responseError) {
      logger.warn('Error deleting responses', { error: responseError.message, sessionId: req.params.sessionId });
      // Continue with session deletion even if response deletion fails
    }

    // Delete old sessions
    const result = await QuizSession.deleteMany({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });

    const deletedCount = result && typeof result.deletedCount === 'number' ? result.deletedCount : 0;

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old sessions and ${responseResult.deletedCount || 0} responses`,
      deletedCount: deletedCount,
      deletedResponses: responseResult.deletedCount || 0
    });
  } catch (error) {
    logger.logError(error, { action: 'cleanupOldSessions' });
    res.status(500).json({
      success: false,
      message: 'Error cleaning up sessions',
      error: error.message
    });
  }
};

module.exports = {
  createQuiz,
  getQuizzesByCourse,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  createSession,
  getSessionByPin,
  getSession,
  getSessionsByQuiz,
  cleanupOldSessions
};

