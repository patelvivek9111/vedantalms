import React from 'react';

interface SectionDividerHeadingProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
}

/** Uppercase section label with trailing gradient rule. */
export function SectionDividerHeading({ id, children, className = '' }: SectionDividerHeadingProps) {
  return (
    <div className={`mb-4 flex items-center gap-3 ${className}`}>
      <h3
        id={id}
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
      >
        {children}
      </h3>
      <span
        className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700"
        aria-hidden
      />
    </div>
  );
}

export default SectionDividerHeading;
