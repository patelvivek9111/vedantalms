import React, { useState, useEffect, useCallback } from 'react';
import { getQuizWaveSocket } from '../../utils/quizwaveSocket';
import { quizwaveService, Quiz, QuizSession } from '../../services/quizwaveService';
import { useAuth } from '../../contexts/AuthContext';
import {
  Play,
  SkipForward,
  Users,
  Trophy,
  Copy,
  Check,
  Clock,
  Gamepad2,
  ListChecks,
  Radio
} from 'lucide-react';
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
  const answerPercent =
    participantCount > 0 ? Math.round((answerCount / participantCount) * 100) : 0;

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
      sock.off('quizwave:game-state');
      sock.off('quizwave:ended');

      sock.on('quizwave:game-state', (snap: QuizWaveGameSnapshot) => {
        applySnapshot(snap);
      });

      sock.on('quizwave:teacher-joined', (data) => {
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
        setParticipantCount(data.participantCount);
        // Update participants list directly from socket data if available
        if (data.participants && Array.isArray(data.participants)) {
          setParticipants(data.participants);
        } else {
          // Fallback: reload session to get updated participants list
          loadSession();
        }
      });

      sock.on('quizwave:ended', (data: { leaderboard?: any[]; gameSummary?: QuizWaveGameSnapshot['gameSummary'] }) => {
        setLeaderboard(data.leaderboard || []);
        if (data.gameSummary) setGameSummary(data.gameSummary);
        setGameSnapshot((prev) =>
          prev
            ? {
                ...prev,
                phase: 'FINISHED',
                status: 'ended',
                leaderboard: data.leaderboard || prev.leaderboard,
                gameSummary: data.gameSummary || prev.gameSummary,
                question: undefined
              }
            : prev
        );
        setSession((prev) => (prev ? { ...prev, status: 'ended' as const } : null));
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
        sock.off('quizwave:game-state');
        sock.off('quizwave:ended');
      }
    };
  }, [sessionId, token, applySnapshot]);

  const handleStart = () => {
    if (socket && socket.connected) {
      socket.emit('quizwave:start', { sessionId });
    } else {
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

  const handleShowResults = () => {
    handleNextQuestion();
  };

  const handleCloseSession = () => {
    if (socket?.connected) {
      socket.emit('quizwave:end', { sessionId });
    }
    onEnd();
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-800 dark:border-t-indigo-400" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading session…</p>
        </div>
      </div>
    );
  }

  const HOST_ANSWER_TILES = [
    { tile: 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-900/20', shape: 'triangle' as const },
    { tile: 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-900/20', shape: 'diamond' as const },
    { tile: 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-amber-900/20', shape: 'circle' as const },
    { tile: 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-900/20', shape: 'square' as const }
  ];

  const getAnswerTile = (index: number) => HOST_ANSWER_TILES[index % HOST_ANSWER_TILES.length];

  const quizContent = (
    <div className="h-full min-h-0 bg-gray-50 dark:bg-gray-900">
      {/* Waiting Screen */}
      {isWaiting && (
        <div className="h-full min-h-0 overflow-y-auto bg-slate-50/80 p-4 sm:p-6 lg:p-8 dark:bg-slate-950">
          <div className="mx-auto max-w-3xl">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <Gamepad2 className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                    {quiz.title}
                  </h1>
                  <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                    </span>
                    Waiting for players
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSession}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-950"
              >
                Close session
              </button>
            </div>

            {/* Game PIN */}
            <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 sm:mb-6">
              <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" aria-hidden />
              <div className="p-6 sm:p-8">
                <div className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <Radio className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
                  Game PIN
                </div>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
                  <p
                    className="font-mono text-5xl font-bold tracking-[0.2em] text-slate-900 tabular-nums sm:text-6xl lg:text-7xl dark:text-white"
                    aria-label={`Game PIN ${session.gamePin}`}
                  >
                    {session.gamePin.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}
                  </p>
                  <button
                    type="button"
                    onClick={copyGamePin}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 dark:focus:ring-offset-slate-900"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden />
                        Copy PIN
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
                  Students enter this PIN at join to enter your lobby
                </p>
              </div>
            </section>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                  <Users className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{participantCount}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Participants</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <ListChecks className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{quiz.questions.length}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Questions</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                  <Trophy className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {leaderboard.length > 0 ? leaderboard[0].totalScore : 0}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Top score</p>
                </div>
              </div>
            </div>

            {/* Start + roster */}
            <div className="flex flex-col items-center gap-5">
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:w-auto sm:min-w-[280px] dark:focus:ring-offset-slate-950"
              >
                <Play className="h-5 w-5 fill-current" aria-hidden />
                Start quiz
              </button>

              {participants.length > 0 && (
                <section className="w-full rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/80">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Joined students</h2>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {participants.length}
                    </span>
                  </div>
                  <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/80">
                    {participants.map((participant: { nickname: string }, index: number) => (
                      <li
                        key={`${participant.nickname}-${index}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                          {participant.nickname.charAt(0).toUpperCase()}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                          {participant.nickname}
                        </span>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Connected" />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {participants.length === 0 && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  Waiting for students to join with the game PIN…
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active question — teacher host view */}
      {isActive && currentQuestion && (
        <div className="flex h-full min-h-0 flex-col bg-slate-100/90 dark:bg-slate-950">
          {/* Top bar */}
          <header className="shrink-0 border-b border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
              <div className="flex justify-start">
                <div
                  className="inline-flex w-fit max-w-full shrink-0 items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50 px-4 py-2 shadow-md dark:border-slate-600/80 dark:bg-slate-800/90 sm:px-5 sm:py-2.5"
                  title={`${answerCount} of ${participantCount} participants answered`}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    {phase === 'QUESTION_ACTIVE' && answerPercent < 100 && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                    )}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        answerPercent >= 100 ? 'bg-emerald-500' : 'bg-violet-500'
                      }`}
                    />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Answered
                  </span>
                  <span className="text-lg font-bold tabular-nums leading-none text-slate-900 dark:text-white sm:text-xl">
                    {answerPercent}
                    <span className="ml-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">%</span>
                  </span>
                </div>
              </div>

              <div className="inline-flex w-fit max-w-full shrink-0 items-stretch justify-center overflow-hidden rounded-full border border-slate-200/90 bg-slate-50 shadow-md dark:border-slate-600/80 dark:bg-slate-800/90">
                <div className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Question
                  </span>
                  <span className="text-lg font-bold tabular-nums leading-none text-slate-900 dark:text-white sm:text-xl">
                    {currentQuestionIndex + 1}
                    <span className="font-semibold text-slate-400 dark:text-slate-500">
                      /{quiz.questions.length}
                    </span>
                  </span>
                </div>
                {(phase === 'QUESTION_ACTIVE' || phase === 'TRANSITION') && (
                  <div
                    className={`flex items-center gap-2 border-l border-slate-200/90 px-4 py-2 sm:px-5 sm:py-2.5 dark:border-slate-600/80 ${
                      timeRemaining <= 5
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <Clock className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    <span className="text-lg font-bold tabular-nums leading-none sm:text-xl">
                      {timeRemaining}
                      <span className="ml-0.5 text-sm font-semibold opacity-90">s</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <div className="inline-flex w-fit max-w-full shrink-0 items-stretch overflow-hidden rounded-full border border-slate-200/90 bg-slate-50 shadow-md dark:border-slate-600/80 dark:bg-slate-800/90">
                  <div className="flex shrink-0 items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5">
                    <Users className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Joined
                    </span>
                    <span className="text-lg font-bold tabular-nums leading-none text-slate-900 dark:text-white sm:text-xl">
                      {participantCount}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseSession}
                    className="shrink-0 border-l border-slate-200/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600/80 dark:text-slate-300 dark:hover:bg-slate-700/80 sm:px-5 sm:py-2.5"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main stage */}
          <main
            className={`min-h-0 flex-1 overflow-y-auto ${
              isHostDistribution ? 'p-2 sm:p-3' : 'p-3 sm:p-4 lg:p-5'
            }`}
          >
            <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-col">
              {!isHostDistribution && (
                <section className="mb-3 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 sm:mb-4 sm:rounded-2xl">
                  <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" aria-hidden />
                  <div className="px-4 py-4 text-center sm:px-6 sm:py-5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Question {currentQuestionIndex + 1}
                    </p>
                    <h1 className="text-lg font-bold leading-snug text-slate-900 break-words sm:text-xl lg:text-2xl dark:text-white">
                      {currentQuestion.questionText}
                    </h1>
                  </div>
                </section>
              )}

              {isHostDistribution && (
                <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 sm:rounded-2xl sm:p-4">
                  <TeacherHostRevealView
                    questionText={currentQuestion.questionText}
                    options={currentQuestion.options}
                    answerDistribution={answerDistribution}
                    showCorrectMarks={hostRevealCorrectOnChart}
                    participantCount={Math.max(participantCount, 1)}
                  />
                </div>
              )}

              {isHostLiveQuestion && (
                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  {currentQuestion.options.map((opt: { text: string }, idx: number) => {
                    const { tile, shape } = getAnswerTile(idx);
                    return (
                      <div
                        key={idx}
                        className={`flex min-h-[72px] items-center gap-3 rounded-xl p-3 shadow-lg ring-1 ring-white/20 sm:min-h-[80px] sm:gap-4 sm:p-4 ${tile}`}
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/15 sm:h-14 sm:w-14">
                          {shape === 'triangle' && (
                            <div className="h-0 w-0 border-l-[11px] border-r-[11px] border-b-[18px] border-l-transparent border-r-transparent border-b-white" />
                          )}
                          {shape === 'diamond' && <div className="h-5 w-5 rotate-45 bg-white sm:h-6 sm:w-6" />}
                          {shape === 'circle' && <div className="h-5 w-5 rounded-full bg-white sm:h-6 sm:w-6" />}
                          {shape === 'square' && <div className="h-5 w-5 bg-white sm:h-6 sm:w-6" />}
                        </div>
                        <span className="text-base font-semibold leading-snug text-white break-words sm:text-lg lg:text-xl">
                          {opt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {isHostTransition && countdown > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-indigo-200 bg-white shadow-2xl sm:h-36 sm:w-36 dark:border-indigo-500/40 dark:bg-slate-900">
                    <span className="text-5xl font-bold tabular-nums text-indigo-600 animate-pulse sm:text-6xl dark:text-indigo-400">
                      {countdown}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Bottom controls */}
          <footer className="shrink-0 border-t border-slate-200/90 bg-white/95 px-3 py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 sm:px-4 sm:py-3">
            <div className="mx-auto flex max-w-5xl justify-center">
              {currentQuestionIndex < quiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={phase === 'QUESTION_ACTIVE'}
                  className="inline-flex min-h-[44px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[280px] dark:focus:ring-offset-slate-900"
                >
                  <SkipForward className="h-4 w-4" aria-hidden />
                  {phase === 'QUESTION_ACTIVE' ? 'Waiting for answers…' : 'Next question'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleShowResults}
                  disabled={phase === 'QUESTION_ACTIVE'}
                  className="inline-flex min-h-[44px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[280px] dark:focus:ring-offset-slate-900"
                >
                  <Trophy className="h-4 w-4" aria-hidden />
                  {phase === 'QUESTION_ACTIVE' ? 'Waiting for answers…' : 'Show results'}
                </button>
              )}
            </div>
          </footer>
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
      <div className="fixed inset-0 left-0 z-[60] flex h-full flex-col overflow-hidden bg-slate-100/90 dark:bg-slate-950 lg:left-20">
        <div className="min-h-0 flex-1 overflow-hidden">{quizContent}</div>
      </div>
    );
  }

  return quizContent;
};

export default QuizSessionControl;












