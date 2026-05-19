import React from 'react';
import { Check, X, ArrowUp, ArrowDown } from 'lucide-react';
import type { QuizWavePlayerResult } from '../../types/quizwaveScoring';

const INCORRECT_MESSAGES = [
  'Trick question?!',
  'So close!',
  'Better luck next time!',
  'Keep trying!',
  'Not quite!'
];

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod100 = n % 100;
  return n + (suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0]);
}

export type StudentAnswerFeedback = QuizWavePlayerResult;

interface StudentAnswerFeedbackViewProps {
  result: StudentAnswerFeedback;
  pin: string;
  questionNumber: number;
  totalQuestions: number;
}

/** Kahoot-style full-screen feedback — renders server payload only */
const StudentAnswerFeedbackView: React.FC<StudentAnswerFeedbackViewProps> = ({
  result,
  pin,
  questionNumber,
  totalQuestions
}) => {
  const {
    isCorrect,
    points,
    totalScore,
    streak,
    answerStreak,
    rank,
    rankMovementText,
    rankDelta,
    feedback = []
  } = result;
  const displayStreak = answerStreak ?? streak ?? 0;
  const showStreakBlock = isCorrect && displayStreak >= 2;
  const incorrectMessage =
    INCORRECT_MESSAGES[questionNumber % INCORRECT_MESSAGES.length];

  if (isCorrect) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <div className="flex items-center justify-end px-4 py-3 bg-gray-100 border-b border-gray-200">
          <div className="bg-gray-900 text-white font-bold text-lg sm:text-xl px-4 py-2 rounded-md tabular-nums min-w-[4rem] text-center">
            {totalScore.toLocaleString()}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#26890c] text-white">
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-4">
            <h1 className="text-4xl sm:text-5xl font-bold italic mb-6">Correct</h1>
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white flex items-center justify-center mb-8 shadow-lg">
              <Check className="w-14 h-14 sm:w-16 sm:h-16 text-[#26890c]" strokeWidth={3} />
            </div>
            <div className="w-full bg-[#1f6f0a] py-4 sm:py-5 text-center">
              <p className="text-3xl sm:text-4xl font-bold tabular-nums">+{points.toLocaleString()}</p>
            </div>
          </div>

          <div className="px-6 pb-4 flex flex-col items-center gap-3">
            {rank > 0 && (
              <p className="text-lg font-medium">You&apos;re in {ordinal(rank)} place</p>
            )}
            {rankMovementText && (
              <p className="flex items-center gap-2 text-base font-semibold">
                {rankDelta > 0 ? (
                  <ArrowUp className="w-5 h-5" aria-hidden />
                ) : rankDelta < 0 ? (
                  <ArrowDown className="w-5 h-5" aria-hidden />
                ) : null}
                {rankMovementText}
              </p>
            )}
            {feedback.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {feedback.map((label) => (
                  <span
                    key={label}
                    className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            {showStreakBlock && (
              <div className="flex flex-col items-center gap-2 mt-1">
                <div className="flex items-center gap-3">
                  <span className="text-lg sm:text-xl font-semibold">Answer Streak</span>
                  <span className="text-2xl" role="img" aria-label="streak">
                    🔥
                  </span>
                  <span className="bg-purple-600 text-white font-bold text-sm px-2.5 py-1 rounded-full">
                    x{displayStreak}
                  </span>
                </div>
                <p className="text-center text-sm sm:text-base text-white/95 max-w-md leading-snug">
                  <span className="font-bold">TIP:</span> To keep your Answer Streak,{' '}
                  <span className="font-bold">take your time</span> to answer correctly
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-200 text-gray-900">
          <span className="font-semibold text-sm sm:text-base">PIN: {pin}</span>
          <span className="font-bold text-sm sm:text-base">Q{questionNumber}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-semibold text-gray-900 text-sm sm:text-base">PIN: {pin}</span>
        <span className="font-semibold text-gray-900 text-sm sm:text-base">
          {questionNumber} of {totalQuestions}
        </span>
      </div>

      <div className="flex-1 flex flex-col bg-[#e21b3c] text-white">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <h1 className="text-4xl sm:text-5xl font-bold italic mb-8">Incorrect</h1>
          <X className="w-28 h-28 sm:w-36 sm:h-36 mb-8" strokeWidth={3} aria-hidden />
          <div className="bg-[#9c0f28] px-8 py-3 rounded-sm mb-6">
            <p className="text-lg sm:text-xl font-medium text-center">{incorrectMessage}</p>
          </div>
          {rank > 0 && (
            <p className="text-lg sm:text-xl font-medium mb-4">
              You&apos;re in {ordinal(rank)} place
            </p>
          )}
          {rankMovementText && (
            <p className="flex items-center gap-2 text-base font-medium mb-8">
              {rankDelta > 0 ? (
                <ArrowUp className="w-5 h-5" aria-hidden />
              ) : rankDelta < 0 ? (
                <ArrowDown className="w-5 h-5" aria-hidden />
              ) : null}
              {rankMovementText}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end px-4 py-3 border-t border-gray-200 bg-white">
        <div className="bg-gray-900 text-white font-bold text-lg sm:text-xl px-5 py-2 rounded-md tabular-nums min-w-[3rem] text-center">
          {totalScore.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default StudentAnswerFeedbackView;
