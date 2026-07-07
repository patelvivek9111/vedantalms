import React, { useEffect, useState } from 'react';
import { fetchGradebookCellHistory } from '../../services/gradingApi';

interface HistoryEntry {
  _id: string;
  previousGrade: unknown;
  newGrade: unknown;
  previousExcused?: boolean;
  newExcused?: boolean;
  changeType?: string;
  createdAt: string;
  changedBy?: { firstName?: string; lastName?: string; email?: string };
}

interface GradebookCellHistoryPanelProps {
  show: boolean;
  courseId: string;
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  onClose: () => void;
}

function formatGrade(value: unknown, excused?: boolean): string {
  if (excused) return 'Excused';
  if (value == null || value === '') return '—';
  return String(value);
}

export default function GradebookCellHistoryPanel({
  show,
  courseId,
  studentId,
  studentName,
  assignmentId,
  assignmentTitle,
  onClose,
}: GradebookCellHistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    setLoading(true);
    fetchGradebookCellHistory(courseId, { studentId, assignmentId, limit: 50 })
      .then((res) => {
        if (!cancelled && res.success) setEntries(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, courseId, studentId, assignmentId]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Grade history</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{studentName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">{assignmentTitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-1 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No grade changes recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => {
                const who = entry.changedBy
                  ? `${entry.changedBy.firstName || ''} ${entry.changedBy.lastName || ''}`.trim() ||
                    entry.changedBy.email ||
                    'Unknown'
                  : 'System';
                return (
                  <li
                    key={entry._id}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {formatGrade(entry.previousGrade, entry.previousExcused)} →{' '}
                      {formatGrade(entry.newGrade, entry.newExcused)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()} · {who}
                      {entry.changeType ? ` · ${entry.changeType}` : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
