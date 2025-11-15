const { QuizWave, QuizSession, QuizResponse } = require('../models/quizwave.model');
const Course = require('../models/course.model');

// Create a new quiz
const createQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Validate courseId
    if (!courseId || courseId === 'undefined' || courseId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    const { title, description, questions, settings } = req.body;

    // Validate course exists and user is instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can create quizzes'
      });
    }

    // Validate questions
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one question is required'
      });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || q.questionText.trim() === '') {
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

      // Validate options exist
      if (!q.options || !Array.isArray(q.options)) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} must have an options array`
        });
      }

      // Validate and clean options
      const validOptions = q.options.filter(opt => opt && opt.text && opt.text.trim() !== '');
      
      if (q.questionType === 'multiple-choice') {
        if (validOptions.length < 2) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have at least 2 valid options with text`
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

    // Clean and prepare questions data
    const cleanedQuestions = questions.map((q, index) => {
      // Filter out empty options and ensure proper structure
      const cleanedOptions = (q.options || [])
        .filter(opt => opt && opt.text && opt.text.trim() !== '')
        .map(opt => ({
          text: opt.text.trim(),
          isCorrect: opt.isCorrect === true || opt.isCorrect === 'true'
        }));

      return {
        questionText: q.questionText.trim(),
        questionType: q.questionType,
        options: cleanedOptions,
        timeLimit: q.timeLimit && !isNaN(q.timeLimit) ? parseInt(q.timeLimit) : 30,
        points: q.points && !isNaN(q.points) && parseInt(q.points) > 0 ? parseInt(q.points) : 5,
        order: q.order !== undefined ? q.order : index
      };
    });

    const quiz = new QuizWave({
      course: courseId,
      title: title.trim(),
      description: description && description.trim() ? description.trim() : undefined,
      questions: cleanedQuestions,
      settings: settings || {},
      createdBy: req.user.id
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      data: quiz
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    // Handle CastError (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating quiz',
      error: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
  }
};

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
    const isInstructor = course.instructor.toString() === user.id;
    const isAdmin = user.role === 'admin';
    const isStudent = course.students.some(s => s.toString() === user.id);

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
    console.error('Get quizzes error:', error);
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

    const { user } = req;

    const quiz = await QuizWave.findById(quizId).populate('course').populate('createdBy', 'firstName lastName');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check access
    const course = quiz.course;
    const isInstructor = course.instructor.toString() === user.id;
    const isAdmin = user.role === 'admin';
    const isStudent = course.students.some(s => s.toString() === user.id);

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
    console.error('Get quiz error:', error);
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

    const quiz = await QuizWave.findById(quizId).populate('course');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if user is the instructor or admin
    const course = quiz.course;
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can update quizzes'
      });
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
    if (title !== undefined) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (questions !== undefined) {
      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText || q.questionText.trim() === '') {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} text is required`
          });
        }
        if (q.questionType === 'multiple-choice' && q.options.filter(opt => opt.isCorrect).length !== 1) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have exactly one correct answer`
          });
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
    console.error('Update quiz error:', error);
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
    const course = quiz.course;
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can delete quizzes'
      });
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
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting quiz',
      error: error.message
    });
  }
};

