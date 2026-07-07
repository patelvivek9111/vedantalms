import React, { useState } from 'react';
import type { GradingPolicyConfig, ResolvedGradingPolicy } from '../../utils/gradeUtils';

const MISSING_MODE_LABELS: Record<string, string> = {
  count_as_zero: 'Count missing (past due) as zero',
  exclude_until_graded: 'Exclude until graded',
};

function missingModeLabel(mode?: string): string {
  return MISSING_MODE_LABELS[mode || 'count_as_zero'] || mode || 'count_as_zero';
}
import type { PolicyImpactPreview as PolicyImpactPreviewData } from '../../services/gradingApi';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { ErrorBanner } from '../../design-system';
import EffectivePolicyPreview from './EffectivePolicyPreview';
import PolicyAuditHistory from './PolicyAuditHistory';
import CourseGradeLifecyclePanel from './CourseGradeLifecyclePanel';
import PolicyImpactPreview from './PolicyImpactPreview';
import PolicyDropRulesSection from './PolicyDropRulesSection';
import PolicyApplyModeSelector, { type PolicyApplyMode } from './PolicyApplyModeSelector';

interface GradingPolicyModalProps {
  show: boolean;
  onClose: () => void;
  courseId?: string;
  userRole?: string;
  editPolicy: GradingPolicyConfig;
  resolvedPolicy?: ResolvedGradingPolicy | null;
  setEditPolicy: React.Dispatch<React.SetStateAction<GradingPolicyConfig>>;
  onSave: () => void;
  onReviewImpact: () => void;
  saving: boolean;
  loading: boolean;
  error: string;
  dirty?: boolean;
  canReviewImpact?: boolean;
  impactPreview: PolicyImpactPreviewData | null;
  impactLoading?: boolean;
  impactStep?: boolean;
  onBackFromImpact?: () => void;
  lifecycleStatus?: string;
  applyMode?: PolicyApplyMode;
  onApplyModeChange?: (mode: PolicyApplyMode) => void;
  effectiveAssignmentId?: string | null;
  onEffectiveAssignmentChange?: (assignmentId: string) => void;
  impactAssignments?: Array<{ id: string; title: string; group?: string }>;
  saveReason?: string;
  onSaveReasonChange?: (value: string) => void;
}

