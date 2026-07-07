import React, { useEffect, useState } from 'react';
import {
  clearStudentGradeOverride,
  fetchStudentGradeOverride,
  setStudentGradeOverride,
} from '../../services/gradingApi';
import { getLetterGrade } from '../../utils/gradeUtils';

interface GradeOverrideModalProps {
  show: boolean;
  courseId: string;
  studentId: string;
  studentName: string;
  computedFinalPercent: number | null;
  gradeScale?: { letter: string; min: number; max: number }[];
  onClose: () => void;
  onSaved: () => void;
}

export default function GradeOverrideModal({
  show,
  courseId,
  studentId,
  studentName,
  computedFinalPercent,
  gradeScale,
  onClose,
  onSaved,
}: GradeOverrideModalProps) {
  const [finalPercent, setFinalPercent] = useState('');
  const [letterGrade, setLetterGrade] = useState('');
  const [reason, setReason] = useState('');
  const [hasOverride, setHasOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchStudentGradeOverride(courseId, studentId)
      .then((res) => {
        if (cancelled) return;
        const override = res.data;
        if (override?.active !== false && override?.finalPercent != null) {
          setHasOverride(true);
          setFinalPercent(String(override.finalPercent));
          setLetterGrade(override.letterGrade || '');
          setReason(override.reason || '');
        } else {
          setHasOverride(false);
          const base =
            computedFinalPercent != null && Number.isFinite(computedFinalPercent)
              ? computedFinalPercent
              : 0;
          setFinalPercent(base.toFixed(2));
          setLetterGrade(getLetterGrade(base, gradeScale));
          setReason('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load override.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, courseId, studentId, computedFinalPercent, gradeScale]);

  const handlePercentChange = (value: string) => {
    setFinalPercent(value);
    const n = Number(value);
    if (Number.isFinite(n)) setLetterGrade(getLetterGrade(n, gradeScale));
  };

  const handleSave = async () => {
    const n = Number(finalPercent);
    if (!Number.isFinite(n)) {
      setError('Enter a valid final percent.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setStudentGradeOverride(courseId, studentId, {
        finalPercent: n,
        letterGrade: letterGrade || getLetterGrade(n, gradeScale),
        reason,
      });
      onSaved();
      onClose();
    } catch {
      setError('Could not save override.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError('');
    try {
      await clearStudentGradeOverride(courseId, studentId);
      onSaved();
      onClose();
    } catch {
      setError('Could not clear override.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Override final grade</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{studentName}</p>
          {computedFinalPercent != null && (
            <p className="mt-1 text-xs text-gray-500">
              Computed final: {computedFinalPercent.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="space-y-4 px-6 py-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Final %</label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={0.01}
                  value={finalPercent}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Letter grade</label>
                <input
                  type="text"
                  value={letterGrade}
                  onChange={(e) => setLetterGrade(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason (optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-between gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {hasOverride ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleClear()}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              Clear override
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleSave()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
