import React from 'react';
import type { QuizWaveGameSummary, QuizWaveLeaderboardEntry } from '../../types/quizwaveGameState';

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod100 = n % 100;
  return n + (suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0]);
}

const MEDAL_TIER = {
  1: {
    label: '1st place',
    message: 'Epic win!',
    ring: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600',
    shadow: 'shadow-[0_8px_32px_rgba(250,204,21,0.55)]'
  },
  2: {
    label: '2nd place',
    message: 'Great job!',
    ring: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500',
    shadow: 'shadow-[0_8px_28px_rgba(148,163,184,0.5)]'
  },
  3: {
    label: '3rd place',
    message: 'Nice work!',
    ring: 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900',
    shadow: 'shadow-[0_8px_28px_rgba(180,83,9,0.45)]'
  }
} as const;

const OTHER_MESSAGES = [
  'Keep it up!',
  'So close!',
  'Solid run!',
  'Good effort!',
  'Nice try!'
];

interface StudentGameResultsProps {
  nickname: string;
  leaderboard: QuizWaveLeaderboardEntry[];
  gameSummary?: QuizWaveGameSummary | null;
  onDone: () => void;
}

const StudentGameResults: React.FC<StudentGameResultsProps> = ({
  nickname,
  leaderboard,
  gameSummary,
  onDone
}) => {
  const myIndex = leaderboard.findIndex((e) => e.nickname === nickname);
  const myEntry = myIndex >= 0 ? leaderboard[myIndex] : null;
  const myRank = myEntry?.rank ?? (myIndex >= 0 ? myIndex + 1 : 0);
  const myScore = myEntry?.totalScore ?? 0;
  const isTopThree = myRank >= 1 && myRank <= 3;
  const tier = isTopThree ? MEDAL_TIER[myRank as 1 | 2 | 3] : null;
  const otherMessage = OTHER_MESSAGES[(myRank - 1) % OTHER_MESSAGES.length];

  const myStats = gameSummary?.participantStats?.find((s) => s.nickname === nickname);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white min-h-[100dvh]">
      <header className="shrink-0 py-4 px-4 border-b border-gray-200 bg-white">
        <p className="text-center text-gray-800 font-semibold text-base sm:text-lg">Game finished</p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center bg-[#46178f] px-6 py-8 text-white">
        {isTopThree && tier ? (
          <>
            <div
              className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center mb-8 ${tier.ring} ${tier.shadow}`}
            >
              <span className="text-6xl sm:text-7xl font-black text-white drop-shadow-md">
                {myRank}
              </span>
            </div>

            <div className="flex items-center gap-4 w-full max-w-xs mb-6">
              <span className="h-px flex-1 bg-white/70" aria-hidden />
              <span className="text-2xl sm:text-3xl font-bold italic whitespace-nowrap">
                {tier.label}
              </span>
              <span className="h-px flex-1 bg-white/70" aria-hidden />
            </div>

            <p className="text-3xl sm:text-4xl font-bold text-center">{tier.message}</p>
          </>
        ) : (
          <>
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/15 flex items-center justify-center mb-8 ring-4 ring-white/25">
              <span className="text-5xl sm:text-6xl font-black tabular-nums">#{myRank || '—'}</span>
            </div>

            <div className="flex items-center gap-4 w-full max-w-xs mb-6">
              <span className="h-px flex-1 bg-white/70" aria-hidden />
              <span className="text-2xl sm:text-3xl font-bold italic whitespace-nowrap">
                {myRank > 0 ? `${ordinal(myRank)} place` : 'Finished'}
              </span>
              <span className="h-px flex-1 bg-white/70" aria-hidden />
            </div>

            <p className="text-2xl sm:text-3xl font-bold text-center">{otherMessage}</p>
          </>
        )}

        {myStats && (
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-white/85 text-center">
            <p>
              <span className="font-bold text-white">{myStats.accuracy}%</span> accuracy
            </p>
            <p>
              <span className="font-bold text-white">{myStats.correctAnswers}</span> correct
            </p>
          </div>
        )}
      </main>

      <footer className="shrink-0 flex items-center justify-between px-4 py-4 border-t border-gray-200 bg-white">
        <span className="text-gray-900 font-semibold text-base sm:text-lg truncate max-w-[55%]">
          {nickname}
        </span>
        <div className="bg-gray-900 text-white font-bold text-lg sm:text-xl px-4 py-2 rounded-md tabular-nums min-w-[4.5rem] text-center">
          {myScore.toLocaleString()}
        </div>
      </footer>

      <div className="shrink-0 px-4 pb-4 bg-white">
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3 rounded-lg bg-[#46178f] hover:bg-[#3a1275] text-white font-semibold transition-colors"
        >
          Join Another Game
        </button>
      </div>
    </div>
  );
};

export default StudentGameResults;
