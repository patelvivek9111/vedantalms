import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getQuizWaveSocket } from '../../utils/quizwaveSocket';
import { quizwaveService } from '../../services/quizwaveService';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle } from 'lucide-react';
import { QuizWaveGameSnapshot, isRevealPhase } from '../../types/quizwaveGameState';
import { useQuizWavePhaseTimer } from '../../hooks/useQuizWavePhaseTimer';
import StudentAnswerFeedbackView from './StudentAnswerFeedbackView';
import StudentGameResults from './StudentGameResults';
import type { QuizWavePlayerResult } from '../../types/quizwaveScoring';
import type { QuizWaveGameSummary } from '../../types/quizwaveGameState';

const StudentGameScreen: React.FC = () => {
  const { pin } = useParams<{ pin: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const nickname = location.state?.nickname || user?.firstName || 'Player';

  const [session, setSession] = useState<any>(null);
  const [gameSnapshot, setGameSnapshot] = useState<QuizWaveGameSnapshot | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<QuizWavePlayerResult | null>(null);
  const [gameSummary, setGameSummary] = useState<QuizWaveGameSummary | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [showColorAnimation, setShowColorAnimation] = useState(false);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  const colorAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const token = localStorage.getItem('token') || '';
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];

  const phase = gameSnapshot?.phase ?? (session?.status === 'ended' ? 'FINISHED' : 'LOBBY');
  const currentQuestion = gameSnapshot?.question ?? null;
  const timeRemaining = useQuizWavePhaseTimer(
    gameSnapshot?.phaseEndsAt,
    phase === 'QUESTION_ACTIVE'
  );
  const postAnswerPhases = ['QUESTION_LOCKED', 'ANSWER_REVEAL', 'SCOREBOARD', 'TRANSITION'];
  const isPostAnswerPhase = postAnswerPhases.includes(phase);
  /** Personal feedback stays visible until the teacher advances to the next question */
  const showPersonalFeedback =
    answered &&
    (answerResult != null || isPostAnswerPhase || phase === 'QUESTION_ACTIVE');
  /** Option colors/icons reveal when server enters host reveal phases */
  const showOptionReveal = isRevealPhase(phase);
  const leaderboard = gameSnapshot?.leaderboard ?? [];

  const applySnapshot = useCallback((snap: QuizWaveGameSnapshot) => {
    setGameSnapshot((prev) => {
      const advancedToNewQuestion =
        snap.phase === 'QUESTION_ACTIVE' &&
        prev != null &&
        snap.currentQuestionIndex !== prev.currentQuestionIndex;

      if (advancedToNewQuestion) {
        setSelectedAnswer([]);
        setAnswered(false);
        setAnswerResult(null);
        setShowColorAnimation(false);
      }
      return snap;
    });

    setSession((prev: any) =>
      prev ? { ...prev, status: snap.status, currentQuestionIndex: snap.currentQuestionIndex } : prev
    );
  }, []);

  const loadSession = async () => {
    try {
      const data = await quizwaveService.getSessionByPin(pin!);
      if (data.status === 'ended') {
        alert('This quiz session has ended');
        navigate('/quizwave/join');
        return null;
      }
      setSession(data);
      return data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Error loading session';
      alert(errorMessage);
      navigate('/quizwave/join');
      throw error;
    }
  };

  useEffect(() => {
    if (!pin) {
      navigate('/quizwave/join');
      return;
    }

    let sock: any = null;

    const initializeGame = async () => {
      try {
        const sessionData = await loadSession();
        sock = getQuizWaveSocket(token);
        setSocket(sock);

        if (!sock.connected) {
          await new Promise((resolve) => {
            if (sock.connected) resolve(true);
            else {
              sock.once('connect', () => resolve(true));
              sock.once('connect_error', () => resolve(false));
            }
          });
        }

        sock.off('quizwave:joined');
        sock.off('quizwave:game-state');
        sock.off('quizwave:answer-received');
        sock.off('quizwave:player-result');
        sock.off('quizwave:quiz-ended');
        sock.off('quizwave:error');

        sock.on('quizwave:game-state', (snap: QuizWaveGameSnapshot) => {
          applySnapshot(snap);
        });

        sock.on('quizwave:joined', () => {
          sock.emit('quizwave:sync-game-state', { gamePin: pin });
        });

        const applyPlayerResult = (data: QuizWavePlayerResult) => {
          setAnswerResult(data);
          setShowColorAnimation(false);
        };

        sock.on('quizwave:answer-received', applyPlayerResult);
        sock.on('quizwave:player-result', applyPlayerResult);

        sock.on('quizwave:quiz-ended', (data: any) => {
          if (data.gameSummary) setGameSummary(data.gameSummary);
          setGameSnapshot((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'FINISHED',
                  status: 'ended',
                  leaderboard: data.leaderboard,
                  gameSummary: data.gameSummary
                }
              : null
          );
        });

        sock.on('quizwave:error', (data: any) => {
          const errorMessage = data.message || 'An error occurred';
          if (errorMessage.includes('Question not found') || errorMessage.includes('mismatch')) {
            sock.emit('quizwave:sync-game-state', { gamePin: pin });
            return;
          }
          if (errorMessage.includes('Session not found') || errorMessage.includes('ended')) {
            setTimeout(() => navigate('/quizwave/join'), 2000);
            return;
          }
          alert(errorMessage);
        });

        sock.on('connect', () => {
          sock.emit('quizwave:sync-game-state', { gamePin: pin });
        });

        if (sock.connected) {
          sock.emit('quizwave:join', { gamePin: pin, nickname });
        } else {
          sock.once('connect', () => {
            sock.emit('quizwave:join', { gamePin: pin, nickname });
          });
        }
      } catch {
        navigate('/quizwave/join');
      }
    };

    initializeGame();

    return () => {
      if (colorAnimationRef.current) clearInterval(colorAnimationRef.current);
      if (sock) {
        sock.off('quizwave:joined');
        sock.off('quizwave:game-state');
        sock.off('quizwave:answer-received');
        sock.off('quizwave:player-result');
        sock.off('quizwave:quiz-ended');
        sock.off('quizwave:error');
        sock.off('connect');
      }
    };
  }, [pin, nickname, token, navigate, applySnapshot]);

  useEffect(() => {
    if (showColorAnimation && phase === 'QUESTION_ACTIVE') {
      colorAnimationRef.current = setInterval(() => {
        setCurrentColorIndex((prev) => (prev + 1) % colors.length);
      }, 200);
    }
    return () => {
      if (colorAnimationRef.current) clearInterval(colorAnimationRef.current);
    };
  }, [showColorAnimation, phase, colors.length]);

  const submitAnswer = useCallback(
    (selection: number[]) => {
      if (answered || selection.length === 0 || !socket || !currentQuestion || !session) return;
      if (phase !== 'QUESTION_ACTIVE') return;
      if (!socket.connected) {
        alert('Connection lost. Please refresh the page.');
        return;
      }

      const phaseStart = gameSnapshot?.phaseStartedAt ?? Date.now();
      const maxTime = (currentQuestion.timeLimit || 30) * 1000;
      const timeTaken = Math.min(maxTime, Math.max(0, Date.now() - phaseStart));

      socket.emit('quizwave:answer', {
        sessionId: session._id,
        questionIndex: currentQuestion.questionIndex,
        selectedOptions: selection,
        timeTaken
      });

      setAnswered(true);
      if (timeRemaining > 0) setShowColorAnimation(true);
    },
    [answered, socket, currentQuestion, session, phase, gameSnapshot, timeRemaining]
  );

  const handleSelectAnswer = (index: number) => {
    if (answered || phase !== 'QUESTION_ACTIVE') return;
    const newSelected = [index];
    setSelectedAnswer(newSelected);
    setTimeout(() => submitAnswer(newSelected), 100);
  };

  if (phase === 'LOBBY' || session?.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-center w-full max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Waiting for quiz to start...
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            The teacher will begin the quiz shortly
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'FINISHED' || session?.status === 'ended') {
    if (leaderboard.length === 0) {
      return (
        <div className="min-h-screen bg-[#46178f] flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p className="text-lg">Loading your results…</p>
          </div>
        </div>
      );
    }

    return (
      <StudentGameResults
        nickname={nickname}
        leaderboard={leaderboard}
        gameSummary={gameSummary ?? gameSnapshot?.gameSummary}
        onDone={() => navigate('/quizwave/join')}
      />
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center">
        <div className="text-white text-xl">Syncing game...</div>
      </div>
    );
  }

  const getAnswerColor = (index: number) => {
    const palette = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
    return palette[index % palette.length];
  };

  const getAnswerShape = (index: number) => {
    const shapes = ['triangle', 'diamond', 'circle', 'square'];
    return shapes[index % shapes.length];
  };

  if (showPersonalFeedback) {
    const questionNumber = (currentQuestion.questionIndex ?? 0) + 1;
    const totalQuestions = gameSnapshot?.totalQuestions ?? session?.quiz?.questions?.length ?? 1;
    return (
      <StudentAnswerFeedbackView
        result={answerResult}
        pin={pin!}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        isLoading={!answerResult}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex flex-col">
      <div className="bg-white/10 backdrop-blur-lg p-3 sm:p-4 flex justify-end items-center">
        <div className="text-white text-xs sm:text-sm">{nickname}</div>
        {phase === 'QUESTION_ACTIVE' && (
          <div className="text-white font-bold ml-4">{timeRemaining}s</div>
        )}
      </div>

      <div
        className={`flex-1 flex items-center justify-center p-3 sm:p-4 ${
          showColorAnimation ? colors[currentColorIndex] : 'bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500'
        } transition-colors duration-200`}
      >
        <div className="w-full max-w-md">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {currentQuestion.options.map((option: any, index: number) => {
              const isSelected = selectedAnswer.includes(index);
              const colorClass = showColorAnimation
                ? colors[(currentColorIndex + index) % colors.length]
                : getAnswerColor(index);
              const shape = getAnswerShape(index);
              const isCorrect = showOptionReveal && option.isCorrect;
              const isWrong = showOptionReveal && isSelected && !option.isCorrect;

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={answered || phase !== 'QUESTION_ACTIVE'}
                  className={`${colorClass} rounded-2xl p-8 sm:p-10 lg:p-12 shadow-2xl transition-all transform ${
                    isSelected && !showColorAnimation ? 'scale-110 ring-4 ring-white' : 'hover:scale-105'
                  } ${showOptionReveal && isCorrect ? 'ring-4 ring-green-300' : ''} ${
                    showOptionReveal && isWrong ? 'ring-4 ring-red-300 opacity-70' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-white/30 rounded-xl flex items-center justify-center mb-4">
                      {shape === 'triangle' && (
                        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[35px] border-b-white" />
                      )}
                      {shape === 'diamond' && <div className="w-10 h-10 bg-white rotate-45" />}
                      {shape === 'circle' && <div className="w-10 h-10 bg-white rounded-full" />}
                      {shape === 'square' && <div className="w-10 h-10 bg-white" />}
                    </div>
                    {showOptionReveal && isCorrect && <CheckCircle className="w-8 h-8 text-white" />}
                    {showOptionReveal && isWrong && <XCircle className="w-8 h-8 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentGameScreen;
