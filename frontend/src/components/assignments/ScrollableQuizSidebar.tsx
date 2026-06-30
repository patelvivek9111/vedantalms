import React from 'react';
import { Circle, Bookmark } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';

interface ScrollableQuizSidebarProps {
  totalQuestions: number;
  questions: { points: number }[];
  answeredQuestions: Set<number>;
  markedQuestions: Set<number>;
  isTimedQuiz: boolean;
  showTimer: boolean;
  onToggleTimer: () => void;
  dueDate: string;
  quizStarted: boolean;
  timeLeft: number | null;
  formatTime: (seconds: number) => string;
  quizTimeLimit?: number;
  onStartQuiz: () => void;
}

const ScrollableQuizSidebar: React.FC<ScrollableQuizSidebarProps> = ({
  totalQuestions,
  questions,
  answeredQuestions,
  markedQuestions,
  isTimedQuiz,
  showTimer,
  onToggleTimer,
  dueDate,
  quizStarted,
  timeLeft,
  formatTime,
  quizTimeLimit,
  onStartQuiz,
}) => {
  return (
    <div className="w-80 shrink-0 self-start rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-800/60">
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Questions</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {questions.map((question, index) => (
            <button
              key={index}
              onClick={() => {
                const questionElement =
                  document.getElementById(`question-${index}-answer`) ||
                  (document.querySelector(`[name="question-${index}"]`) as HTMLElement | null);
                if (questionElement) {
                  questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className="w-full flex items-center justify-between p-2 rounded-md text-sm hover:bg-gray-100 dark:bg-gray-700"
            >
              <div className="flex items-center space-x-2">
                {answeredQuestions.has(index) && markedQuestions.has(index) ? (
                  <div className="relative">
                    <Circle className="h-4 w-4 text-green-600 dark:text-green-400 fill-current" />
                    <Bookmark className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                  </div>
                ) : answeredQuestions.has(index) ? (
                  <Circle className="h-4 w-4 text-green-600 dark:text-green-400 fill-current" />
                ) : markedQuestions.has(index) ? (
                  <Bookmark className="h-4 w-4 text-yellow-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
                <span>Question {index + 1}</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{question.points} pts</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          <div className="flex items-center justify-between">
            <span>Progress</span>
            <span>
              {answeredQuestions.size} of {totalQuestions} answered
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(answeredQuestions.size / Math.max(totalQuestions, 1)) * 100}%` }}
          ></div>
        </div>
      </div>

      {isTimedQuiz && (
        <div className="mt-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            <div className="flex items-center justify-between">
              <span>Time Remaining:</span>
              <button
                type="button"
                onClick={onToggleTimer}
                className="text-blue-600 hover:text-blue-800 underline text-xs"
              >
                {showTimer ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {showTimer && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Attempt due: {safeFormatDate(dueDate, "MMM d 'at' h:mm a")}
              </div>
              {quizStarted && timeLeft !== null ? (
                <div
                  className={`text-sm font-medium ${
                    timeLeft <= 300 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {formatTime(timeLeft)}
                </div>
              ) : (
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {quizTimeLimit} minutes
                </div>
              )}
              {!quizStarted && (
                <button
                  type="button"
                  onClick={onStartQuiz}
                  className="mt-2 w-full bg-indigo-600 dark:bg-indigo-500 text-white text-sm py-2 px-3 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600"
                >
                  Start Quiz
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScrollableQuizSidebar;

