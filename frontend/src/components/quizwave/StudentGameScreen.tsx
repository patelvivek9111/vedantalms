import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getQuizWaveSocket } from '../../utils/quizwaveSocket';
import { quizwaveService } from '../../services/quizwaveService';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react';

const StudentGameScreen: React.FC = () => {
  const { pin } = useParams<{ pin: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const nickname = location.state?.nickname || user?.firstName || 'Player';

  const [session, setSession] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [status, setStatus] = useState<'waiting' | 'active' | 'paused' | 'ended'>('waiting');
  const [showColorAnimation, setShowColorAnimation] = useState(false);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [showResultMessage, setShowResultMessage] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const colorAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const token = localStorage.getItem('token') || '';

  const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];

  const loadSession = async () => {
    try {
      const data = await quizwaveService.getSessionByPin(pin!);
      
      // Check if session is joinable
      if (data.status === 'ended') {
        alert('This quiz session has ended');
        navigate('/quizwave/join');
        return null;
      }
      
      setSession(data);
      setStatus(data.status);
      
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
        // Load session first to verify it exists and is joinable
        await loadSession();
        
        // Then set up socket
        sock = getQuizWaveSocket(token);
        setSocket(sock);

        // Wait for socket to connect if not already connected
        if (!sock.connected) {
          await new Promise((resolve) => {
            if (sock.connected) {
              resolve(true);
            } else {
              sock.once('connect', () => resolve(true));
              sock.once('connect_error', () => resolve(false));
            }
          });
        }

        // Remove any existing listeners first to prevent duplicates
        sock.off('quizwave:joined');
        sock.off('quizwave:question-started');
        sock.off('quizwave:answer-received');
        sock.off('quizwave:quiz-ended');
        sock.off('quizwave:error');

        sock.on('quizwave:joined', (data: any) => {
          console.log('Student joined:', data);
          setStatus(data.status);
          // Reload session to get full quiz data if quiz has started
          if (data.currentQuestionIndex >= 0) {
            loadSession().then((sessionData) => {
              if (sessionData?.quiz && typeof sessionData.quiz === 'object' && 'questions' in sessionData.quiz && data.currentQuestionIndex >= 0) {
                const question = sessionData.quiz.questions[data.currentQuestionIndex];
                if (question) {
                  setCurrentQuestion({ ...question, questionIndex: data.currentQuestionIndex });
                  setTimeRemaining(question.timeLimit);
                }
              }
            });
          }
        });

        sock.on('quizwave:question-started', (data: any) => {
          console.log('Question started:', data);
          // Ensure questionIndex is set correctly
          if (data && typeof data.questionIndex === 'number') {
            // Reset ALL answer-related state when new question starts
            setCurrentQuestion(data);
            setTimeRemaining(data.timeLimit || 30);
            setSelectedAnswer([]); // Clear any previous selection
            setAnswered(false); // Reset answered flag
            setAnswerResult(null); // Clear previous result
            setShowColorAnimation(false);
            setTimeUp(false);
            setShowResultMessage(false);
            setStatus('active');
            console.log('Question state reset - ready for new answer');
          } else {
            console.error('Invalid question data received:', data);
          }
        });

        sock.on('quizwave:answer-received', (data: any) => {
          console.log('Answer received:', data);
          setAnswerResult({
            isCorrect: data.isCorrect,
            points: data.points
          });
          // Don't set answered to true yet - wait for timer to run out
          // Just store the result for later display
        });

        sock.on('quizwave:quiz-ended', (data: any) => {
          console.log('Quiz ended:', data);
          setLeaderboard(data.leaderboard);
          setStatus('ended');
        });

        sock.on('quizwave:error', (data: any) => {
          console.error('Socket error:', data);
          const errorMessage = data.message || 'An error occurred';
          
          // Don't show alert for "Question not found" - it might be a timing issue
          // Instead, try to reload the session
          if (errorMessage.includes('Question not found')) {
            loadSession().catch(err => {
              alert('Error loading question. Please refresh the page.');
            });
            return;
          }
          
          alert(errorMessage);
          // If it's a critical error, redirect back to join
          if (errorMessage.includes('Session not found') || errorMessage.includes('ended')) {
            setTimeout(() => navigate('/quizwave/join'), 2000);
          }
        });

        // Join session via socket
        if (sock.connected) {
          sock.emit('quizwave:join', { gamePin: pin, nickname });
        } else {
          sock.once('connect', () => {
            sock.emit('quizwave:join', { gamePin: pin, nickname });
          });
        }
      } catch (error) {
        console.error('Error initializing game:', error);
        navigate('/quizwave/join');
      }
    };

    initializeGame();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (sock) {
        sock.off('quizwave:joined');
        sock.off('quizwave:question-started');
        sock.off('quizwave:answer-received');
        sock.off('quizwave:quiz-ended');
        sock.off('quizwave:error');
      }
    };
  }, [pin, nickname, token, navigate]);

  // Color animation effect when student has answered early
  useEffect(() => {
    if (showColorAnimation && !timeUp) {
      colorAnimationRef.current = setInterval(() => {
        setCurrentColorIndex((prev) => (prev + 1) % colors.length);
      }, 200); // Change color every 200ms
    }

    return () => {
      if (colorAnimationRef.current) {
        clearInterval(colorAnimationRef.current);
      }
    };
  }, [showColorAnimation, timeUp, colors.length]);

  // Timer effect
  useEffect(() => {
    if (currentQuestion && timeRemaining > 0 && !timeUp) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up
            setTimeUp(true);
            setShowColorAnimation(false);
            
            // Only auto-submit if user has actually selected an answer AND hasn't already submitted
            if (!answered && selectedAnswer.length > 0) {
              console.log('Time ran out - auto-submitting selected answer:', selectedAnswer);
              handleSubmitAnswer();
            } else if (!answered && selectedAnswer.length === 0) {
              // No answer selected - don't submit anything, just show that time ran out
              console.log('Time ran out - no answer selected, not submitting');
              setShowResultMessage(true);
              // Set a null result to indicate no answer was submitted
              setAnswerResult({ isCorrect: false, points: 0 });
            } else if (answered && answerResult) {
              // Already answered - just show the result
              setShowResultMessage(true);
            }
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
  }, [currentQuestion, timeRemaining, timeUp, answered, selectedAnswer, answerResult]);

  const handleSelectAnswer = (index: number) => {
    if (answered || timeRemaining === 0) {
      console.log('Cannot select answer:', { answered, timeRemaining });
      return;
    }

    console.log('Answer selected by user click:', index);
    const newSelected = [index];
    setSelectedAnswer(newSelected);
    
    // Auto-submit immediately when answer is selected (only if user actually clicked)
    setTimeout(() => {
      if (!answered && selectedAnswer.length > 0) {
        console.log('Auto-submitting after user selection:', newSelected);
        handleSubmitAnswerWithSelection(newSelected);
      }
    }, 100);
  };

  const handleSubmitAnswerWithSelection = (selection: number[]) => {
    if (answered || selection.length === 0 || !socket || !currentQuestion) {
      console.log('Cannot submit answer:', { answered, selection, socket: !!socket, currentQuestion: !!currentQuestion });
      return;
    }
    
    // Safety check: ensure questionIndex is valid
    if (typeof currentQuestion.questionIndex !== 'number') {
      console.error('Invalid questionIndex:', currentQuestion.questionIndex);
      return;
    }

    // Check if socket is connected
    if (!socket.connected) {
      console.error('Socket not connected');
      alert('Connection lost. Please refresh the page.');
      return;
    }

    const startTime = currentQuestion.timeLimit;
    const timeTaken = (startTime - timeRemaining) * 1000; // Convert to milliseconds

    console.log('Submitting answer:', {
      sessionId: session?._id,
      questionIndex: currentQuestion.questionIndex,
      selectedOptions: selection,
      timeTaken
    });

    socket.emit('quizwave:answer', {
      sessionId: session?._id,
      questionIndex: currentQuestion.questionIndex,
      selectedOptions: selection,
      timeTaken
    });

    setAnswered(true);
    // Start colorful animation if time hasn't run out yet
    if (timeRemaining > 0) {
      setShowColorAnimation(true);
    }
  };

  const handleSubmitAnswer = () => {
    if (answered || selectedAnswer.length === 0 || !socket || !currentQuestion) {
      console.log('Cannot submit answer:', { answered, selectedAnswer, socket: !!socket, currentQuestion: !!currentQuestion });
      return;
    }
    
    // Safety check: ensure questionIndex is valid
    if (typeof currentQuestion.questionIndex !== 'number') {
      console.error('Invalid questionIndex:', currentQuestion.questionIndex);
      return;
    }

    // Check if socket is connected
    if (!socket.connected) {
      console.error('Socket not connected');
      alert('Connection lost. Please refresh the page.');
      return;
    }

    const startTime = currentQuestion.timeLimit;
    const timeTaken = (startTime - timeRemaining) * 1000; // Convert to milliseconds

    console.log('Submitting answer:', {
      sessionId: session?._id,
      questionIndex: currentQuestion.questionIndex,
      selectedOptions: selectedAnswer,
      timeTaken
    });

    socket.emit('quizwave:answer', {
      sessionId: session?._id,
      questionIndex: currentQuestion.questionIndex,
      selectedOptions: selectedAnswer,
      timeTaken
    });

    setAnswered(true);
    // Start colorful animation if time hasn't run out yet
    if (timeRemaining > 0) {
      setShowColorAnimation(true);
    }
  };

  if (status === 'waiting') {
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

  if (status === 'ended') {
    const myRank = leaderboard.findIndex((entry: any) => entry.nickname === nickname) + 1;
    const myScore = leaderboard.find((entry: any) => entry.nickname === nickname)?.totalScore || 0;
    const isTopThree = myRank <= 3 && myRank > 0;
    const myEntry = leaderboard.find((entry: any) => entry.nickname === nickname);

    // Top 3 Podium View - Show only their own position
    if (isTopThree && myEntry) {
      const podiumPosition = myRank; // 1, 2, or 3
      const podiumData = [
        { rank: 1, color: 'bg-orange-500', height: '280px', avatarSize: 'w-32 h-32', textSize: 'text-6xl', nameSize: 'text-xl', emote: '👑', emote2: '🏆' },
        { rank: 2, color: 'bg-red-500', height: '200px', avatarSize: 'w-24 h-24', textSize: 'text-5xl', nameSize: 'text-lg', emote: '🎉' },
        { rank: 3, color: 'bg-blue-500', height: '160px', avatarSize: 'w-24 h-24', textSize: 'text-5xl', nameSize: 'text-lg', emote: '🎊' }
      ];
      const myPodium = podiumData[podiumPosition - 1];

      return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Quiz Complete! 🎉
                </h2>
                <p className="text-lg sm:text-xl text-white/90">
                  You finished in <span className="font-bold text-yellow-400">#{myRank}</span> place!
                </p>
              </div>

              {/* Podium Display - Only Student's Position */}
              <div className="flex items-end justify-center mb-6 sm:mb-8" style={{ height: '300px', minHeight: '300px' }}>
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    {/* Character/Avatar with emote */}
                    <div className={`${myPodium.avatarSize} bg-yellow-400 rounded-full flex items-center justify-center text-5xl font-bold animate-bounce shadow-2xl`}>
                      {myEntry.nickname.charAt(0).toUpperCase()}
                    </div>
                    {myRank === 1 && (
                      <>
                        <div className="absolute -top-4 -right-4 text-5xl animate-pulse">👑</div>
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-4xl animate-bounce">🏆</div>
                      </>
                    )}
                    {myRank === 2 && (
                      <div className="absolute -top-2 -right-2 text-3xl animate-pulse">🎉</div>
                    )}
                    {myRank === 3 && (
                      <div className="absolute -top-2 -right-2 text-3xl animate-pulse">🎊</div>
                    )}
                  </div>
                  <div className={`${myPodium.color} rounded-t-lg px-8 py-6 text-center min-w-[180px] ring-4 ring-yellow-300 ring-offset-2`} style={{ height: myPodium.height }}>
                    <div className={`text-white ${myPodium.textSize} font-bold mb-2`}>{myRank}</div>
                    <div className={`text-white ${myPodium.nameSize} font-bold`}>{myEntry.nickname}</div>
                    <div className="text-white/90 text-base mt-2 font-semibold">{myScore} pts</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/quizwave/join')}
                className="w-full mt-6 bg-white/20 hover:bg-white/30 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Join Another Game
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Rank 4+ View - Show only their rank
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">
                Quiz Complete! 🎉
              </h2>
              
              {/* Avatar */}
              <div className="mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-white rounded-full flex items-center justify-center text-2xl sm:text-3xl lg:text-4xl font-bold mx-auto">
                  {myEntry?.nickname.charAt(0).toUpperCase() || '?'}
                </div>
              </div>

              {/* Rank Display */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
                <p className="text-white text-xs sm:text-sm mb-2">Your Rank</p>
                <p className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white">#{myRank}</p>
                <p className="text-white/80 text-xs sm:text-sm mt-2">out of {leaderboard.length} participants</p>
              </div>

              {/* Score Display */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
                <p className="text-white text-xs sm:text-sm mb-2">Your Score</p>
                <p className="text-4xl sm:text-5xl font-bold text-white">{myScore}</p>
                <p className="text-white/80 text-xs sm:text-sm mt-2">points</p>
              </div>

              <button
                onClick={() => navigate('/quizwave/join')}
                className="w-full bg-white/20 hover:bg-white/30 text-white py-2 sm:py-3 rounded-lg font-semibold transition-colors text-sm sm:text-base"
              >
                Join Another Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center">
        <div className="text-white text-xl">Loading question...</div>
      </div>
    );
  }

  // Get answer colors and shapes (matching teacher view)
  const getAnswerColor = (index: number) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
    return colors[index % colors.length];
  };

  const getAnswerShape = (index: number) => {
    const shapes = ['triangle', 'diamond', 'circle', 'square'];
    return shapes[index % shapes.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex flex-col">
      {/* Top Bar - Minimal */}
      <div className="bg-white/10 backdrop-blur-lg p-3 sm:p-4 flex justify-end items-center">
        <div className="text-white text-xs sm:text-sm">
          {nickname}
        </div>
      </div>

      {/* Main Content - Only Colored Blocks */}
      <div className={`flex-1 flex items-center justify-center p-3 sm:p-4 ${showColorAnimation ? colors[currentColorIndex] : 'bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500'} transition-colors duration-200`}>
        <div className="w-full max-w-md">
          {/* Answer Options - Only Colored Blocks (No Text) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {currentQuestion.options.map((option: any, index: number) => {
              const isSelected = selectedAnswer.includes(index);
              // Use animated color if animation is active, otherwise use normal color
              const colorClass = showColorAnimation ? colors[(currentColorIndex + index) % colors.length] : getAnswerColor(index);
              const shape = getAnswerShape(index);
              const isCorrect = showResultMessage && answerResult && option.isCorrect;
              const isWrong = showResultMessage && answerResult && isSelected && !option.isCorrect;

              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Button clicked for option:', index);
                    handleSelectAnswer(index);
                  }}
                  onTouchStart={(e) => {
                    // Prevent accidental touches on mobile
                    e.preventDefault();
                  }}
                  disabled={answered || timeRemaining === 0}
                  className={`${colorClass} rounded-2xl p-8 sm:p-10 lg:p-12 shadow-2xl transition-all transform ${
                    isSelected && !showColorAnimation
                      ? 'scale-110 ring-4 ring-white ring-offset-4 ring-offset-transparent'
                      : showColorAnimation
                      ? 'scale-105'
                      : 'hover:scale-105'
                  } ${
                    showResultMessage
                      ? isCorrect
                        ? 'ring-4 ring-green-300'
                        : isWrong
                        ? 'ring-4 ring-red-300 opacity-70'
                        : 'opacity-50'
                      : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex flex-col items-center justify-center">
                    {/* Shape Icon - Large */}
                    <div className="w-20 h-20 bg-white/30 rounded-xl flex items-center justify-center mb-4">
                      {shape === 'triangle' && (
                        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[35px] border-b-white"></div>
                      )}
                      {shape === 'diamond' && (
                        <div className="w-10 h-10 bg-white rotate-45"></div>
                      )}
                      {shape === 'circle' && (
                        <div className="w-10 h-10 bg-white rounded-full"></div>
                      )}
                      {shape === 'square' && (
                        <div className="w-10 h-10 bg-white"></div>
                      )}
                    </div>
                    {/* Show result icons only when result message is shown */}
                    {showResultMessage && isCorrect && (
                      <CheckCircle className="w-8 h-8 text-white" />
                    )}
                    {showResultMessage && isWrong && (
                      <XCircle className="w-8 h-8 text-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Answer Result - Below blocks - Only show when timer runs out */}
          {showResultMessage && answerResult && (
            <div className="mt-8 text-center animate-fade-in">
              <div
                className={`inline-block px-8 py-4 rounded-lg shadow-2xl ${
                  answerResult.isCorrect
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  {answerResult.isCorrect ? (
                    <>
                      <CheckCircle className="w-8 h-8" />
                      <span className="font-bold text-2xl">Correct!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-8 h-8" />
                      <span className="font-bold text-2xl">Incorrect</span>
                    </>
                  )}
                </div>
                <p className="text-lg mt-2 font-semibold">+{answerResult.points} points</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentGameScreen;

