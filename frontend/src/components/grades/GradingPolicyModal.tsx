import React, { useState } from 'react';
import type { GradingPolicyConfig } from '../../utils/gradeUtils';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { ErrorBanner } from '../../design-system';
import EffectivePolicyPreview from './EffectivePolicyPreview';
import PolicyAuditHistory from './PolicyAuditHistory';
import CourseGradeLifecyclePanel from './CourseGradeLifecyclePanel';

interface GradingPolicyModalProps {
  show: boolean;
  onClose: () => void;
  courseId?: string;
  userRole?: string;
  editPolicy: GradingPolicyConfig;
  setEditPolicy: React.Dispatch<React.SetStateAction<GradingPolicyConfig>>;
  onSave: () => void;
  onPreview: () => void;
  saving: boolean;
  loading: boolean;
  error: string;
  preview: { totalPercent: number; letterGrade: string } | null;
  dirty?: boolean;
}

const GradingPolicyModal: React.FC<GradingPolicyModalProps> = ({
  show,
  onClose,
  courseId,
  userRole,
  editPolicy,
  setEditPolicy,
  onSave,
  onPreview,
  saving,
  loading,
  error,
  preview,
  dirty = false,
}) => {
  const [tab, setTab] = useState<'settings' | 'effective' | 'history' | 'lifecycle'>('settings');
  useUnsavedChangesGuard(dirty && show);

  if (!show) return null;

  const update = <K extends keyof GradingPolicyConfig>(key: K, value: GradingPolicyConfig[K]) => {
    setEditPolicy((p) => ({ ...p, [key]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grading-policies-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 id="grading-policies-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Grading policies</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure how this course calculates final grades. New policy applies to future calculations;
            frozen transcript rows keep their original policy snapshot.
          </p>
          {courseId && (
            <div className="mt-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
              {(['settings', 'effective', 'history', 'lifecycle'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 text-sm font-medium capitalize ${
                    tab === key
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {key === 'settings'
                    ? 'Settings'
                    : key === 'effective'
                      ? 'Effective policy'
                      : key === 'history'
                        ? 'History'
                        : 'Lifecycle'}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === 'effective' && courseId ? (
          <div className="p-6">
            <EffectivePolicyPreview courseId={courseId} />
          </div>
        ) : tab === 'history' && courseId ? (
          <div className="p-6">
            <PolicyAuditHistory entityType="course" entityId={courseId} />
          </div>
        ) : tab === 'lifecycle' && courseId ? (
          <div className="p-6">
            <CourseGradeLifecyclePanel courseId={courseId} userRole={userRole} defaultExpanded />
          </div>
        ) : loading ? (
          <p className="p-6 text-sm text-gray-500">Loading policy…</p>
        ) : (
          <div className="space-y-6 p-6">
            {error && <ErrorBanner message={error} />}
            {dirty && (
              <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
                You have unsaved policy changes.
              </p>
            )}

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Missing assignments</h3>
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                value={editPolicy.missingAssignment?.mode || 'count_as_zero'}
                onChange={(e) =>
                  update('missingAssignment', {
                    mode: e.target.value as 'count_as_zero' | 'exclude_until_graded',
                  })
                }
              >
                <option value="count_as_zero">Count missing (past due) as zero</option>
                <option value="exclude_until_graded">Exclude until graded</option>
              </select>
            </section>

            <section>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <input
                  type="checkbox"
                  checked={!!editPolicy.latePenalty?.enabled}
                  onChange={(e) =>
                    update('latePenalty', {
                      ...editPolicy.latePenalty!,
                      enabled: e.target.checked,
                    })
                  }
                />
                Late penalties
              </label>
              {editPolicy.latePenalty?.enabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400">Mode</label>
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                      value={editPolicy.latePenalty.mode || 'per_day'}
                      onChange={(e) =>
                        update('latePenalty', {
                          ...editPolicy.latePenalty!,
                          mode: e.target.value as 'fixed' | 'per_day',
                        })
                      }
                    >
                      <option value="fixed">Fixed % deduction</option>
                      <option value="per_day">Per-day deduction</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400">Grace period (hours)</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                      value={editPolicy.latePenalty.gracePeriodHours ?? 0}
                      onChange={(e) =>
                        update('latePenalty', {
                          ...editPolicy.latePenalty!,
                          gracePeriodHours: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  {editPolicy.latePenalty.mode === 'fixed' ? (
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400">Fixed deduction %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                        value={editPolicy.latePenalty.fixedPercent ?? 10}
                        onChange={(e) =>
                          update('latePenalty', {
                            ...editPolicy.latePenalty!,
                            fixedPercent: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400">Per-day deduction %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                        value={editPolicy.latePenalty.perDayPercent ?? 5}
                        onChange={(e) =>
                          update('latePenalty', {
                            ...editPolicy.latePenalty!,
                            perDayPercent: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400">Maximum penalty %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                      value={editPolicy.latePenalty.capPercent ?? 100}
                      onChange={(e) =>
                        update('latePenalty', {
                          ...editPolicy.latePenalty!,
                          capPercent: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </section>

            <section>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <input
                  type="checkbox"
                  checked={!!editPolicy.dropLowest?.enabled}
                  onChange={(e) =>
                    update('dropLowest', {
                      enabled: e.target.checked,
                      rules: editPolicy.dropLowest?.rules || [],
                    })
                  }
                />
                Drop lowest scores
              </label>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Attendance</h3>
              <select
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
                value={editPolicy.attendance?.mode || 'weighted_group'}
                onChange={(e) =>
                  update('attendance', {
                    ...editPolicy.attendance!,
                    mode: e.target.value as 'weighted_group' | 'excluded' | 'separate_weight',
                  })
                }
              >
                <option value="weighted_group">Use assignment group weight</option>
                <option value="excluded">Exclude attendance from grade</option>
                <option value="separate_weight">Separate attendance weight %</option>
              </select>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">GPA scale type</h3>
              <select
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
                value={editPolicy.gpaScale?.type || 'letter'}
                onChange={(e) =>
                  update('gpaScale', {
                    ...editPolicy.gpaScale!,
                    type: e.target.value as 'letter' | 'four_point' | 'percentage',
                  })
                }
              >
                <option value="letter">Letter (course grade scale)</option>
                <option value="four_point">4.0 GPA mapping</option>
                <option value="percentage">Percentage</option>
              </select>
            </section>

            {preview && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-900/30">
                Preview sample: <strong>{preview.totalPercent.toFixed(2)}%</strong> ({preview.letterGrade})
              </div>
            )}
          </div>
        )}

        {tab === 'settings' && (
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPreview}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
          >
            Preview
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save policies'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

export default GradingPolicyModal;

