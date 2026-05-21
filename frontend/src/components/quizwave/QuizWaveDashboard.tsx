import React, { useState, useEffect } from 'react';
import { quizwaveService, Quiz } from '../../services/quizwaveService';
import { Plus, Play, Edit, Trash2, List, Clock, Gamepad2, Sparkles } from 'lucide-react';
import QuizBuilder from './QuizBuilder';
import QuizSessionControl from './QuizSessionControl';
import { QuizCardSkeleton } from '../common/SkeletonLoader';
import ConfirmationModal from '../common/ConfirmationModal';

const formatQuizDuration = (questions: Quiz['questions']) => {
  const totalSeconds = questions.reduce((sum, q) => sum + (q.timeLimit || 0), 0);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
};

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [quizForRetry, setQuizForRetry] = useState<Quiz | null>(null);

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

  const handleDeleteQuiz = (quizId: string) => {
    setQuizToDelete(quizId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setShowDeleteConfirm(false);
    try {
      await quizwaveService.deleteQuiz(quizToDelete);
      loadQuizzes();
      setQuizToDelete(null);
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
      setRetryingQuiz(null);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Error creating session';
      
      // Check if it's a PIN generation error - show retry option
      const isPinError = errorMessage.toLowerCase().includes('pin') || 
                        errorMessage.toLowerCase().includes('unique');
      
      if (isPinError && !isRetry) {
        setRetryError(errorMessage);
        setQuizForRetry(quiz);
        setShowRetryConfirm(true);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <QuizCardSkeleton count={6} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 p-4 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
              <Gamepad2 className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                QuizWave
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600 sm:text-base dark:text-slate-400">
                Create and manage interactive live quizzes for your students
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateQuiz}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto dark:focus:ring-offset-slate-950"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            Create Quiz
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            <QuizCardSkeleton count={6} />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Sparkles className="h-7 w-7 text-indigo-500" aria-hidden />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">No quizzes yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
              Build your first live quiz with timed questions and real-time student responses.
            </p>
            <button
              type="button"
              onClick={handleCreateQuiz}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create your first quiz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {quizzes.map((quiz) => {
              const questionCount = quiz.questions.length;
              const durationLabel = formatQuizDuration(quiz.questions);

              return (
                <article
                  key={quiz._id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200/80 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/80 dark:hover:border-indigo-500/30"
                >
                  <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" aria-hidden />

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                        <Gamepad2 className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          className="truncate text-left text-lg font-semibold leading-tight text-slate-900 dark:text-white"
                          title={quiz.title}
                        >
                          {quiz.title}
                        </h3>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Live interactive session
                        </p>
                      </div>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <List className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden />
                        {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden />
                        {durationLabel}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartSession(quiz)}
                        disabled={retryingQuiz === quiz._id}
                        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
                      >
                        {retryingQuiz === quiz._id ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Generating PIN…
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 fill-current" aria-hidden />
                            Start session
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditQuiz(quiz)}
                        title="Edit quiz"
                        aria-label={`Edit ${quiz.title}`}
                        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-indigo-400 dark:focus:ring-offset-slate-900"
                      >
                        <Edit className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(quiz._id)}
                        title="Delete quiz"
                        aria-label={`Delete ${quiz.title}`}
                        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus:ring-offset-slate-900"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Delete Quiz Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setQuizToDelete(null);
          }}
          onConfirm={confirmDeleteQuiz}
          title="Delete Quiz"
          message="Are you sure you want to delete this quiz? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />

        {/* Retry Session Confirmation Modal */}
        <ConfirmationModal
          isOpen={showRetryConfirm}
          onClose={() => {
            setShowRetryConfirm(false);
            setRetryError(null);
            setQuizForRetry(null);
          }}
          onConfirm={() => {
            setShowRetryConfirm(false);
            if (quizForRetry) {
              setTimeout(() => handleStartSession(quizForRetry, true), 100);
            }
            setRetryError(null);
            setQuizForRetry(null);
          }}
          title="Retry Session Creation"
          message={retryError ? `${retryError}\n\nWould you like to try again with a new PIN?` : 'Would you like to try again with a new PIN?'}
          confirmText="Retry"
          cancelText="Cancel"
          variant="info"
        />
      </div>
    </div>
  );
};

export default QuizWaveDashboard;












