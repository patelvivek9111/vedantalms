import React, { useState, useEffect } from 'react';
import { quizwaveService, Quiz } from '../../services/quizwaveService';
import { Plus, Play, Edit, Trash2, List, Clock } from 'lucide-react';
import QuizBuilder from './QuizBuilder';
import QuizSessionControl from './QuizSessionControl';

interface QuizWaveDashboardProps {
  courseId: string;
}

const QuizWaveDashboard: React.FC<QuizWaveDashboardProps> = ({ courseId }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [retryingQuiz, setRetryingQuiz] = useState<string | null>(null);

  useEffect(() => {
    // Only load if courseId is valid
    if (courseId && courseId.trim() !== '' && courseId !== 'undefined') {
      loadQuizzes();
    } else {
      // Keep loading state if courseId is not yet available (might be loading)
      if (!courseId || courseId === '') {
        setLoading(true);
      } else {
        setLoading(false);
      }
    }
  }, [courseId]);

  const loadQuizzes = async () => {
    if (!courseId || courseId.trim() === '') {
      console.error('Course ID is missing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await quizwaveService.getQuizzesByCourse(courseId);
      setQuizzes(data);
      
      // Check for active sessions and restore if any
      await checkActiveSessions(data);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveSessions = async (quizzes: Quiz[]) => {
    // Check all quizzes in parallel for active sessions
    const sessionChecks = quizzes.map(async (quiz) => {
      try {
        const sessions = await quizwaveService.getSessionsByQuiz(quiz._id);
        // Find active session (waiting, active, or paused)
        const activeSession = sessions.find((s: any) => 
          s.status === 'waiting' || s.status === 'active' || s.status === 'paused'
        );
        
        if (activeSession) {
          return { quiz, session: activeSession };
        }
        return null;
      } catch (error) {
        // Silently fail - quiz might not have sessions yet
        console.error(`Error checking sessions for quiz ${quiz._id}:`, error);
        return null;
      }
    });

    // Wait for all checks to complete
    const results = await Promise.all(sessionChecks);
    
    // Find the first active session
    const activeResult = results.find(result => result !== null);
    
    if (activeResult) {
      // Restore the active session
      setSelectedQuiz(activeResult.quiz);
      setActiveSession(activeResult.session._id);
    }
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setShowBuilder(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setShowBuilder(true);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) {
      return;
    }

    try {
      await quizwaveService.deleteQuiz(quizId);
      loadQuizzes();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error deleting quiz');
    }
  };

  const handleStartSession = async (quiz: Quiz, isRetry = false) => {
    // Prevent multiple simultaneous requests
    if (retryingQuiz === quiz._id) {
      return;
    }

    try {
      setRetryingQuiz(quiz._id);
      const session = await quizwaveService.createSession(quiz._id);
      setSelectedQuiz(quiz);
      setActiveSession(session._id);
      setRetryingQuiz(null);
    } catch (error: any) {
      console.error('Error starting session:', error);
      setRetryingQuiz(null);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Error creating session';
      
      // Check if it's a PIN generation error - show retry option
      const isPinError = errorMessage.toLowerCase().includes('pin') || 
                        errorMessage.toLowerCase().includes('unique');
      
      if (isPinError && !isRetry) {
        const shouldRetry = window.confirm(
          `${errorMessage}\n\nWould you like to try again with a new PIN?`
        );
        if (shouldRetry) {
          // Retry immediately
          setTimeout(() => handleStartSession(quiz, true), 100);
          return;
        }
      } else {
        alert(errorMessage);
      }
    }
  };

  const handleBuilderClose = () => {
    setShowBuilder(false);
    setEditingQuiz(null);
    loadQuizzes();
  };

  const handleSessionEnd = () => {
    setActiveSession(null);
    setSelectedQuiz(null);
  };

  if (activeSession && selectedQuiz) {
    return (
      <QuizSessionControl
        sessionId={activeSession}
        quiz={selectedQuiz}
        courseId={courseId}
        onEnd={handleSessionEnd}
      />
    );
  }

  if (showBuilder) {
    return (
      <QuizBuilder
        courseId={courseId}
        quiz={editingQuiz}
        onClose={handleBuilderClose}
      />
    );
  }

  // Don't render if courseId is missing
  if (!courseId || courseId.trim() === '') {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading course...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              QuizWave
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Create and manage interactive quizzes for your students
            </p>
          </div>
          <button
            onClick={handleCreateQuiz}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">Create Quiz</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quizzes...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
            <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No quizzes yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first interactive quiz to get started
            </p>
            <button
              onClick={handleCreateQuiz}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Quiz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {quizzes.map((quiz) => (
              <div
                key={quiz._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow"
              >
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {quiz.title}
                </h3>
                {quiz.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                    {quiz.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                  <div className="flex items-center gap-1">
                    <List className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>{quiz.questions.length} questions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>
                      {Math.round(
                        quiz.questions.reduce((sum, q) => sum + q.timeLimit, 0) / 60
                      )}{' '}
                      min
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStartSession(quiz)}
                    disabled={retryingQuiz === quiz._id}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {retryingQuiz === quiz._id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating PIN...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEditQuiz(quiz)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuiz(quiz._id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizWaveDashboard;


