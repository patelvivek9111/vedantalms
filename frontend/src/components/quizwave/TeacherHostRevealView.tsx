import React from 'react';
import { Check } from 'lucide-react';
import { QuizWaveGameSnapshot } from '../../types/quizwaveGameState';

const COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
const COUNT_COLORS = ['text-red-600', 'text-blue-600', 'text-yellow-600', 'text-green-600'];
const SHAPES = ['triangle', 'diamond', 'circle', 'square'] as const;

function ShapeIcon({ shape, compact = false }: { shape: string; compact?: boolean }) {
  const dim = compact ? 'w-4 h-4' : 'w-5 h-5';
  const tri = compact
    ? 'border-l-[8px] border-r-[8px] border-b-[14px]'
    : 'border-l-[10px] sm:border-l-[12px] border-r-[10px] sm:border-r-[12px] border-b-[16px] sm:border-b-[20px]';
  if (shape === 'triangle') {
    return <div className={`w-0 h-0 border-l-transparent border-r-transparent border-b-white ${tri}`} />;
  }
  if (shape === 'diamond') return <div className={`${dim} bg-white rotate-45`} />;
  if (shape === 'circle') return <div className={`${dim} bg-white rounded-full`} />;
  return <div className={`${dim} bg-white`} />;
}

interface TeacherHostRevealViewProps {
  questionText: string;
  options: Array<{ text: string; isCorrect?: boolean }>;
  answerDistribution: Record<number, number>;
  showCorrectMarks: boolean;
  leaderboard?: QuizWaveGameSnapshot['leaderboard'];
  showLeaderboard?: boolean;
}

/** Kahoot-style host screen: bar chart on top + 2x2 answer grid below */
const TeacherHostRevealView: React.FC<TeacherHostRevealViewProps> = ({
  questionText,
  options,
  answerDistribution,
  showCorrectMarks,
  leaderboard,
  showLeaderboard
}) => {
  const maxCount = Math.max(...Object.values(answerDistribution), 1);

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className="text-center mb-4 px-2">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 break-words leading-snug">
          {questionText}
        </h1>
      </div>

      {showLeaderboard && leaderboard && leaderboard.length > 0 && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {leaderboard.slice(0, 3).map((entry, rank) => (
            <div key={entry.studentId} className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5 text-sm">
              <span className="font-semibold text-gray-900 dark:text-white">
                #{rank + 1} {entry.nickname}
              </span>
              <span className="text-purple-600 dark:text-purple-400 ml-2">{entry.totalScore} pts</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {options.map((opt, idx) => {
          const count = answerDistribution[idx] || 0;
          const barHeight = maxCount > 0 ? Math.max((count / maxCount) * 160, count > 0 ? 28 : 4) : 4;
          const showMark = showCorrectMarks && opt.isCorrect;
          return (
            <div key={idx} className="flex flex-col items-center">
              <div className="h-10 flex flex-col items-center justify-end mb-1">
                {showMark && <Check className="w-6 h-6 text-amber-500 mb-0.5" strokeWidth={3} />}
                <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${COUNT_COLORS[idx % 4]}`}>
                  {count}
                </span>
              </div>
              <div className="w-full flex flex-col items-center justify-end" style={{ height: '140px' }}>
                <div
                  className={`w-full max-w-[72px] ${COLORS[idx % 4]} rounded-t-md transition-all duration-500`}
                  style={{ height: `${barHeight}px`, minHeight: '4px' }}
                />
                <div
                  className={`w-full max-w-[72px] ${COLORS[idx % 4]} rounded-b-md py-2 flex items-center justify-center`}
                >
                  <ShapeIcon shape={SHAPES[idx % 4]} compact />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1">
        {options.map((opt, idx) => {
          const showMark = showCorrectMarks && opt.isCorrect;
          return (
            <div
              key={idx}
              className={`${COLORS[idx % 4]} rounded-xl p-4 sm:p-5 min-h-[72px] relative flex items-start gap-3 shadow-md`}
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white/25 rounded-lg flex items-center justify-center shrink-0">
                <ShapeIcon shape={SHAPES[idx % 4]} />
              </div>
              <span className="text-white font-semibold text-sm sm:text-base leading-snug flex-1 pt-1">{opt.text}</span>
              {showMark && (
                <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 bg-white/35 rounded-full p-1.5">
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeacherHostRevealView;
