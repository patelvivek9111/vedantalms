import React, { useState, useEffect, useRef } from 'react';
import { getQuizWaveSocket } from '../../utils/quizwaveSocket';
import { quizwaveService, Quiz, QuizSession } from '../../services/quizwaveService';
import { useAuth } from '../../context/AuthContext';
import { Play, Pause, SkipForward, Users, Trophy, Copy, Check, Clock } from 'lucide-react';
import { Socket } from 'socket.io-client';

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [answerDistribution, setAnswerDistribution] = useState<{ [key: number]: number }>({});
  const [showAnswerDistribution, setShowAnswerDistribution] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const podiumTimerRef = useRef<NodeJS.Timeout | null>(null);
  const token = localStorage.getItem('token') || '';

  const loadSession = async () => {
    try {
      const data = await quizwaveService.getSession(sessionId);
      setSession(data);
      setParticipantCount(data.participants.length);
      setParticipants(data.participants || []);
      setCurrentQuestionIndex(data.currentQuestionIndex);
      
      // Calculate leaderboard
      const lb = data.participants
        .map((p: any) => ({
          nickname: p.nickname,
          totalScore: p.totalScore,
          answers: p.answers.length
        }))
        .sort((a: any, b: any) => b.totalScore - a.totalScore);
      setLeaderboard(lb);
      
      // Set current question if quiz has started
      if (data.currentQuestionIndex >= 0 && quiz.questions[data.currentQuestionIndex]) {
        setCurrentQuestion(quiz.questions[data.currentQuestionIndex]);
      }
      
      return data;
    } catch (error) {
      console.error('Error loading session:', error);
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

      sock.on('quizwave:teacher-joined', (data) => {
        setParticipantCount(data.participantCount);
        setCurrentQuestionIndex(data.currentQuestionIndex);
        setLeaderboard(data.participants || []);
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
        setAnswerCount((prev) => prev + 1);
        // Update answer distribution
        if (data.selectedOptions && data.selectedOptions.length > 0) {
          setAnswerDistribution((prev) => {
            const newDist = { ...prev };
            // For each selected option, increment the count
            data.selectedOptions.forEach((optionIndex: number) => {
              newDist[optionIndex] = (newDist[optionIndex] || 0) + 1;
            });
            return newDist;
          });
        }
        // Refresh leaderboard
        loadSession();
      });

      sock.on('quizwave:started', (data) => {
        setCurrentQuestionIndex(0);
        setCurrentQuestion(data.questionData);
        setAnswerCount(0);
        setAnswerDistribution({});
        setShowAnswerDistribution(false);
        setShowCorrectAnswer(false);
        setCountdown(0);
        setTimeRemaining(data.questionData.timeLimit || 30);
        // Clear any existing timers
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
        // Update session status to active
        setSession((prev) => prev ? { ...prev, status: 'active' as const, currentQuestionIndex: 0 } : null);
        // Also reload session to get latest state
        loadSession();
      });

      sock.on('quizwave:question-advanced', (data) => {
        console.log('Question advanced:', data);
        setCurrentQuestionIndex(data.questionIndex);
        setCurrentQuestion(data.questionData);
        setAnswerCount(0);
        setAnswerDistribution({});
        setShowAnswerDistribution(false);
        setShowCorrectAnswer(false);
        setCountdown(0);
        setTimeRemaining(data.questionData.timeLimit || 30);
        // Clear any existing timers
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      });

      sock.on('quizwave:question-started', (data) => {
        console.log('Question started (teacher view):', data);
        // This event is also sent to teacher, update accordingly
        setCurrentQuestionIndex(data.questionIndex || 0);
        setCurrentQuestion(data);
        setAnswerCount(0);
        setAnswerDistribution({});
        setShowAnswerDistribution(false);
        setShowCorrectAnswer(false);
        setTimeRemaining(data.timeLimit || 30);
        // Update session status to active
        setSession((prev) => prev ? { ...prev, status: 'active' as const, currentQuestionIndex: data.questionIndex || 0 } : null);
      });

      sock.on('quizwave:ended', (data) => {
        console.log('Quiz ended, leaderboard:', data);
        console.log('Leaderboard data:', data.leaderboard);
        console.log('Leaderboard length:', data.leaderboard?.length);
        
        // Set leaderboard first
        setLeaderboard(data.leaderboard || []);
        setShowFullLeaderboard(false);
        
        // Clear any timers
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        
        // Clear countdown and answer states
        setCountdown(0);
        setShowCorrectAnswer(false);
        setShowAnswerDistribution(false);
        setCurrentQuestion(null);
        setTimeRemaining(0);
        
        // Update session status to ended so isEnded becomes true
        setSession((prev) => {
          if (prev) {
            const updated: QuizSession = { ...prev, status: 'ended' as const };
            console.log('Updated session status to ended:', updated);
            return updated;
          }
          return null;
        });
        
        // After 10 seconds, show full leaderboard
        if (podiumTimerRef.current) {
          clearTimeout(podiumTimerRef.current);
        }
        podiumTimerRef.current = setTimeout(() => {
          setShowFullLeaderboard(true);
        }, 10000);
        
        // Reload session to get final state with all saved data
        loadSession().then((sessionData) => {
          console.log('Reloaded session after end:', sessionData);
          if (sessionData) {
            // Recalculate leaderboard from session data
            const lb = sessionData.participants
              .map((p: any) => ({
                nickname: p.nickname,
                totalScore: p.totalScore,
                answers: p.answers.length
              }))
              .sort((a: any, b: any) => b.totalScore - a.totalScore);
            console.log('Recalculated leaderboard:', lb);
            setLeaderboard(lb);
          }
        });
      });

      // Join as teacher after session is loaded
      if (currentSession?.gamePin) {
        sock.emit('quizwave:teacher-join', { gamePin: currentSession.gamePin });
      }
    };

    initializeSocket();

    return () => {
      if (sock) {
        sock.off('quizwave:teacher-joined');
        sock.off('quizwave:participant-joined');
        sock.off('quizwave:answer-submitted');
        sock.off('quizwave:started');
        sock.off('quizwave:question-advanced');
        sock.off('quizwave:question-started');
        sock.off('quizwave:ended');
      }
    };
  }, [sessionId, token]);

  useEffect(() => {
    if (session?.gamePin && socket) {
      socket.emit('quizwave:teacher-join', { gamePin: session.gamePin });
    }
  }, [session?.gamePin, socket]);

  const handleStart = () => {
    if (socket) {
      socket.emit('quizwave:start', { sessionId });
    }
  };

  const handleNextQuestion = () => {
    // Reset state before advancing
    setShowCorrectAnswer(false);
    setShowAnswerDistribution(false);
    setCountdown(0);
    setAnswerDistribution({});
    setAnswerCount(0);
    
    if (socket) {
      socket.emit('quizwave:next-question', { sessionId });
    }
  };

  const handleEnd = () => {
    // Clear any timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    if (socket) {
      socket.emit('quizwave:end', { sessionId });
      // Don't wait for response - the socket event will handle state update
    } else {
      // If no socket, just call onEnd directly
      onEnd();
    }
  };

  // Calculate status flags (before useEffects that use them)
  // Also check if we have leaderboard data as a fallback indicator that quiz ended
  const isEnded = session?.status === 'ended' || (leaderboard.length > 0 && !currentQuestion && session?.status !== 'waiting');
  const isWaiting = session?.status === 'waiting' && !currentQuestion;
  const isActive = (session?.status === 'active' || currentQuestion) && !isEnded;

  // Handle time's up - separate effect to ensure it runs
  useEffect(() => {
    if (isActive && currentQuestion && timeRemaining === 0 && !showCorrectAnswer && !showAnswerDistribution && !countdown) {
      // Time's up - load session to get final answer distribution
      loadSession().then((sessionData) => {
        // Calculate distribution from session data
        if (sessionData?.participants) {
          const dist: { [key: number]: number } = {};
          sessionData.participants.forEach((p: any) => {
            const answer = p.answers.find((a: any) => a.questionIndex === currentQuestionIndex);
            if (answer && answer.selectedOptions) {
              answer.selectedOptions.forEach((optIdx: number) => {
                dist[optIdx] = (dist[optIdx] || 0) + 1;
              });
            }
          });
          setAnswerDistribution(dist);
        }
        // Show answer distribution first
        setShowAnswerDistribution(true);
        // After 3 seconds, show correct answer and start countdown
        setTimeout(() => {
          setShowCorrectAnswer(true);
          setShowAnswerDistribution(false);
          // Start countdown from 3
          setCountdown(3);
        }, 3000);
      }).catch((error) => {
        console.error('Error loading session on time up:', error);
        // Still show correct answer even if loading fails
        setShowCorrectAnswer(true);
        setCountdown(3);
      });
    }
  }, [isActive, currentQuestion, timeRemaining, showCorrectAnswer, showAnswerDistribution, countdown, currentQuestionIndex]);

  // Timer effect for teacher view
  useEffect(() => {
    if (isActive && currentQuestion && timeRemaining > 0 && !showCorrectAnswer && !showAnswerDistribution) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, currentQuestion, timeRemaining, showCorrectAnswer, showAnswerDistribution]);

  // Countdown effect - separate to manage countdown independently
  useEffect(() => {
    // Only start countdown if showCorrectAnswer is true and countdown is greater than 0
    // Don't re-run if countdown is already running
    if (showCorrectAnswer && countdown > 0 && !countdownRef.current) {
      console.log('Starting countdown from:', countdown);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newCount = prev - 1;
          console.log('Countdown:', newCount);
          
          if (newCount <= 0) {
            // Clear interval before advancing
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            
            // Countdown finished - advance
            // Check if there's a next question (currentQuestionIndex + 1)
            const nextIndex = currentQuestionIndex + 1;
            const totalQuestions = quiz.questions.length;
            
            console.log('Countdown finished. Current index:', currentQuestionIndex, 'Next index:', nextIndex, 'Total questions:', totalQuestions);
            
            if (nextIndex < totalQuestions) {
              // Reset state before advancing
              setShowCorrectAnswer(false);
              setShowAnswerDistribution(false);
              setAnswerDistribution({});
              setAnswerCount(0);
              setCountdown(0);
              
              if (socket) {
                socket.emit('quizwave:next-question', { sessionId });
              }
            } else {
              // End quiz - last question
              setShowCorrectAnswer(false);
              setShowAnswerDistribution(false);
              setCountdown(0);
              
              if (socket) {
                socket.emit('quizwave:end', { sessionId });
              }
            }
            return 0;
          }
          return newCount;
        });
      }, 1000);
    }

    return () => {
      // Don't clear the interval here - let it run until countdown reaches 0
      // Only clear if showCorrectAnswer becomes false
      if (!showCorrectAnswer && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [showCorrectAnswer, countdown, currentQuestionIndex, quiz.questions.length, socket, sessionId]);

  const copyGamePin = () => {
    if (session?.gamePin) {
      navigator.clipboard.writeText(session.gamePin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Render full screen when quiz is active (waiting or active status)
  const isQuizActive = session && (session.status === 'waiting' || session.status === 'active' || currentQuestion);

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
        <div className="p-3 sm:p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">
                    {quiz.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Session Status: <span className="font-semibold capitalize">{session.status}</span>
                  </p>
                </div>
                <button
                  onClick={onEnd}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm sm:text-base"
                >
                  Close Session
                </button>
              </div>

              {/* Game PIN */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 text-center">
                <p className="text-white text-xs sm:text-sm mb-2">Game PIN</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <p className="text-4xl sm:text-5xl font-bold text-white">{session.gamePin}</p>
                  <button
                    onClick={copyGamePin}
                    className="w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
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
                <p className="text-white/80 text-xs sm:text-sm mt-2">
                  Share this PIN with your students to join the quiz
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 text-center">
                  <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{participantCount}</p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Participants</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                    {quiz.questions.length}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Questions</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 sm:p-4 text-center">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">0</p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Top Score</p>
                </div>
              </div>

              {/* Start Button */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleStart}
                  className="bg-green-600 text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm sm:text-base lg:text-lg"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                  Start Quiz
                </button>

                {/* Participants List */}
                {participants.length > 0 && (
                  <div className="w-full max-w-md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 text-center">
                      Joined Students ({participants.length})
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {participants.map((participant: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg"
                          >
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {participant.nickname.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {participant.nickname}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
              {/* Question Text */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 text-center">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 break-words">
                  {currentQuestion.questionText}
                </h1>
              </div>

              {/* Answer Distribution Chart */}
              {showAnswerDistribution && (
                <div className="mb-4 sm:mb-6 lg:mb-8 w-full">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                    {currentQuestion.options.map((opt: any, idx: number) => {
                      const colorClass = getAnswerColor(idx);
                      const shape = getAnswerShape(idx);
                      const count = answerDistribution[idx] || 0;
                      const maxCount = Math.max(...Object.values(answerDistribution), 1);
                      const barHeight = maxCount > 0 ? Math.max((count / maxCount) * 200, count > 0 ? 40 : 0) : 0;
                      const isCorrect = opt.isCorrect;
                      
                      return (
                        <div key={idx} className="flex flex-col items-center">
                          {/* Count above bar */}
                          <div className="mb-2">
                            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">{count}</span>
                            {isCorrect && (
                              <Check className="w-6 h-6 text-green-500 inline-block ml-2" />
                            )}
                          </div>
                          {/* Bar Chart Container */}
                          <div className="w-full flex items-end justify-center" style={{ height: '250px' }}>
                            <div className="w-full relative">
                              {/* Bar */}
                              <div
                                className={`${colorClass} rounded-t-lg transition-all duration-500 ease-out flex items-end justify-center relative`}
                                style={{ 
                                  height: `${barHeight}px`,
                                  minHeight: count > 0 ? '40px' : '0px'
                                }}
                              >
                                {/* Shape icon at the bottom of the bar */}
                                {count > 0 && (
                                  <div className="absolute bottom-2 w-12 h-12 bg-white/30 rounded-lg flex items-center justify-center">
                                    {shape === 'triangle' && (
                                      <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[16px] border-b-white"></div>
                                    )}
                                    {shape === 'diamond' && (
                                      <div className="w-5 h-5 bg-white rotate-45"></div>
                                    )}
                                    {shape === 'circle' && (
                                      <div className="w-5 h-5 bg-white rounded-full"></div>
                                    )}
                                    {shape === 'square' && (
                                      <div className="w-5 h-5 bg-white"></div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Option text below */}
                          <div className="mt-4 text-center">
                            <div className={`${colorClass} rounded-lg px-4 py-2 inline-block`}>
                              <span className="text-white text-lg font-semibold">{opt.text}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Answer Options - Kahoot Style */}
              {!showAnswerDistribution && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {currentQuestion.options.map((opt: any, idx: number) => {
                    const colorClass = getAnswerColor(idx);
                    const shape = getAnswerShape(idx);
                    const isCorrect = showCorrectAnswer && opt.isCorrect;
                    // Make correct answer green when shown
                    const finalColorClass = isCorrect ? 'bg-green-500' : colorClass;
                    
                    return (
                      <div
                        key={idx}
                        className={`${finalColorClass} rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer ${isCorrect ? 'ring-2 sm:ring-4 ring-green-300 ring-offset-2 sm:ring-offset-4' : ''}`}
                      >
                        <div className="flex items-center justify-between">
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
                          {isCorrect && (
                            <div className="bg-white/30 rounded-full p-2">
                              <Check className="w-6 h-6 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Countdown Overlay */}
              {showCorrectAnswer && countdown > 0 && (
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
                disabled={timeRemaining > 0 && !showCorrectAnswer}
                className="bg-blue-600 text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                {timeRemaining > 0 && !showCorrectAnswer ? 'Wait for timer...' : 'Next Question'}
              </button>
            ) : (
              <button
                onClick={handleEnd}
                disabled={timeRemaining > 0 && !showCorrectAnswer}
                className="bg-red-600 text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm sm:text-base lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {timeRemaining > 0 && !showCorrectAnswer ? 'Wait for timer...' : 'End Quiz'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ended Screen */}
      {isEnded && (
        <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-blue-900 to-purple-900 p-3 sm:p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  Quiz Complete! 🎉
                </h2>
                <button
                  onClick={onEnd}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                >
                  Close Session
                </button>
              </div>

              {/* Show message if no leaderboard data yet */}
              {leaderboard.length === 0 && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white text-lg">Loading leaderboard...</p>
                </div>
              )}

              {/* Podium View - Top 3 Only */}
              {!showFullLeaderboard && leaderboard.length > 0 && (
                <div className="flex flex-col items-center">
                  <h3 className="text-2xl font-bold text-white mb-8">
                    {leaderboard.length === 1 ? 'Winner!' : leaderboard.length >= 3 ? 'Top 3 Winners!' : 'Winners!'}
                  </h3>
                  <div className="flex items-end justify-center gap-4 mb-8" style={{ height: '400px' }}>
                    {/* 2nd Place (Left) - only show if there are at least 2 participants */}
                    {leaderboard.length >= 2 && leaderboard[1] && (
                      <div className="flex flex-col items-center">
                        <div className="relative mb-4">
                          {/* Character/Avatar with emote */}
                          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl animate-bounce">
                            {leaderboard[1].nickname.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -top-2 -right-2 text-3xl animate-pulse">🎉</div>
                        </div>
                        <div className="bg-red-500 rounded-t-lg px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center min-w-[120px] sm:min-w-[140px] lg:min-w-[150px]" style={{ height: '200px' }}>
                          <div className="text-white text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2">2</div>
                          <div className="text-white text-lg font-semibold">{leaderboard[1].nickname}</div>
                          <div className="text-white/90 text-sm mt-2">{leaderboard[1].totalScore} pts</div>
                        </div>
                      </div>
                    )}

                    {/* 1st Place (Center - Tallest) */}
                    {leaderboard[0] && (
                      <div className="flex flex-col items-center">
                        <div className="relative mb-4">
                          {/* Character/Avatar with emote */}
                          <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-yellow-400 rounded-full flex items-center justify-center text-3xl sm:text-4xl lg:text-5xl font-bold animate-bounce shadow-2xl">
                            {leaderboard[0].nickname.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -top-4 -right-4 text-5xl animate-pulse">👑</div>
                          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-4xl animate-bounce">🏆</div>
                        </div>
                        <div className="bg-orange-500 rounded-t-lg px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 text-center min-w-[140px] sm:min-w-[160px] lg:min-w-[180px]" style={{ height: '280px' }}>
                          <div className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold mb-2">1</div>
                          <div className="text-white text-base sm:text-lg lg:text-xl font-bold break-words">{leaderboard[0].nickname}</div>
                          <div className="text-white/90 text-xs sm:text-sm lg:text-base mt-2 font-semibold">{leaderboard[0].totalScore} pts</div>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place (Right) - only show if there are at least 3 participants */}
                    {leaderboard.length >= 3 && leaderboard[2] && (
                      <div className="flex flex-col items-center">
                        <div className="relative mb-4">
                          {/* Character/Avatar with emote */}
                          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl animate-bounce">
                            {leaderboard[2].nickname.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -top-2 -right-2 text-3xl animate-pulse">🎊</div>
                        </div>
                        <div className="bg-blue-500 rounded-t-lg px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center min-w-[120px] sm:min-w-[140px] lg:min-w-[150px]" style={{ height: '160px' }}>
                          <div className="text-white text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">3</div>
                          <div className="text-white text-sm sm:text-base lg:text-lg font-semibold break-words">{leaderboard[2].nickname}</div>
                          <div className="text-white/90 text-xs sm:text-sm mt-2">{leaderboard[2].totalScore} pts</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Full Leaderboard - After 10 seconds */}
              {showFullLeaderboard && leaderboard.length > 0 && (
                <div>
                  {/* Top 3 Podium */}
                  <div className="flex items-end justify-center gap-4 mb-8" style={{ height: '300px' }}>
                    {/* 2nd Place */}
                    {leaderboard[1] && (
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold mb-2">
                          {leaderboard[1].nickname.charAt(0).toUpperCase()}
                        </div>
                        <div className="bg-red-500 rounded-t-lg px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center min-w-[110px] sm:min-w-[130px] lg:min-w-[140px]" style={{ height: '180px' }}>
                          <div className="text-white text-3xl sm:text-4xl font-bold mb-2">2</div>
                          <div className="text-white text-sm sm:text-base font-semibold break-words">{leaderboard[1].nickname}</div>
                          <div className="text-white/90 text-xs sm:text-sm mt-2">{leaderboard[1].totalScore} pts</div>
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {leaderboard[0] && (
                      <div className="flex flex-col items-center">
                        <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-4xl font-bold mb-2 shadow-lg">
                          {leaderboard[0].nickname.charAt(0).toUpperCase()}
                        </div>
                        <div className="bg-orange-500 rounded-t-lg px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 text-center min-w-[130px] sm:min-w-[150px] lg:min-w-[160px]" style={{ height: '240px' }}>
                          <div className="text-white text-4xl sm:text-5xl font-bold mb-2">1</div>
                          <div className="text-white text-sm sm:text-base lg:text-lg font-bold break-words">{leaderboard[0].nickname}</div>
                          <div className="text-white/90 text-xs sm:text-sm lg:text-base mt-2 font-semibold">{leaderboard[0].totalScore} pts</div>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {leaderboard[2] && (
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold mb-2">
                          {leaderboard[2].nickname.charAt(0).toUpperCase()}
                        </div>
                        <div className="bg-blue-500 rounded-t-lg px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center min-w-[110px] sm:min-w-[130px] lg:min-w-[140px]" style={{ height: '140px' }}>
                          <div className="text-white text-3xl sm:text-4xl font-bold mb-2">3</div>
                          <div className="text-white text-sm sm:text-base font-semibold break-words">{leaderboard[2].nickname}</div>
                          <div className="text-white/90 text-xs sm:text-sm mt-2">{leaderboard[2].totalScore} pts</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rest of the Leaderboard */}
                  {leaderboard.length > 3 && (
                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-white mb-4">All Participants</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {leaderboard.slice(3).map((entry, index) => (
                          <div
                            key={index + 3}
                            className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-xl font-bold text-white w-8">
                                #{index + 4}
                              </span>
                              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold">
                                {entry.nickname.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-white">
                                {entry.nickname}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-white">
                              {entry.totalScore} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Return with full screen wrapper when quiz is active
  // Account for global sidebar width (80px) on the left for desktop only
  if (isQuizActive) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-[60] overflow-auto lg:left-20 left-0">
        {quizContent}
      </div>
    );
  }

  // Regular layout when quiz is ended
  return quizContent;
};

export default QuizSessionControl;


