import React from 'react';
import { Check, BarChart3 } from 'lucide-react';

const ANSWER_STYLES = [
  {
    tile: 'bg-gradient-to-br from-rose-500 to-rose-600',
    track: 'bg-rose-100 dark:bg-rose-950/50',
    bar: 'bg-rose-500',
    base: 'bg-rose-600',
    count: 'text-rose-600 dark:text-rose-400',
    shape: 'triangle' as const
  },
  {
    tile: 'bg-gradient-to-br from-sky-500 to-blue-600',
    track: 'bg-sky-100 dark:bg-sky-950/50',
    bar: 'bg-blue-500',
    base: 'bg-blue-600',
    count: 'text-blue-600 dark:text-blue-400',
    shape: 'diamond' as const
  },
  {
    tile: 'bg-gradient-to-br from-amber-400 to-amber-500',
    track: 'bg-amber-100 dark:bg-amber-950/50',
    bar: 'bg-amber-400',
    base: 'bg-amber-500',
    count: 'text-amber-600 dark:text-amber-400',
    shape: 'circle' as const
  },
  {
    tile: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    track: 'bg-emerald-100 dark:bg-emerald-950/50',
    bar: 'bg-emerald-500',
    base: 'bg-emerald-600',
    count: 'text-emerald-600 dark:text-emerald-400',
    shape: 'square' as const
  }
] as const;

function ShapeIcon({ shape, size = 'sm' }: { shape: string; size?: 'sm' | 'md' }) {
  if (shape === 'triangle') {
    const tri =
      size === 'md'
        ? 'border-l-[10px] border-r-[10px] border-b-[17px]'
        : 'border-l-[7px] border-r-[7px] border-b-[12px]';
    return (
      <div
        className={`h-0 w-0 border-l-transparent border-r-transparent border-b-white ${tri}`}
        aria-hidden
      />
    );
  }
  const dim = size === 'md' ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-3.5 w-3.5 sm:h-4 sm:w-4';
  if (shape === 'diamond') return <div className={`${dim} rotate-45 bg-white`} aria-hidden />;
  if (shape === 'circle') return <div className={`${dim} rounded-full bg-white`} aria-hidden />;
  return <div className={`${dim} bg-white`} aria-hidden />;
}

interface TeacherHostRevealViewProps {
  questionText: string;
  options: Array<{ text: string; isCorrect?: boolean }>;
  answerDistribution: Record<number, number>;
  showCorrectMarks: boolean;
  /** Total players in session — bar height = count / participantCount */
  participantCount: number;
}

/** Kahoot-style reveal: tinted bar columns + 2×2 choice grid below. */
const TeacherHostRevealView: React.FC<TeacherHostRevealViewProps> = ({
  questionText,
  options,
  answerDistribution,
  showCorrectMarks,
  participantCount
}) => {
  const optionCount = options.length;
  const totalResponses = Object.values(answerDistribution).reduce((sum, n) => sum + n, 0);
  const barDenominator = Math.max(participantCount, 1);

  const chartColsClass =
    optionCount === 2
      ? 'grid-cols-2'
      : optionCount === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-3">
      <div className="shrink-0 text-center px-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {showCorrectMarks ? 'Answer reveal' : 'Live responses'}
        </p>
        <h1 className="text-sm font-bold leading-snug text-slate-900 break-words sm:text-base md:text-lg dark:text-white">
          {questionText}
        </h1>
      </div>

      <div className="shrink-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <BarChart3 className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
            Response breakdown
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {totalResponses} of {participantCount}{' '}
            {participantCount === 1 ? 'player' : 'players'}
          </span>
        </div>

        <div className={`grid w-full gap-2 sm:gap-3 md:gap-4 ${chartColsClass}`}>
          {options.map((opt, idx) => {
            const style = ANSWER_STYLES[idx % 4];
            const count = answerDistribution[idx] || 0;
            const fillPercent = Math.min(100, (count / barDenominator) * 100);
            const isCorrect = showCorrectMarks && opt.isCorrect;

            return (
              <div
                key={`bar-${idx}`}
                className={`flex w-full min-w-0 flex-col items-center rounded-xl px-0.5 py-0.5 sm:px-1 ${
                  isCorrect ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white sm:ring-offset-2 dark:ring-offset-slate-900' : ''
                }`}
              >
                <div className="mb-1.5 flex h-8 items-end justify-center gap-0.5 sm:mb-2 sm:h-9">
                  {isCorrect && (
                    <Check className="mb-0.5 h-4 w-4 text-amber-500 sm:h-5 sm:w-5" strokeWidth={3} aria-hidden />
                  )}
                  <span className={`text-2xl font-bold tabular-nums sm:text-3xl md:text-4xl ${style.count}`}>
                    {count}
                  </span>
                </div>

                <div
                  className={`flex w-full min-w-0 flex-col overflow-hidden rounded-2xl sm:rounded-[1.25rem] ${style.track}`}
                >
                  {/* Fixed fill zone — 100% = all participants chose this option */}
                  <div className="mx-2 mt-2 flex h-16 flex-col justify-end sm:mx-2.5 sm:mt-3 sm:h-20 md:h-24">
                    {fillPercent > 0 && (
                      <div
                        className={`w-full min-h-[3px] rounded-t-lg sm:rounded-t-xl ${style.bar} transition-all duration-500 ease-out`}
                        style={{ height: `${fillPercent}%` }}
                      />
                    )}
                  </div>
                  <div className={`mx-2 h-0.5 shrink-0 rounded-full sm:mx-2.5 sm:h-1 ${style.bar}`} aria-hidden />
                  <div
                    className={`mx-1.5 mb-1.5 mt-0.5 flex h-9 shrink-0 items-center justify-center rounded-lg sm:mx-2 sm:mb-2 sm:h-10 sm:rounded-xl md:h-11 ${style.base}`}
                  >
                    <ShapeIcon shape={style.shape} size="md" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-3">
        {options.map((opt, idx) => {
          const style = ANSWER_STYLES[idx % 4];
          const isCorrect = showCorrectMarks && opt.isCorrect;

          return (
            <div
              key={`choice-${idx}`}
              className={`flex min-h-[52px] items-center gap-2 rounded-xl p-2 shadow-md ring-1 ring-white/20 sm:min-h-[60px] sm:gap-3 sm:p-2.5 md:min-h-[64px] md:p-3 ${style.tile} ${
                isCorrect ? 'ring-2 ring-white/90' : ''
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/15 sm:h-9 sm:w-9 md:h-10 md:w-10">
                <ShapeIcon shape={style.shape} size="md" />
              </div>
              <span className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-semibold leading-tight text-white sm:text-xs md:text-sm">
                <span className="line-clamp-3 break-words">{opt.text}</span>
                {isCorrect && (
                  <Check
                    className="h-5 w-5 shrink-0 text-white sm:h-6 sm:w-6"
                    strokeWidth={3}
                    aria-label="Correct answer"
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeacherHostRevealView;
