import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createCourseGradingPeriod,
  fetchCourseGradingPeriods,
  updateCourseGradingPeriod,
  deleteCourseGradingPeriod,
  fetchGradingPeriodDeletionImpact,
  updateGradingPeriodSettings,
  applyGradingPeriodTemplate,
  type GradingPeriod,
  type GradingPeriodSettings,
} from '../../services/gradingApi';
import {
  resolveCurrentGradingPeriodId,
  isGradingPeriodClosed,
} from '../../utils/gradingPeriods';

/** ISO date/datetime → yyyy-mm-dd for <input type="date">. */
function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

interface GradingPeriodsModalProps {
  show: boolean;
  courseId: string;
  onClose: () => void;
  onChanged?: () => void;
  /** Element (or its id) whose rectangle the modal should center over. Defaults to the course content pane. */
  anchorSelector?: string;
}

type AnchorRect = { left: number; top: number; width: number; height: number };

export default function GradingPeriodsModal({
  show,
  courseId,
  onClose,
  onChanged,
  anchorSelector = '#course-main-content',
}: GradingPeriodsModalProps) {
  const [periods, setPeriods] = useState<GradingPeriod[]>([]);
  const [settings, setSettings] = useState<GradingPeriodSettings>({
    allowStudentAllPeriods: true,
    displayTotalsForAllPeriods: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newClose, setNewClose] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);

  const currentPeriodId = resolveCurrentGradingPeriodId(periods);

  useEffect(() => {
    if (!show) return;
    const measure = () => {
      const el = anchorSelector
        ? document.querySelector<HTMLElement>(anchorSelector)
        : null;
      if (!el) {
        setAnchorRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // Clamp to the visible viewport so the modal centers in the on-screen
      // portion of the pane, not the middle of its full (scrollable) height.
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight);
      setAnchorRect({
        left: r.left,
        top,
        width: r.width,
        height: Math.max(0, bottom - top),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [show, anchorSelector]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchCourseGradingPeriods(courseId);
      if (res.success) {
        setPeriods(res.data || []);
        if (res.settings) setSettings(res.settings);
      }
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
      await createCourseGradingPeriod(courseId, {
        name,
        startDate: newStart || null,
        endDate: newEnd || null,
        closeDate: newClose || null,
        weight: newWeight.trim() ? Number(newWeight) : null,
      });
      setNewName('');
      setNewStart('');
      setNewEnd('');
      setNewClose('');
      setNewWeight('');
      await load();
      onChanged?.();
    } catch {
      setError('Could not create grading period.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDates = async (
    period: GradingPeriod,
    changes: {
      startDate?: string | null;
      endDate?: string | null;
      closeDate?: string | null;
      closed?: boolean;
      weight?: number | null;
    }
  ) => {
    setRowSavingId(period._id);
    setError('');
    try {
      await updateCourseGradingPeriod(courseId, period._id, changes);
      await load();
      onChanged?.();
    } catch {
      setError('Could not update grading period dates.');
    } finally {
      setRowSavingId(null);
    }
  };

  const handleDelete = async (period: GradingPeriod) => {
    setRowSavingId(period._id);
    setError('');
    setNotice('');
    try {
      const impactRes = await fetchGradingPeriodDeletionImpact(courseId, period._id);
      if (!impactRes.success) {
        setError('Could not load deletion details.');
        return;
      }
      const impact = impactRes.data;
      const lines = [
        `Delete grading period "${period.name}"?`,
        '',
        impact.hasAssignmentsOrGrades
          ? `${impact.assignmentCount} assignment(s) and ${impact.discussionCount} discussion(s) will be unassigned from this period. Grades and submissions are not deleted.`
          : 'This period has no assignments. It will be removed.',
        'Assignments are not deleted and will appear as unassigned in the gradebook.',
        impact.periodWasClosed
          ? 'This period is closed. Frozen transcript snapshots and finalized records are preserved.'
          : '',
        impact.weightWarning
          ? `Weight warning: ${impact.weightWarning}`
          : '',
      ].filter(Boolean);

      if (!window.confirm(lines.join('\n\n'))) return;

      const delRes = await deleteCourseGradingPeriod(courseId, period._id);
      await load();
      onChanged?.();
      if (delRes.data?.weightWarning) {
        setNotice(delRes.data.weightWarning);
      } else if (impact.hasAssignmentsOrGrades) {
        setNotice(
          `Period deleted. ${delRes.data?.assignmentsUnassigned ?? 0} assignment(s) and ${delRes.data?.discussionsUnassigned ?? 0} discussion(s) are now unassigned.`
        );
      }
    } catch {
      setError('Could not delete grading period.');
    } finally {
      setRowSavingId(null);
    }
  };

  const handleSettingsChange = async (patch: Partial<GradingPeriodSettings>) => {
    setSettingsSaving(true);
    setError('');
    try {
      const res = await updateGradingPeriodSettings(courseId, patch);
      if (res.success && res.data) setSettings(res.data);
      onChanged?.();
    } catch {
      setError('Could not update grading period settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleApplyTemplate = async (template: 'quarters' | 'semesters') => {
    if (
      periods.length > 0 &&
      !window.confirm(
        `Add ${template === 'quarters' ? '4 quarter' : '2 semester'} periods? Existing periods are kept.`
      )
    ) {
      return;
    }
    setTemplateSaving(true);
    setError('');
    try {
      await applyGradingPeriodTemplate(courseId, template);
      await load();
      onChanged?.();
    } catch {
      setError('Could not apply template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const totalWeight = periods.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

  if (!show) return null;

  const overlayStyle: React.CSSProperties = anchorRect
    ? {
        left: anchorRect.left,
        top: anchorRect.top,
        width: anchorRect.width,
        height: anchorRect.height,
      }
    : { inset: 0 };

  return createPortal(
    <div
      className="fixed z-50 flex items-center justify-center bg-black/50 p-4"
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Grading periods</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Set a date range for each period. Assignments and discussions are automatically slotted
            into the period their due date falls in; anything without a due date goes to the last
            period.
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {notice && (
            <p className="text-sm text-amber-700 dark:text-amber-300">{notice}</p>
          )}

          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Student view</h3>
            <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={settings.allowStudentAllPeriods !== false}
                  disabled={settingsSaving}
                  onChange={(e) =>
                    void handleSettingsChange({ allowStudentAllPeriods: e.target.checked })
                  }
                  className="mt-0.5"
                />
                <span>Allow students to view all grading periods</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={settings.displayTotalsForAllPeriods !== false}
                  disabled={settingsSaving}
                  onChange={(e) =>
                    void handleSettingsChange({ displayTotalsForAllPeriods: e.target.checked })
                  }
                  className="mt-0.5"
                />
                <span>Show course totals when viewing all periods</span>
              </label>
            </div>
          </div>

          {periods.length === 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={templateSaving}
                onClick={() => void handleApplyTemplate('quarters')}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Quick start: Quarters
              </button>
              <button
                type="button"
                disabled={templateSaving}
                onClick={() => void handleApplyTemplate('semesters')}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Quick start: Semesters
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : periods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No grading periods yet.</p>
          ) : (
            <>
              {totalWeight > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Period weights total: {totalWeight}%
                  {Math.abs(totalWeight - 100) > 0.5 ? ' (does not equal 100%)' : ''}
                </p>
              )}
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {periods.map((period) => (
                <li key={period._id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                      {period.name}
                      {period._id === currentPeriodId && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          Current
                        </span>
                      )}
                      {isGradingPeriodClosed(period) && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          Closed
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={rowSavingId === period._id}
                      onClick={() => void handleDelete(period)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                      Start
                      <input
                        type="date"
                        defaultValue={toDateInputValue(period.startDate)}
                        disabled={rowSavingId === period._id}
                        onBlur={(e) => {
                          const next = e.target.value || null;
                          if (next !== (toDateInputValue(period.startDate) || null)) {
                            void handleUpdateDates(period, { startDate: next });
                          }
                        }}
                        className="mt-1 rounded-lg border px-2 py-1 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                      End
                      <input
                        type="date"
                        defaultValue={toDateInputValue(period.endDate)}
                        disabled={rowSavingId === period._id}
                        onBlur={(e) => {
                          const next = e.target.value || null;
                          if (next !== (toDateInputValue(period.endDate) || null)) {
                            void handleUpdateDates(period, { endDate: next });
                          }
                        }}
                        className="mt-1 rounded-lg border px-2 py-1 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                      Close (lock)
                      <input
                        type="date"
                        defaultValue={toDateInputValue(period.closeDate)}
                        disabled={rowSavingId === period._id}
                        onBlur={(e) => {
                          const next = e.target.value || null;
                          if (next !== (toDateInputValue(period.closeDate) || null)) {
                            void handleUpdateDates(period, { closeDate: next });
                          }
                        }}
                        className="mt-1 rounded-lg border px-2 py-1 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                      Weight %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        defaultValue={period.weight ?? ''}
                        disabled={rowSavingId === period._id}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const next = raw === '' ? null : Number(raw);
                          const prev = period.weight ?? null;
                          if (next !== prev && !(Number.isNaN(next) && prev == null)) {
                            void handleUpdateDates(period, {
                              weight: next != null && Number.isNaN(next) ? null : next,
                            });
                          }
                        }}
                        className="mt-1 w-20 rounded-lg border px-2 py-1 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex items-center gap-1 pb-1 text-xs text-gray-500 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={period.closed === true}
                        disabled={rowSavingId === period._id}
                        onChange={(e) =>
                          void handleUpdateDates(period, { closed: e.target.checked })
                        }
                      />
                      Closed
                    </label>
                    {rowSavingId === period._id && (
                      <span className="pb-1 text-xs text-gray-400">Saving…</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
          <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New period name (e.g. Quarter 1)"
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
            />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                Start
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="mt-1 rounded-lg border px-2 py-1 text-sm dark:bg-gray-800"
                />
              </label>
              <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                End
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="mt-1 rounded-lg border px-2 py-1 text-sm dark:bg-gray-800"
                />
              </label>
              <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                Close (lock)
                <input
                  type="date"
                  value={newClose}
                  onChange={(e) => setNewClose(e.target.value)}
                  className="mt-1 rounded-lg border px-2 py-1 text-sm dark:bg-gray-800"
                />
              </label>
              <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                Weight %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="mt-1 w-20 rounded-lg border px-2 py-1 text-sm dark:bg-gray-800"
                />
              </label>
              <button
                type="button"
                disabled={saving || !newName.trim()}
                onClick={() => void handleCreate()}
                className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add period
              </button>
            </div>
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
    </div>,
    document.body
  );
}
