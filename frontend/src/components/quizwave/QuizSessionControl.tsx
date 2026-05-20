import React, { useState, useEffect, useCallback } from 'react';
import { getQuizWaveSocket } from '../../utils/quizwaveSocket';
import { quizwaveService, Quiz, QuizSession } from '../../services/quizwaveService';
import { useAuth } from '../../contexts/AuthContext';
import { Play, SkipForward, Users, Trophy, Copy, Check, Clock } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { QuizWaveGameSnapshot } from '../../types/quizwaveGameState';
import { useQuizWavePhaseTimer } from '../../hooks/useQuizWavePhaseTimer';
import TeacherHostRevealView from './TeacherHostRevealView';
import TeacherResultsReveal from './TeacherResultsReveal';

interface QuizSessionControlProps {
  sessionId: string;
  quiz: Quiz;
  courseId: string;
  onEnd: () => void;
}

const QuizSessionControl: React.FC<QuizSessionControlProps> = ({
  sessionId,
  quiz,
  courseId,
  onEnd
}) => {
  const { user } = useAuth();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameSnapshot, setGameSnapshot] = useState<QuizWaveGameSnapshot | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [gameSummary, setGameSummary] = useState<QuizWaveGameSnapshot['gameSummary'] | null>(null);
  const token = localStorage.getItem('token') || '';

  const applySnapshot = useCallback((snap: QuizWaveGameSnapshot) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CLIENT SYNC] teacher', snap.phase, 'Q', snap.currentQuestionIndex);
    }
    setGameSnapshot(snap);
    setParticipantCount(snap.participantCount);
    setSession((prev) =>
      prev
        ? {
            ...prev,
            status: snap.status,
            currentQuestionIndex: snap.currentQuestionIndex
          }
        : prev
    );
    if (snap.leaderboard?.length) {
      setLeaderboard(snap.leaderboard);
    }
    if (snap.gameSummary) setGameSummary(snap.gameSummary);
  }, []);

  const phase = gameSnapshot?.phase ?? (session?.status === 'waiting' ? 'LOBBY' : session?.status === 'ended' ? 'FINISHED' : 'LOBBY');
  const currentQuestionIndex = gameSnapshot?.currentQuestionIndex ?? session?.currentQuestionIndex ?? -1;
  const currentQuestion = gameSnapshot?.question ?? null;
  const answerCount = gameSnapshot?.answerCount ?? 0;
  const answerDistribution = gameSnapshot?.answerDistribution ?? {};

  const questionTimer = useQuizWavePhaseTimer(
    gameSnapshot?.phaseEndsAt,
    phase === 'QUESTION_ACTIVE'
  );
  const transitionTimer = useQuizWavePhaseTimer(
    gameSnapshot?.phaseEndsAt,
    phase === 'TRANSITION'
  );
  const timeRemaining = phase === 'TRANSITION' ? transitionTimer : questionTimer;
  const countdown = phase === 'TRANSITION' ? transitionTimer : 0;

  /** Host (teacher) presentation — never use student personal-result UI */
  const isHostLiveQuestion = phase === 'QUESTION_ACTIVE' || phase === 'QUESTION_LOCKED';
  const isHostDistribution = phase === 'ANSWER_REVEAL' || phase === 'SCOREBOARD';
  const isHostScoreboard = phase === 'SCOREBOARD';
  const isHostTransition = phase === 'TRANSITION';
  /** Show correct-answer checkmarks on chart + tiles during reveal (Kahoot-style) */
  const hostRevealCorrectOnChart = phase === 'ANSWER_REVEAL' || phase === 'SCOREBOARD';

  const loadSession = async () => {
    try {
      const data = await quizwaveService.getSession(sessionId);
      setSession(data);
      setParticipantCount(data.participants.length);
      setParticipants(data.participants || []);
      
      // Only calculate leaderboard when quiz has ended
      if (data.status === 'ended') {
        const lb = data.participants
          .map((p: any) => ({
            nickname: p.nickname,
            totalScore: p.totalScore,
            answers: p.answers.length
          }))
          .sort((a: any, b: any) => b.totalScore - a.totalScore);
        setLeaderboard(lb);
      }
      
      return data;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    let sock: Socket | null = null;
    
    const initializeSocket = async () => {
      // Load session first
      const currentSession = await loadSession();
      
      // Then set up socket
      sock = getQuizWaveSocket(token);
      setSocket(sock);

      // Wait for socket to connect if not already connected
      if (sock && !sock.connected) {
        await new Promise((resolve) => {
          if (sock && sock.connected) {
            resolve(true);
          } else if (sock) {
            sock.once('connect', () => resolve(true));
            sock.once('connect_error', () => resolve(false));
          } else {
            resolve(false);
          }
        });
      }

      // Remove any existing listeners first to prevent duplicates
      sock.off('quizwave:teacher-joined');
      sock.off('quizwave:participant-joined');
      sock.off('quizwave:answer-submitted');
      sock.off('quizwave:game-state');
      sock.off('quizwave:ended');

      sock.on('quizwave:game-state', (snap: QuizWaveGameSnapshot) => {
        applySnapshot(snap);
      });

      sock.on('quizwave:teacher-joined', (data) => {
        console.log('Teacher joined:', data);
        setParticipantCount(data.participantCount);
        if (data.status === 'ended' && data.participants) {
          const lb = data.participants
            .map((p: any) => ({
              nickname: p.nickname,
              totalScore: p.totalScore || 0,
              answers: p.answers?.length || 0
            }))
            .sort((a: any, b: any) => b.totalScore - a.totalScore);
          setLeaderboard(lb);
        }
        if (sock) {
          sock.emit('quizwave:sync-game-state', { sessionId });
        }
      });

      sock.on('quizwave:participant-joined', (data) => {
        console.log('Participant joined:', data);
        setParticipantCount(data.participantCount);
        // Update participants list directly from socket data if available
        if (data.participants && Array.isArray(data.participants)) {
          setParticipants(data.participants);
        } else {
          // Fallback: reload session to get updated participants list
          loadSession();
        }
      });

      sock.on('quizwave:answer-submitted', (data) => {
        console.log('Answer submitted:', data);
        // Answer count/distribution come from authoritative game-state broadcast
      });

      sock.on('quizwave:ended', (data) => {
        setLeaderboard(data.leaderboard || []);
        setSession((prev) => (prev ? { ...prev, status: 'ended' as const } : null));
        loadSession();
      });

      // Join as teacher after session is loaded
      if (currentSession?.gamePin && sock) {
        if (sock.connected) {
          sock.emit('quizwave:teacher-join', { gamePin: currentSession.gamePin });
        } else {
          sock.once('connect', () => {
            if (sock) {
              sock.emit('quizwave:teacher-join', { gamePin: currentSession.gamePin });
            }
          });
        }
      }
    };

    initializeSocket();

    return () => {
      if (sock) {
        sock.off('quizwave:teacher-joined');
        sock.off('quizwave:participant-joined');
        sock.off('quizwave:answer-submitted');
        sock.off('quizwave:game-state');
        sock.off('quizwave:ended');
      }
    };
  }, [sessionId, token, applySnapshot]);

  const handleStart = () => {
    if (socket && socket.connected) {
      console.log('Starting quiz:', sessionId);
      socket.emit('quizwave:start', { sessionId });
    } else {
      console.error('Socket not connected');
      alert('Connection lost. Please refresh the page.');
    }
  };

  const handleNextQuestion = () => {
    if (socket && socket.connected) {
      socket.emit('quizwave:next-question', { sessionId });
    } else {
      alert('Connection lost. Please refresh the page.');
    }
  };

  const handleEnd = () => {
    if (socket) {
      socket.emit('quizwave:end', { sessionId });
      // Don't wait for response - the socket event will handle state update
    } else {
      // If no socket, just call onEnd directly
      onEnd();
    }
  };

  const isEnded = phase === 'FINISHED' || session?.status === 'ended';
  const isWaiting = phase === 'LOBBY';
  const isActive =
    !isEnded &&
    !isWaiting &&
    !!currentQuestion &&
    ['QUESTION_ACTIVE', 'QUESTION_LOCKED', 'ANSWER_REVEAL', 'SCOREBOARD', 'TRANSITION'].includes(phase);

  const copyGamePin = () => {
    if (session?.gamePin) {
      navigator.clipboard.writeText(session.gamePin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Render full screen when quiz is active (waiting or active status)
  const isQuizActive = session && (phase !== 'FINISHED' || currentQuestion);

  if (!session) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  // Get answer colors
  const getAnswerColor = (index: number) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
    return colors[index % colors.length];
  };

  const getAnswerShape = (index: number) => {
    const shapes = ['triangle', 'diamond', 'circle', 'square'];
    return shapes[index % shapes.length];
  };

  const quizContent = (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Waiting Screen */}
      {isWaiting && (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-2">
                    {quiz.title}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                      Session Status: {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onEnd}
                  className="px-4 sm:px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all shadow-sm hover:shadow-md text-sm sm:text-base font-medium"
                >
                  Close Session
                </button>
              </div>
            </div>

            {/* Game PIN Card - Enhanced */}
            <div className="mb-6 sm:mb-8">
              <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl transform hover:scale-[1.01] transition-transform duration-200">
                <div className="text-center">
                  <p className="text-white/90 text-sm sm:text-base font-medium mb-3 uppercase tracking-wider">
                    Game PIN
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-4">
                    <p className="text-6xl sm:text-7xl lg:text-8xl font-black text-white tracking-wider drop-shadow-lg">
                      {session.gamePin}
                    </p>
                    <button
                      onClick={copyGamePin}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 sm:px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl font-medium text-sm sm:text-base"
                    >
                      {copied ? (
                        <>
                          <Check className="w-5 h-5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-white/80 text-sm sm:text-base mt-2">
                    Share this PIN with your students to join the quiz
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Cards - Enhanced */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl p-5 sm:p-6 text-center shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="bg-white/20 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{participantCount}</p>
                <p className="text-white/90 text-sm sm:text-base font-medium">Participants</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl p-5 sm:p-6 text-center shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="bg-white/20 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{quiz.questions.length}</p>
                <p className="text-white/90 text-sm sm:text-base font-medium">Questions</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-xl p-5 sm:p-6 text-center shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="bg-white/20 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-3">
                  <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">
                  {leaderboard.length > 0 ? leaderboard[0].totalScore : 0}
                </p>
                <p className="text-white/90 text-sm sm:text-base font-medium">Top Score</p>
              </div>
            </div>

            {/* Start Button - Enhanced */}
            <div className="flex flex-col items-center gap-6 mb-6 sm:mb-8">
              <button
                onClick={handleStart}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 sm:px-12 py-4 sm:py-5 rounded-xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center gap-3 text-lg sm:text-xl font-bold"
              >
                <Play className="w-6 h-6 sm:w-7 sm:h-7" />
                Start Quiz
              </button>

              {/* Participants List - Enhanced */}
              {participants.length > 0 && (
                <div className="w-full max-w-2xl">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                      Joined Students <span className="text-blue-600 dark:text-blue-400">({participants.length})</span>
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                      <div className="space-y-3">
                        {participants.map((participant: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                              {participant.nickname.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg flex-1">
                              {participant.nickname}
                            </span>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Question Screen - Full Screen Kahoot Style */}
      {isActive && currentQuestion && (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
          {/* Top Bar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Question</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {currentQuestionIndex + 1} / {quiz.questions.length}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg px-4 py-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-purple-700 dark:text-purple-300 font-semibold">
                  {answerCount} Answers
                </span>
              </div>
              <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 rounded-lg px-4 py-2">
                <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className={`text-red-700 dark:text-red-300 font-semibold ${timeRemaining <= 5 ? 'animate-pulse' : ''}`}>
                  {timeRemaining}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Participants</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{participantCount}</p>
              </div>
              <button
                onClick={onEnd}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>

          {/* Main Question Display */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl w-full">
              {!isHostDistribution && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 text-center">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 break-words">
                    {currentQuestion.questionText}
                  </h1>
                </div>
              )}

              {isHostDistribution && (
                <TeacherHostRevealView
                  questionText={currentQuestion.questionText}
                  options={currentQuestion.options}
                  answerDistribution={answerDistribution}
                  showCorrectMarks={hostRevealCorrectOnChart}
                />
              )}

              {/* Answer Options - Kahoot Style */}
              {isHostLiveQuestion && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {currentQuestion.options.map((opt: any, idx: number) => {
                    const colorClass = getAnswerColor(idx);
                    const shape = getAnswerShape(idx);
                    return (
                      <div
                        key={idx}
                        className={`${colorClass} rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            {/* Shape Icon */}
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/30 rounded-lg flex items-center justify-center flex-shrink-0">
                              {shape === 'triangle' && (
                                <div className="w-0 h-0 border-l-[10px] sm:border-l-[12px] border-l-transparent border-r-[10px] sm:border-r-[12px] border-r-transparent border-b-[16px] sm:border-b-[20px] border-b-white"></div>
                              )}
                              {shape === 'diamond' && (
                                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white rotate-45"></div>
                              )}
                              {shape === 'circle' && (
                                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full"></div>
                              )}
                              {shape === 'square' && (
                                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white"></div>
                              )}
                            </div>
                            <span className="text-white text-lg sm:text-xl lg:text-2xl font-bold break-words">{opt.text}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Countdown Overlay */}
              {isHostTransition && countdown > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 rounded-full w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 flex items-center justify-center shadow-2xl">
                    <span className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 animate-pulse">
                      {countdown}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-center gap-4">
            {currentQuestionIndex < quiz.questions.length - 1 ? (
              <button
                onClick={handleNextQuestion}
                disabled={phase === 'QUESTION_ACTIVE'}
                className="bg-blue-600 text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                {phase === 'QUESTION_ACTIVE' ? 'Wait for answers / timer...' : 'Next Question'}
              </button>
            ) : (
              <button
                onClick={handleEnd}
                disabled={phase === 'QUESTION_ACTIVE'}
                className="bg-red-600 text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm sm:text-base lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'QUESTION_ACTIVE' ? 'Wait for timer...' : 'End Quiz'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ended — phased podium reveal (teacher) */}
      {isEnded && (
        <TeacherResultsReveal
          quizTitle={quiz.title}
          leaderboard={leaderboard}
          gameSummary={gameSummary}
          totalQuestions={quiz.questions.length}
          participantCount={participantCount}
          onClose={onEnd}
        />
      )}
    </div>
  );

  // Full screen while quiz is running or showing results reveal
  if (isQuizActive || isEnded) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-[60] overflow-hidden lg:left-20 left-0">
        {quizContent}
      </div>
    );
  }

  return quizContent;
};

export default QuizSessionControl;












