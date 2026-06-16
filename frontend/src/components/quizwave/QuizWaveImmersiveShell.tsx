import React from 'react';

interface QuizWaveImmersiveShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Full-viewport shell above mobile bottom nav (z-100) for QuizWave flows. */
const QuizWaveImmersiveShell: React.FC<QuizWaveImmersiveShellProps> = ({
  children,
  className = ''
}) => (
  <div
    className={`fixed inset-0 z-[110] overflow-y-auto overscroll-y-contain lg:left-20 ${className}`}
  >
    {children}
  </div>
);

export default QuizWaveImmersiveShell;
