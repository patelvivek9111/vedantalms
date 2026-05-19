import React from 'react';
import { ds } from '../../design-system';
import type { GradebookFilterMode } from './gradebookStatusUtils';

interface GradebookTableToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterMode: GradebookFilterMode;
  onFilterModeChange: (mode: GradebookFilterMode) => void;
  needsGradingCount: number;
  showingCount: number;
  totalCount: number;
}

const GradebookTableToolbar: React.FC<GradebookTableToolbarProps> = ({
  search,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  needsGradingCount,
  showingCount,
  totalCount,
}) => (
  <div className={`${ds.surface.card} px-4 py-3`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex-1 min-w-0">
        <span className="sr-only">Search students</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search students…"
          className={`${ds.input} w-full max-w-md`}
          aria-label="Search students in gradebook"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Gradebook filters">
        {(
          [
            ['all', 'All'],
            ['needsGrading', `Needs grading${needsGradingCount ? ` (${needsGradingCount})` : ''}`],
            ['atRisk', 'Below 70%'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onFilterModeChange(mode)}
            className={filterMode === mode ? ds.btn.filterActive : ds.btn.filterIdle}
            aria-pressed={filterMode === mode}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
    {(search || filterMode !== 'all') && (
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
        Showing {showingCount} of {totalCount} students
      </p>
    )}
  </div>
);

export default GradebookTableToolbar;