const GradingPolicyModal: React.FC<GradingPolicyModalProps> = ({
  show,
  onClose,
  courseId,
  userRole,
  editPolicy,
  resolvedPolicy = null,
  setEditPolicy,
  onSave,
  onReviewImpact,
  saving,
  loading,
  error,
  dirty = false,
  canReviewImpact = true,
  impactPreview,
  impactLoading = false,
  impactStep = false,
  onBackFromImpact,
  lifecycleStatus = 'DRAFT',
  applyMode = 'retroactive_all',
  onApplyModeChange,
  effectiveAssignmentId = null,
  onEffectiveAssignmentChange,
  impactAssignments = [],
  saveReason = '',
  onSaveReasonChange,
}) => {
  const [tab, setTab] = useState<'settings' | 'effective' | 'history' | 'lifecycle'>('settings');
  useUnsavedChangesGuard(dirty && show);

  const groupNames = (resolvedPolicy?.groups || []).map((g) => g.name).filter(Boolean);

  const updateDropRules = (
    key: 'dropLowest' | 'dropHighest',
    value: NonNullable<GradingPolicyConfig['dropLowest']>
  ) => {
    update(key, value);
  };

  if (!show) return null;

  const update = <K extends keyof GradingPolicyConfig>(key: K, value: GradingPolicyConfig[K]) => {
    setEditPolicy((p) => ({ ...p, [key]: value }));
  };

  const reasonRequired = lifecycleStatus === 'POSTED';
  const saveBlockedReason =
    saving || impactLoading
      ? 'Please wait…'
      : impactPreview == null
        ? 'Impact preview is still loading or failed. Go back and click Review impact again.'
        : reasonRequired && !saveReason.trim()
          ? 'Enter a reason for this policy change (required for posted courses).'
          : null;
  const canConfirmSave = saveBlockedReason == null;

  const showSettingsFooter = tab === 'settings' && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grading-policies-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 id="grading-policies-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {impactStep ? 'Review policy impact' : 'Grading policies'}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {impactStep
              ? 'Compare current vs proposed grades for every enrolled student before saving.'
              : 'Configure how this course calculates grades. Saving recalculates live totals for all enrolled students unless the course is finalized.'}
          </p>
          {courseId && !impactStep && (
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

        {impactStep ? (
          <div className="p-6">
            {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
            <div className="mb-6">
              <PolicyApplyModeSelector
                value={applyMode}
                onChange={(mode) => onApplyModeChange?.(mode)}
                lifecycleStatus={lifecycleStatus}
                disabled={impactLoading}
                assignments={impactAssignments}
                effectiveAssignmentId={effectiveAssignmentId}
                onEffectiveAssignmentChange={onEffectiveAssignmentChange}
              />
            </div>
            <PolicyImpactPreview
              impact={impactPreview}
              loading={impactLoading}
              lifecycleStatus={lifecycleStatus}
              applyMode={applyMode}
              saveReason={saveReason}
              onSaveReasonChange={onSaveReasonChange || (() => {})}
            />
          </div>
        ) : tab === 'effective' && courseId ? (
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
            {resolvedPolicy && (
              <div
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100"
                role="status"
              >
                <p>
                  <span className="font-medium">Currently calculating grades using:</span>{' '}
                  {missingModeLabel(resolvedPolicy.missingAssignment?.mode)}
                  {resolvedPolicy.policyApplication?.applyMode &&
                  resolvedPolicy.policyApplication.applyMode !== 'retroactive_all' ? (
                    <>
                      {' '}
                      · apply mode:{' '}
                      <span className="font-medium">
                        {resolvedPolicy.policyApplication.applyMode.replace(/_/g, ' ')}
                      </span>
                    </>
                  ) : null}
                </p>
                {resolvedPolicy.policyApplication?.legacyPolicy &&
                  resolvedPolicy.policyApplication.applyMode !== 'retroactive_all' && (
                    <p className="mt-2 text-amber-800 dark:text-amber-200">
                      Older assignments still use{' '}
                      <strong>
                        {missingModeLabel(
                          resolvedPolicy.policyApplication.legacyPolicy.missingAssignment?.mode
                        )}
                      </strong>{' '}
                      until you save with <strong>retroactive</strong> apply mode.
                    </p>
                  )}
                {dirty &&
                  editPolicy.missingAssignment?.mode !== resolvedPolicy.missingAssignment?.mode && (
                    <p className="mt-2 text-amber-800 dark:text-amber-200">
                      Your draft selection ({missingModeLabel(editPolicy.missingAssignment?.mode)})
                      is not saved yet. Review impact and save — use <strong>retroactive</strong>{' '}
                      apply mode to recalculate all missing work.
                    </p>
                  )}
              </div>
            )}

            {dirty && (
              <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
                You have unsaved policy changes. Review impact before saving.
              </p>
            )}

            <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <PolicyApplyModeSelector
                value={applyMode}
                onChange={(mode) => onApplyModeChange?.(mode)}
                lifecycleStatus={lifecycleStatus}
                disabled={impactLoading}
                assignments={impactAssignments}
                effectiveAssignmentId={effectiveAssignmentId}
                onEffectiveAssignmentChange={onEffectiveAssignmentChange}
              />
            </section>

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

            <PolicyDropRulesSection
              label="Drop lowest scores"
              policyKey="dropLowest"
              editPolicy={editPolicy}
              groupNames={groupNames}
              onUpdate={updateDropRules}
            />

            <PolicyDropRulesSection
              label="Drop highest scores"
              policyKey="dropHighest"
              editPolicy={editPolicy}
              groupNames={groupNames}
              onUpdate={updateDropRules}
            />

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
          </div>
        )}

        {impactStep ? (
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onBackFromImpact}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Back to settings
              </button>
              <button
                type="button"
                disabled={!canConfirmSave}
                title={saveBlockedReason || undefined}
                onClick={onSave}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm and save'}
              </button>
            </div>
            {saveBlockedReason ? (
              <p className="mt-2 text-right text-xs text-amber-700 dark:text-amber-300" role="status">
                {saveBlockedReason}
              </p>
            ) : null}
          </div>
        ) : (
          showSettingsFooter && (
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
                disabled={!canReviewImpact || impactLoading}
                onClick={onReviewImpact}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 disabled:opacity-50"
              >
                {impactLoading ? 'Calculating…' : 'Review impact'}
              </button>
              {!canReviewImpact && !impactLoading ? (
                <p className="mt-2 text-right text-xs text-gray-500 dark:text-gray-400">
                  On posted courses, change a policy setting or apply mode before reviewing impact.
                </p>
              ) : null}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GradingPolicyModal;
