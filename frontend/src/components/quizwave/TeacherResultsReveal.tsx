import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Download,
  RotateCcw,
  ListOrdered,
  Home,
  Users,
  Target,
  Flame
} from 'lucide-react';
import type { QuizWaveGameSummary, QuizWaveLeaderboardEntry } from '../../types/quizwaveGameState';

type RevealPhase = 'celebration' | 'compact' | 'rankings';

const CELEBRATION_MS = 10000;
const RANKINGS_DELAY_MS = 10500;
const CONFETTI_COLORS = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa', '#fb7185'];

interface TeacherResultsRevealProps {
  quizTitle: string;
  leaderboard: QuizWaveLeaderboardEntry[];
  gameSummary: QuizWaveGameSummary | null | undefined;
  totalQuestions: number;
  participantCount: number;
  onClose: () => void;
}

function ConfettiLayer({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 100}%`,
        delay: `${(i % 12) * 0.18}s`,
        duration: `${2.8 + (i % 5) * 0.35}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + (i % 4) * 2
      })),
    []
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 animate-qw-confetti rounded-sm opacity-90"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 1.4,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration
          }}
        />
      ))}
    </div>
  );
}

interface PodiumCardProps {
  entry: QuizWaveLeaderboardEntry;
  place: 1 | 2 | 3;
  variant: 'hero' | 'compact';
  visible: boolean;
  animationDelayMs: number;
  showGlow?: boolean;
}

