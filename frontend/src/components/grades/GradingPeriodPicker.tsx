import React, { useEffect, useState } from 'react';
import { fetchCourseGradingPeriods, type GradingPeriod } from '../../services/gradingApi';

interface GradingPeriodPickerProps {
  courseId: string | null | undefined;
  value: string | null;
  onChange: (periodId: string | null) => void;
  onManagePeriods?: () => void;
  className?: string;
  id?: string;
}

export default function GradingPeriodPicker({
  courseId,
  value,
  onChange,
  onManagePeriods,
  className = '',
  id = 'grading-period',
}: GradingPeriodPickerProps) {
  const [periods, setPeriods] = useState<GradingPeriod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setPeriods([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCourseGradingPeriods(courseId)
      .then((res) => {
        if (!cancelled && res.success) setPeriods(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setPeriods([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (!courseId) return null;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Grading period
      </label>
      <div className="mt-1 flex gap-2">
        <select
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={loading}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">No grading period</option>
          {periods.map((period) => (
            <option key={period._id} value={period._id}>
              {period.name}
              {period.closed ? ' (closed)' : ''}
            </option>
          ))}
        </select>
        {onManagePeriods && (
          <button
            type="button"
            onClick={onManagePeriods}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Manage
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Optional. Used to filter assignments and gradebook by term or period.
      </p>
    </div>
  );
}
