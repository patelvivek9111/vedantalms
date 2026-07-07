import React from 'react';

export type PolicyApplyMode = 'retroactive_all' | 'prospective_only' | 'from_assignment';

export interface PolicyImpactAssignmentOption {
  id: string;
  title: string;
  group?: string;
}

interface PolicyApplyModeSelectorProps {
  value: PolicyApplyMode;
  onChange: (mode: PolicyApplyMode) => void;
  lifecycleStatus?: string;
  structuralChange?: boolean;
  disabled?: boolean;
  assignments?: PolicyImpactAssignmentOption[];
  effectiveAssignmentId?: string | null;
  onEffectiveAssignmentChange?: (assignmentId: string) => void;
}

const PolicyApplyModeSelector: React.FC<PolicyApplyModeSelectorProps> = ({
  value,
  onChange,
  lifecycleStatus = 'DRAFT',
  structuralChange = false,
  disabled = false,
  assignments = [],
  effectiveAssignmentId = null,
  onEffectiveAssignmentChange,
}) => {
  const nonRetroactiveDisabled = structuralChange || disabled;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        How should this change apply?
      </legend>

      <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <input
          type="radio"
          name="policy-apply-mode"
          className="mt-1"
          checked={value === 'retroactive_all'}
          disabled={disabled}
          onChange={() => onChange('retroactive_all')}
        />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Recalculate all grades (retroactive)
          </span>
          <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
            Every assignment uses the new policy rules immediately. Use when fixing a
            misconfiguration.
          </span>
        </span>
      </label>

      <label
        className={`flex gap-3 rounded-lg border p-3 ${
          nonRetroactiveDisabled
            ? 'cursor-not-allowed border-gray-200 opacity-60 dark:border-gray-700'
            : 'cursor-pointer border-gray-200 dark:border-gray-700'
        }`}
      >
        <input
          type="radio"
          name="policy-apply-mode"
          className="mt-1"
          checked={value === 'prospective_only'}
          disabled={nonRetroactiveDisabled}
          onChange={() => onChange('prospective_only')}
        />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Newly graded work only (prospective)
            {lifecycleStatus === 'POSTED' && (
              <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-300">
                Recommended for posted courses
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
            Work already graded keeps the policy that was in effect when it was graded.
            Ungraded and future work uses the new policy.
          </span>
          {structuralChange && (
            <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
              Not available when changing group weights or grade scale.
            </span>
          )}
        </span>
      </label>

      <label
        className={`flex gap-3 rounded-lg border p-3 ${
          nonRetroactiveDisabled
            ? 'cursor-not-allowed border-gray-200 opacity-60 dark:border-gray-700'
            : 'cursor-pointer border-gray-200 dark:border-gray-700'
        }`}
      >
        <input
          type="radio"
          name="policy-apply-mode"
          className="mt-1"
          checked={value === 'from_assignment'}
          disabled={nonRetroactiveDisabled}
          onChange={() => onChange('from_assignment')}
        />
        <span className="w-full">
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            From assignment forward
          </span>
          <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
            Assignments before the selected cutoff keep the previous policy; the cutoff
            assignment and later use the new policy.
          </span>
          {value === 'from_assignment' && assignments.length > 0 && (
            <select
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              value={effectiveAssignmentId || ''}
              disabled={nonRetroactiveDisabled}
              onChange={(e) => onEffectiveAssignmentChange?.(e.target.value)}
              aria-label="Cutoff assignment"
            >
              <option value="">Select cutoff assignment…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.group ? ` (${a.group})` : ''}
                </option>
              ))}
            </select>
          )}
          {value === 'from_assignment' && assignments.length === 0 && (
            <span className="mt-2 block text-xs text-gray-500">
              Run impact preview to load course assignments.
            </span>
          )}
        </span>
      </label>
    </fieldset>
  );
};

export default PolicyApplyModeSelector;