function PodiumCard({
  entry,
  place,
  variant,
  visible,
  animationDelayMs,
  showGlow = false
}: PodiumCardProps) {
  const placeStyles = {
    1: {
      bar: 'bg-gradient-to-t from-amber-600 to-orange-500',
      ring: 'ring-yellow-300',
      avatar: 'bg-yellow-400 text-purple-900',
      height: variant === 'hero' ? 'min-h-[280px]' : 'min-h-[72px]',
      width: variant === 'hero' ? 'min-w-[160px] sm:min-w-[200px]' : 'min-w-[100px] flex-1'
    },
    2: {
      bar: 'bg-gradient-to-t from-slate-500 to-slate-400',
      ring: 'ring-slate-200',
      avatar: 'bg-slate-100 text-slate-800',
      height: variant === 'hero' ? 'min-h-[200px]' : 'min-h-[64px]',
      width: variant === 'hero' ? 'min-w-[130px] sm:min-w-[160px]' : 'min-w-[90px] flex-1'
    },
    3: {
      bar: 'bg-gradient-to-t from-amber-800 to-amber-700',
      ring: 'ring-amber-500/60',
      avatar: 'bg-amber-200 text-amber-900',
      height: variant === 'hero' ? 'min-h-[160px]' : 'min-h-[56px]',
      width: variant === 'hero' ? 'min-w-[120px] sm:min-w-[150px]' : 'min-w-[90px] flex-1'
    }
  } as const;

  const s = placeStyles[place];
  const initial = entry.nickname.charAt(0).toUpperCase();
  const streak = entry.streak ?? 0;

  return (
    <div
      className={`flex flex-col items-center transition-all duration-700 ease-out ${s.width} ${
        visible ? 'opacity-100 animate-qw-podium-slot' : 'opacity-0 translate-y-8'
      } ${showGlow ? 'animate-qw-gold-glow' : ''}`}
      style={{ animationDelay: visible ? `${animationDelayMs}ms` : undefined }}
    >
      {variant === 'hero' && (
        <div className="relative mb-3 sm:mb-4">
          <div
            className={`${s.avatar} rounded-full flex items-center justify-center font-black shadow-xl ring-4 ${s.ring} ${
              place === 1 ? 'w-24 h-24 sm:w-28 sm:h-28 text-4xl sm:text-5xl' : 'w-20 h-20 sm:w-24 sm:h-24 text-3xl sm:text-4xl'
            }`}
          >
            {initial}
          </div>
          {place === 1 && (
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-4xl" role="img" aria-label="crown">
              👑
            </span>
          )}
        </div>
      )}

      <div
        className={`${s.bar} ${s.height} w-full rounded-t-2xl px-3 py-3 sm:py-4 flex flex-col items-center justify-end text-center shadow-2xl ${
          variant === 'compact' ? 'rounded-xl flex-row items-center justify-between gap-2 px-3 py-2 min-h-0' : ''
        }`}
      >
        {variant === 'compact' ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`${s.avatar} w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0`}
              >
                {initial}
              </span>
              <div className="text-left min-w-0">
                <p className="text-white font-bold text-sm truncate">{entry.nickname}</p>
                <p className="text-white/80 text-xs tabular-nums">{entry.totalScore.toLocaleString()} pts</p>
              </div>
            </div>
            <span className="text-white/90 text-lg font-black">#{place}</span>
          </>
        ) : (
          <>
            <span className="text-white/80 text-sm font-semibold uppercase tracking-wide mb-1">
              {place === 1 ? 'Gold' : place === 2 ? 'Silver' : 'Bronze'}
            </span>
            <span className="text-white text-4xl sm:text-5xl font-black leading-none mb-2">{place}</span>
            <p className="text-white font-bold text-base sm:text-lg truncate max-w-full px-1">
              {entry.nickname}
            </p>
            <p className="text-white/90 text-sm sm:text-base font-semibold tabular-nums mt-1">
              {entry.totalScore.toLocaleString()} pts
            </p>
            {(entry.correctAnswers != null || streak >= 2) && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-xs text-white/90">
                {entry.correctAnswers != null && (
                  <span className="bg-black/20 px-2 py-0.5 rounded-full">
                    ✓ {entry.correctAnswers} correct
                  </span>
                )}
                {streak >= 2 && (
                  <span className="bg-purple-600/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Flame className="w-3 h-3" /> {streak}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const TeacherResultsReveal: React.FC<TeacherResultsRevealProps> = ({
  quizTitle,
  leaderboard,
  gameSummary,
  totalQuestions,
  participantCount,
  onClose
}) => {
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('celebration');
  const [slotVisible, setSlotVisible] = useState({ bronze: false, silver: false, gold: false });

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const avgScore =
    leaderboard.length > 0
      ? Math.round(leaderboard.reduce((s, e) => s + e.totalScore, 0) / leaderboard.length)
      : 0;

  useEffect(() => {
    if (leaderboard.length === 0) return;

    setRevealPhase('celebration');
    setSlotVisible({ bronze: false, silver: false, gold: false });

    const bronzeT = setTimeout(() => setSlotVisible((v) => ({ ...v, bronze: true })), 800);
    const silverT = setTimeout(() => setSlotVisible((v) => ({ ...v, silver: true })), 1400);
    const goldT = setTimeout(() => setSlotVisible((v) => ({ ...v, gold: true })), 2000);
    const compactT = setTimeout(() => setRevealPhase('compact'), CELEBRATION_MS);
    const rankingsT = setTimeout(() => setRevealPhase('rankings'), RANKINGS_DELAY_MS);

    return () => {
      clearTimeout(bronzeT);
      clearTimeout(silverT);
      clearTimeout(goldT);
      clearTimeout(compactT);
      clearTimeout(rankingsT);
    };
  }, [leaderboard]);

  const handleDownload = () => {
    const payload = {
      quizTitle,
      exportedAt: new Date().toISOString(),
      leaderboard,
      gameSummary
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quizwave-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showConfetti = revealPhase === 'celebration';
  const showHeroPodium = revealPhase === 'celebration';
  const showCompactStrip = revealPhase === 'compact' || revealPhase === 'rankings';
  const showRankingsList = revealPhase === 'rankings';

  if (leaderboard.length === 0) {
    return (
      <div className="min-h-screen bg-[#1a0a2e] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-lg">Preparing results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2d1b4e] via-[#1a0a2e] to-[#0f0518] text-white relative flex flex-col">
      <ConfettiLayer active={showConfetti} />

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.25)_0%,_transparent_65%)] animate-qw-celebrate-bg"
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-20 px-4 sm:px-6 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10">
        <div>
          <p className="text-purple-300 text-sm font-medium uppercase tracking-wider">QuizWave</p>
          <h1 className="text-xl sm:text-2xl font-bold">{quizTitle}</h1>
          <p className="text-white/70 text-sm mt-1">Quiz complete — celebrating champions</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-start sm:self-center px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
        >
          Close Session
        </button>
      </header>

      {/* Phase 2 — Full podium celebration */}
      {showHeroPodium && (
        <main className="relative z-20 flex-1 flex flex-col items-center justify-end px-4 pb-8 min-h-[420px] sm:min-h-[480px]">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-6 sm:mb-10 text-white drop-shadow-lg">
            🎉 Top 3 Champions
          </h2>
          <div className="w-full max-w-4xl animate-qw-podium-rise flex items-end justify-center gap-3 sm:gap-6">
            {second && (
              <PodiumCard
                entry={second}
                place={2}
                variant="hero"
                visible={slotVisible.silver}
                animationDelayMs={0}
              />
            )}
            {first && (
              <PodiumCard
                entry={first}
                place={1}
                variant="hero"
                visible={slotVisible.gold}
                animationDelayMs={0}
                showGlow
              />
            )}
            {third && (
              <PodiumCard
                entry={third}
                place={3}
                variant="hero"
                visible={slotVisible.bronze}
                animationDelayMs={0}
              />
            )}
          </div>
          {!second && first && (
            <p className="text-white/60 text-sm mt-6">Single player session</p>
          )}
        </main>
      )}

      {/* Phase 3 — Compact podium strip (pinned) */}
      {showCompactStrip && (
        <section
          className={`relative z-30 px-4 sm:px-6 transition-all duration-700 ease-in-out ${
            showHeroPodium ? 'pt-4' : 'pt-2'
          } ${showRankingsList ? 'sticky top-0 bg-[#1a0a2e]/95 backdrop-blur-md border-b border-white/10 shadow-lg' : ''}`}
        >
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide text-purple-200">
                Top 3 Champions
              </h3>
            </div>
            <div className="flex items-stretch justify-center gap-2 sm:gap-3 max-w-3xl mx-auto">
              {second && (
                <PodiumCard entry={second} place={2} variant="compact" visible animationDelayMs={0} />
              )}
              {first && (
                <PodiumCard
                  entry={first}
                  place={1}
                  variant="compact"
                  visible
                  animationDelayMs={0}
                  showGlow
                />
              )}
              {third && (
                <PodiumCard entry={third} place={3} variant="compact" visible animationDelayMs={0} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Phase 4 — Stats + full rankings */}
      {showRankingsList && (
        <section className="relative z-20 flex-1 flex flex-col px-4 sm:px-6 pb-4 min-h-0">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 shrink-0">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-purple-300" />
                <p className="text-2xl font-bold tabular-nums">{participantCount}</p>
                <p className="text-xs text-white/70">Players</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <ListOrdered className="w-5 h-5 mx-auto mb-1 text-purple-300" />
                <p className="text-2xl font-bold tabular-nums">{totalQuestions}</p>
                <p className="text-xs text-white/70">Questions</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-purple-300" />
                <p className="text-2xl font-bold tabular-nums">{avgScore.toLocaleString()}</p>
                <p className="text-xs text-white/70">Avg score</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                <p className="text-2xl font-bold tabular-nums truncate">
                  {first?.nickname ?? '—'}
                </p>
                <p className="text-xs text-white/70">Winner</p>
              </div>
            </div>

            {gameSummary?.mvpBadges && Object.keys(gameSummary.mvpBadges).length > 0 && (
              <div className="mb-3 text-xs text-white/80 bg-white/5 rounded-lg px-3 py-2 shrink-0">
                {gameSummary.mvpBadges.fastestAnswer && (
                  <span className="mr-3">⚡ {gameSummary.mvpBadges.fastestAnswer.nickname}</span>
                )}
                {gameSummary.mvpBadges.longestStreak && (
                  <span className="mr-3">🔥 {gameSummary.mvpBadges.longestStreak.nickname}</span>
                )}
                {gameSummary.mvpBadges.highestAccuracy && (
                  <span>🎯 {gameSummary.mvpBadges.highestAccuracy.nickname}</span>
                )}
              </div>
            )}

            <h3 className="text-lg font-bold mb-3 shrink-0">Full rankings</h3>

            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-black/20 pr-1">
              {rest.length === 0 ? (
                <p className="text-center text-white/60 py-8 text-sm">
                  {top3.length <= 3 ? 'Only top 3 players in this session.' : 'No additional ranks.'}
                </p>
              ) : (
                <ul className="divide-y divide-white/10 p-2">
                  {rest.map((entry, idx) => (
                    <li
                      key={entry.studentId || entry.nickname}
                      className="flex items-center justify-between gap-3 py-3 px-2 opacity-0 animate-qw-rank-in"
                      style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'forwards' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg font-bold text-purple-300 w-8 tabular-nums">
                          #{entry.rank ?? idx + 4}
                        </span>
                        <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-bold shrink-0">
                          {entry.nickname.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold truncate">{entry.nickname}</span>
                        {(entry.streak ?? 0) >= 2 && (
                          <span className="text-xs bg-purple-600/60 px-2 py-0.5 rounded-full shrink-0">
                            🔥 {entry.streak}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold tabular-nums">{entry.totalScore.toLocaleString()}</p>
                        {entry.correctAnswers != null && (
                          <p className="text-xs text-white/60">{entry.correctAnswers} correct</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bottom actions */}
      <footer className="relative z-20 shrink-0 border-t border-white/10 bg-[#0f0518]/90 backdrop-blur px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end">
          <button
            type="button"
            onClick={() => window.alert('Question review coming soon — use quiz editor for now.')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
            Review Questions
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Results
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-purple-900 hover:bg-purple-50 text-sm font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Lobby
          </button>
        </div>
      </footer>
    </div>
  );
};

export default TeacherResultsReveal;
