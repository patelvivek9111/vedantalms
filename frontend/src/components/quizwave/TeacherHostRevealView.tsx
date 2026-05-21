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

/** Height of the fill area above the shape base (px). */
const BAR_FILL_MAX_PX = 88;

function ShapeIcon({ shape, size = 'sm' }: { shape: string; size?: 'sm' | 'md' }) {
  if (shape === 'triangle') {
    const tri =
      size === 'md'
        ? 'border-l-[10px] border-r-[10px] border-b-[17px]'
        : 'border-l-[8px] border-r-[8px] border-b-[13px]';
    return (
      <div
        className={`h-0 w-0 border-l-transparent border-r-transparent border-b-white ${tri}`}
        aria-hidden
      />
    );
  }
  const dim = size === 'md' ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4';
  if (shape === 'diamond') return <div className={`${dim} rotate-45 bg-white`} aria-hidden />;
  if (shape === 'circle') return <div className={`${dim} rounded-full bg-white`} aria-hidden />;
  return <div className={`${dim} bg-white`} aria-hidden />;
}

interface TeacherHostRevealViewProps {
  questionText: string;
  options: Array<{ text: string; isCorrect?: boolean }>;
  answerDistribution: Record<number, number>;
  showCorrectMarks: boolean;
}

/** Kahoot-style reveal: tinted bar columns + 2×2 choices below. */
const TeacherHostRevealView: React.FC<TeacherHostRevealViewProps> = ({
  questionText,
  options,
  answerDistribution,
  showCorrectMarks
}) => {
  const optionCount = options.length;
  const maxCount = Math.max(...Object.values(answerDistribution), 1);
  const totalResponses = Object.values(answerDistribution).reduce((sum, n) => sum + n, 0);

  const chartColsClass =
    optionCount === 2 ? 'grid-cols-2' : optionCount === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <div className="shrink-0 text-center">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {showCorrectMarks ? 'Answer reveal' : 'Live responses'}
        </p>
        <h1 className="text-base font-bold leading-snug text-slate-900 break-words sm:text-lg dark:text-white">
          {questionText}
        </h1>
      </div>

      <div className="shrink-0">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
            Response breakdown
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
          </span>
        </div>

        <div className={`grid w-full gap-3 sm:gap-4 ${chartColsClass}`}>
          {options.map((opt, idx) => {
            const style = ANSWER_STYLES[idx % 4];
            const count = answerDistribution[idx] || 0;
            const fillHeightPx =
              maxCount > 0 ? Math.max((count / maxCount) * BAR_FILL_MAX_PX, count > 0 ? 18 : 0) : 0;
            const isCorrect = showCorrectMarks && opt.isCorrect;

            return (
              <div
                key={`bar-${idx}`}
                className={`flex w-full min-w-0 flex-col items-center rounded-xl px-1 py-0.5 sm:px-1.5 ${
                  isCorrect ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''
                }`}
              >
                <div className="mb-2 flex h-9 items-end justify-center gap-1">
                  {isCorrect && (
                    <Check className="mb-0.5 h-5 w-5 text-amber-500" strokeWidth={3} aria-hidden />
                  )}
                  <span className={`text-3xl font-bold tabular-nums sm:text-4xl ${style.count}`}>
                    {count}
                  </span>
                </div>

                <div
                  className={`flex w-full flex-col overflow-hidden rounded-[1.25rem] ${style.track}`}
                >
                  <div
                    className="flex flex-col justify-end px-2.5 pt-3 sm:px-3"
                    style={{ minHeight: `${BAR_FILL_MAX_PX + 52}px` }}
                  >
                    {fillHeightPx > 0 && (
                      <div
                        className={`w-full rounded-t-xl ${style.bar} transition-all duration-500 ease-out`}
                        style={{ height: `${fillHeightPx}px` }}
                      />
                    )}
                  </div>
                  <div className={`mx-2.5 h-1 shrink-0 rounded-full sm:mx-3 ${style.bar}`} aria-hidden />
                  <div
                    className={`mx-2 mb-2 mt-1 flex h-11 shrink-0 items-center justify-center rounded-xl sm:mx-2.5 sm:h-12 ${style.base}`}
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
              className={`flex min-h-[56px] items-center gap-2 rounded-xl p-2.5 shadow-md ring-1 ring-white/20 sm:min-h-[64px] sm:gap-3 sm:p-3 ${style.tile} ${
                isCorrect ? 'ring-2 ring-white/90' : ''
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/15 sm:h-10 sm:w-10">
                <ShapeIcon shape={style.shape} size="md" />
              </div>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold leading-tight text-white sm:text-sm">
                <span className="line-clamp-3 break-words">{opt.text}</span>
                {isCorrect && (
                  <Check
                    className="h-6 w-6 shrink-0 text-white sm:h-7 sm:w-7"
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
