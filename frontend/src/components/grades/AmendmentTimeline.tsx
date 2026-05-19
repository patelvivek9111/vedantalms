import React from 'react';
import type { TimelineEntry } from '../../hooks/useCourseGradeLifecycle';

interface AmendmentTimelineProps {
  entries: TimelineEntry[];
  loading?: boolean;
}

const severityDot: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const AmendmentTimeline: React.FC<AmendmentTimelineProps> = ({ entries, loading }) => {
  if (loading) return <p className="text-sm text-gray-500">Loading audit timeline…</p>;
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No audit events recorded for this course term yet.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="ml-4">
          <span
            className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white dark:border-gray-900 ${
              severityDot[entry.severity] || severityDot.info
            }`}
          />
          <time className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(entry.at).toLocaleString()}
          </time>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.summary}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {entry.category} · {entry.action}
            {entry.actor?.name ? ` · ${entry.actor.name}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
};

export default AmendmentTimeline;
