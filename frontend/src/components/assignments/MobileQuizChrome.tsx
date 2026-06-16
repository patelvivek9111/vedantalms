import React from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Circle, X } from 'lucide-react';

interface MobileQuizChromeProps {
  mode: 'single' | 'scrollable';
  currentQuestion: number;
  totalQuestions: number;
  questions: { points: number }[];
  answeredQuestions: Set<number>;
  markedQuestions: Set<number>;
  isSubmitting: boolean;
  showQuestionPicker: boolean;
  onOpenQuestionPicker: () => void;
  onCloseQuestionPicker: () => void;
  onSelectQuestion: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

const QuestionStatusIcon: React.FC<{
  index: number;
  answered: boolean;
  marked: boolean;
  active: boolean;
}> = ({ answered, marked, active }) => {
  if (answered && marked) {
    return (
      <span className="relative inline-flex">
        <Circle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
        <Bookmark className="absolute -right-1 -top-1 h-2.5 w-2.5 fill-amber-400 text-amber-400" />
      </span>
    );
  }
  if (answered) {
    return <Circle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />;
  }
  if (marked) {
    return <Bookmark className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />;
  }
  return (
    <span
      className={`h-2 w-2 rounded-full ${active ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`}
    />
  );
};

export const MobileQuizProgress: React.FC<{
  answeredCount: number;
  totalQuestions: number;
  currentQuestion: number;
  mode: 'single' | 'scrollable';
  timeLeft?: number | null;
  showTimer?: boolean;
  formatTime?: (seconds: number) => string;
}> = ({ answeredCount, totalQuestions, currentQuestion, mode, timeLeft, showTimer, formatTime }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 lg:hidden">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {mode === 'single' ? `Question ${currentQuestion + 1} of ${totalQuestions}` : 'Progress'}
      </span>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {answeredCount} of {totalQuestions} answered
      </span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500"
        style={{ width: `${(answeredCount / Math.max(totalQuestions, 1)) * 100}%` }}
      />
    </div>
    {showTimer && timeLeft != null && formatTime && (
      <p
        className={`mt-2 text-center text-sm font-semibold tabular-nums ${
          timeLeft <= 300 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
        }`}
        role="status"
        aria-live="polite"
      >
        {formatTime(timeLeft)} remaining
      </p>
    )}
  </div>
);

export const MobileQuestionPills: React.FC<{
  totalQuestions: number;
  currentQuestion: number;
  answeredQuestions: Set<number>;
  markedQuestions: Set<number>;
  onSelectQuestion: (index: number) => void;
}> = ({ totalQuestions, currentQuestion, answeredQuestions, markedQuestions, onSelectQuestion }) => (
  <div className="lg:hidden">
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none snap-x snap-mandatory">
      {Array.from({ length: totalQuestions }, (_, index) => {
        const isActive = currentQuestion === index;
        const isAnswered = answeredQuestions.has(index);
        const isMarked = markedQuestions.has(index);
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectQuestion(index)}
            aria-label={`Go to question ${index + 1}`}
            aria-current={isActive ? 'step' : undefined}
            className={`flex min-h-[44px] min-w-[44px] shrink-0 snap-center items-center justify-center rounded-xl border text-sm font-semibold transition active:scale-95 ${
              isActive
                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-500'
                : isAnswered
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : isMarked
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  </div>
);

export const MobileQuestionPicker: React.FC<{
  open: boolean;
  totalQuestions: number;
  questions: { points: number }[];
  currentQuestion: number;
  answeredQuestions: Set<number>;
  markedQuestions: Set<number>;
  onClose: () => void;
  onSelectQuestion: (index: number) => void;
}> = ({
  open,
  totalQuestions,
  questions,
  currentQuestion,
  answeredQuestions,
  markedQuestions,
  onClose,
  onSelectQuestion,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] lg:hidden" role="dialog" aria-modal="true" aria-label="Question list">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close question list"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">All questions</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(70vh-3.5rem)] overflow-y-auto p-3">
          <div className="space-y-2">
            {Array.from({ length: totalQuestions }, (_, index) => {
              const isActive = currentQuestion === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    onSelectQuestion(index);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <QuestionStatusIcon
                      index={index}
                      answered={answeredQuestions.has(index)}
                      marked={markedQuestions.has(index)}
                      active={isActive}
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Question {index + 1}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{questions[index]?.points ?? 0} pts</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileQuizChrome: React.FC<MobileQuizChromeProps> = ({
  mode,
  currentQuestion,
  totalQuestions,
  questions,
  answeredQuestions,
  markedQuestions,
  isSubmitting,
  showQuestionPicker,
  onOpenQuestionPicker,
  onCloseQuestionPicker,
  onSelectQuestion,
  onPrev,
  onNext,
  onSubmit,
}) => {
  const isLastQuestion = currentQuestion >= totalQuestions - 1;

  return (
    <>
      <MobileQuestionPicker
        open={showQuestionPicker}
        totalQuestions={totalQuestions}
        questions={questions}
        currentQuestion={currentQuestion}
        answeredQuestions={answeredQuestions}
        markedQuestions={markedQuestions}
        onClose={onCloseQuestionPicker}
        onSelectQuestion={onSelectQuestion}
      />

      <div className="mobile-keyboard-dismiss fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[140] border-t border-slate-200/90 bg-white px-3 py-3 dark:border-slate-700/90 dark:bg-slate-950 lg:hidden">
        {mode === 'scrollable' ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {isSubmitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={currentQuestion === 0}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Previous question"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onOpenQuestionPicker}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              Question {currentQuestion + 1} of {totalQuestions}
            </button>

            {isLastQuestion ? (
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition active:scale-95 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {isSubmitting ? '…' : 'Submit'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition active:scale-95 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                aria-label="Next question"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default MobileQuizChrome;
