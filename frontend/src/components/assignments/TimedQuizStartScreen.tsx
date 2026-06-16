import React from 'react';
import { AlertTriangle, Calendar, Clock, FileQuestion, Target } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';

interface TimedQuizStartScreenProps {
  quizTimeLimit: number;
  questionCount: number;
  totalPoints: number;
  dueDate: string;
  displayMode: 'single' | 'scrollable';
  onStart: () => void;
  isStarting?: boolean;
}

const TimedQuizStartScreen: React.FC<TimedQuizStartScreenProps> = ({
  quizTimeLimit,
  questionCount,
  totalPoints,
  dueDate,
  displayMode,
  onStart,
  isStarting = false,
}) => {
  const navigationHint =
    displayMode === 'single'
      ? 'Move between questions using the bottom navigation bar.'
      : 'All questions are on one page — scroll to answer each one.';

  return (
    <>
      <div className="mx-3 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mx-0 sm:mt-6">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" aria-hidden />
        <div className="px-4 py-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Clock className="h-7 w-7" strokeWidth={2} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Timed quiz
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              Ready to begin?
            </h2>
            <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
              {quizTimeLimit}
              <span className="ml-1 text-lg font-semibold text-slate-500 dark:text-slate-400">min</span>
            </p>
            <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
              The timer starts as soon as you tap Start. It cannot be paused once begun.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center dark:border-slate-700 dark:bg-slate-800/80 sm:px-3">
              <FileQuestion className="mx-auto mb-1 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-lg font-bold text-slate-900 dark:text-white">{questionCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                Questions
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center dark:border-slate-700 dark:bg-slate-800/80 sm:px-3">
              <Target className="mx-auto mb-1 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-lg font-bold text-slate-900 dark:text-white">{totalPoints}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                Points
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center dark:border-slate-700 dark:bg-slate-800/80 sm:px-3">
              <Calendar className="mx-auto mb-1 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white sm:text-base">
                {safeFormatDate(dueDate, 'MMM d')}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                Due
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <ul className="space-y-1.5 text-left text-sm text-amber-900 dark:text-amber-100">
                <li>Your attempt is submitted automatically when time runs out.</li>
                <li>{navigationHint}</li>
                <li>Bookmark questions you want to revisit before submitting.</li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            disabled={isStarting}
            className="mt-6 hidden min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600 sm:inline-flex"
          >
            {isStarting ? 'Starting…' : 'Start quiz'}
          </button>
        </div>
      </div>

      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[140] border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950 sm:hidden">
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {isStarting ? 'Starting…' : 'Start quiz'}
        </button>
      </div>
    </>
  );
};

export default TimedQuizStartScreen;
