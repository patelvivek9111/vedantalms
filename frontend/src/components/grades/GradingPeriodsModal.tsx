import React, { useEffect, useState } from 'react';
import {
  createCourseGradingPeriod,
  fetchCourseGradingPeriods,
  type GradingPeriod,
} from '../../services/gradingApi';

interface GradingPeriodsModalProps {
  show: boolean;
  courseId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function GradingPeriodsModal({
  show,
  courseId,
  onClose,
  onChanged,
}: GradingPeriodsModalProps) {
  const [periods, setPeriods] = useState<GradingPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchCourseGradingPeriods(courseId);
      if (res.success) setPeriods(res.data || []);
    } catch {
      setError('Could not load grading periods.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && courseId) void load();
  }, [show, courseId]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      await createCourseGradingPeriod(courseId, { name });
      setNewName('');
      await load();
      onChanged?.();
    } catch {
      setError('Could not create grading period.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Grading periods</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create periods (e.g. Fall, Spring) and assign them to assignments and discussions.
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : periods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No grading periods yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {periods.map((period) => (
                <li key={period._id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{period.name}</span>
                  {period.closed && (
                    <span className="text-xs text-gray-500">Closed</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New period name"
              className="flex-1 rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
            />
            <button
              type="button"
              disabled={saving || !newName.trim()}
              onClick={() => void handleCreate()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 text-right dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