// Create a new quiz session
const createSession = async (req, res) => {
  try {
    const { quizId } = req.params;
    
    // Validate quizId
    if (!quizId || quizId === 'undefined' || quizId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID is required'
      });
    }

    const { user } = req;
    
    // Ensure user is authenticated
    if (!user || !user.id) {
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
    
    // Handle both populated and unpopulated course
    let instructorId;
    if (course.instructor) {
      if (typeof course.instructor === 'object' && course.instructor._id) {
        instructorId = course.instructor._id.toString();
      } else if (typeof course.instructor === 'object' && course.instructor.toString) {
        instructorId = course.instructor.toString();
      } else {
        instructorId = String(course.instructor);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Course instructor not found'
      });
    }
    
    const userId = String(user.id);
    if (instructorId !== userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can create sessions'
      });
    }

    // Check if quiz has questions
    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz must have at least one question'
      });
    }

    // Check if there's already an active session for this quiz
    const existingSession = await QuizSession.findOne({
      quiz: quizId,
      status: { $in: ['waiting', 'active', 'paused'] },
      createdBy: user.id
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
      console.error('[createSession] ❌ courseId is null or undefined!');
      return res.status(400).json({
        success: false,
        message: 'Course ID is missing',
        error: 'Unable to determine course ID for session'
      });
    }
    
    // Convert to string for logging, but keep as ObjectId for MongoDB
    console.log(`[createSession] Course ID resolved: ${courseId.toString() || courseId}`);

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
          console.log(`[${new Date().toISOString()}] Attempting to generate PIN for quiz ${quizId}...`);
          gamePin = await QuizSession.generateGamePin();
          console.log(`[${new Date().toISOString()}] Successfully generated PIN: ${gamePin}`);
        } catch (pinError) {
          console.error('❌ Error generating game PIN:', pinError);
          console.error('Error stack:', pinError.stack);
          console.error('Error details:', {
            name: pinError.name,
            message: pinError.message,
            code: pinError.code
          });
          return res.status(500).json({
            success: false,
            message: 'Error generating game PIN',
            error: process.env.NODE_ENV === 'production' ? 'An error occurred' : pinError.message
          });
        }

        console.log(`[createSession] Creating session object with:`, {
          quiz: quizId,
          course: courseId,
          gamePin,
          createdBy: user.id
        });

        session = new QuizSession({
          quiz: quizId,
          course: courseId,
          gamePin,
          createdBy: user.id
        });

        // Validate before saving
        try {
          console.log('[createSession] Validating session...');
          await session.validate();
          console.log('[createSession] ✅ Validation passed');
        } catch (validationError) {
          console.error('[createSession] ❌ Session validation error:', validationError);
          console.error('Validation error details:', {
            name: validationError.name,
            message: validationError.message,
            errors: validationError.errors
          });
          return res.status(400).json({
            success: false,
            message: 'Session validation failed',
            error: process.env.NODE_ENV === 'production' ? 'Invalid session data' : validationError.message,
            ...(process.env.NODE_ENV !== 'production' && { details: validationError.errors })
          });
        }

        // Try to save - this might fail with duplicate key error in race conditions
        console.log('[createSession] Attempting to save session...');
        try {
          await session.save();
          console.log('[createSession] ✅ Session saved successfully!');
          saved = true;
        } catch (saveErr) {
          console.error('[createSession] ❌ Save failed:', {
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
        console.log('Save error caught:', {
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
          console.warn(`Duplicate PIN detected (attempt ${retries}/${maxRetries}), retrying with new PIN...`);
          console.warn('Duplicate PIN details:', {
            attemptedPin: session?.gamePin,
            keyValue: saveError.keyValue
          });
          
          if (retries >= maxRetries) {
            console.error('Failed to create session after maximum retries due to duplicate PINs');
            return res.status(500).json({
              success: false,
              message: 'Unable to generate unique game PIN after multiple attempts',
              error: 'Please try again in a moment'
            });
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
  } catch (error) {
    console.error('\n❌❌❌ CREATE SESSION ERROR ❌❌❌');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error object:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      errors: error.errors
    });
    console.error('❌❌❌ END ERROR ❌❌❌\n');
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors,
        error: errors.join(', ')
      });
    }
    
    if (error.name === 'CastError') {
      console.error('Cast error:', error.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format',
        error: error.message
      });
    }
    
    // Handle duplicate key errors (e.g., duplicate gamePin)
    // Note: This should rarely be hit now due to retry logic above,
    // but kept as a fallback for edge cases
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'key';
      console.error('Duplicate key error (fallback handler - should not reach here):', {
        field,
        keyValue: error.keyValue,
        keyPattern: error.keyPattern,
        fullError: error
      });
      console.error('This should have been caught by retry logic - investigating...');
      
      // If it's a gamePin error, try one more time with retry logic
      if (field === 'gamePin' || (error.message && error.message.includes('gamePin'))) {
        console.log('Attempting emergency retry for gamePin duplicate...');
        // This is a fallback - the retry should have caught it, but if we're here, try once more
        try {
          // Re-fetch courseId if needed (should be in scope, but just in case)
          let emergencyCourseId = courseId;
          if (!emergencyCourseId && quiz && quiz.course) {
            emergencyCourseId = quiz.course._id || quiz.course;
          }
          
          const emergencyPin = await QuizSession.generateGamePin();
          const emergencySession = new QuizSession({
            quiz: quizId,
            course: emergencyCourseId,
            gamePin: emergencyPin,
            createdBy: user.id
          });
          await emergencySession.save();
          return res.status(201).json({
            success: true,
            message: 'Session created successfully (after retry)',
            data: emergencySession
          });
        } catch (retryError) {
          console.error('Emergency retry also failed:', retryError);
        }
      }
      
      return res.status(409).json({
        success: false,
        message: `Duplicate ${field} detected`,
        error: `A session with this ${field} already exists. Please try again.`
      });
    }
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'An error occurred while creating the session' 
      : error.message;
    
    res.status(500).json({
      success: false,
      message: 'Error creating session',
      error: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: error.stack,
        name: error.name,
        code: error.code
      })
    });
  }
};

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
    console.error('Get session by PIN error:', error);
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
    const course = session.course;
    const isInstructor = course.instructor.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isInstructor && !isAdmin && session.createdBy.toString() !== req.user.id) {
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
    console.error('Get session error:', error);
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
    const course = quiz.course;
    const isInstructor = course.instructor.toString() === req.user.id;
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
    console.error('Get sessions error:', error);
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
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    const oldSessions = await QuizSession.find({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });

    const sessionIds = oldSessions.map(s => s._id);

    // Delete related responses
    await QuizResponse.deleteMany({ session: { $in: sessionIds } });

    // Delete old sessions
    const result = await QuizSession.deleteMany({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old sessions`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
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

