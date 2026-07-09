import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { applyGradingPeriodTemplate } from '../../services/gradingApi';

interface GradingPeriodSetupModalProps {
  show: boolean;
  courseId: string;
  courseTitle?: string;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Post-create wizard for full-year courses: pick quarters or two terms, or skip.
 */
export default function GradingPeriodSetupModal({
  show,
  courseId,
  courseTitle,
  onComplete,
  onSkip,
}: GradingPeriodSetupModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const applyTemplate = async (template: 'quarters' | 'terms') => {
    setSaving(true);
    setError('');
    try {
      await applyGradingPeriodTemplate(courseId, template);
      onComplete();
    } catch {
      setError('Could not set up grading periods. You can add them later from the gradebook.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grading-period-setup-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="grading-period-setup-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Set up grading periods
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {courseTitle
              ? `"${courseTitle}" runs for a full year. How should grades be reported during the year?`
              : 'How should grades be reported during the year?'}
          </p>
        </div>
        <div className="space-y-3 px-6 py-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={() => void applyTemplate('quarters')}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
          >
            <span className="block font-medium text-gray-900 dark:text-gray-100">
              4 quarters (25% each)
            </span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              Q1–Q4 with equal weights. Best for quarter-report-card schools.
            </span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void applyTemplate('terms')}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
          >
            <span className="block font-medium text-gray-900 dark:text-gray-100">
              2 terms (50% each)
            </span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              Term 1 and Term 2 with equal weights. Best for two-term school years.
            </span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSkip}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Skip for now — I&apos;ll set this up later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
