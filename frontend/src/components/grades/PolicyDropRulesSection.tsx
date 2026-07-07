import React from 'react';
import type { GradingPolicyConfig } from '../../utils/gradeUtils';

type DropRule = { groupName: string; count: number };
type DropKey = 'dropLowest' | 'dropHighest';

interface PolicyDropRulesSectionProps {
  label: string;
  policyKey: DropKey;
  editPolicy: GradingPolicyConfig;
  groupNames: string[];
  onUpdate: (key: DropKey, value: NonNullable<GradingPolicyConfig[DropKey]>) => void;
}

export default function PolicyDropRulesSection({
  label,
  policyKey,
  editPolicy,
  groupNames,
  onUpdate,
}: PolicyDropRulesSectionProps) {
  const section = editPolicy[policyKey] || { enabled: false, rules: [] };
  const rules = section.rules || [];

  const setEnabled = (enabled: boolean) => {
    onUpdate(policyKey, { enabled, rules: enabled && rules.length === 0 && groupNames[0] ? [{ groupName: groupNames[0], count: 1 }] : rules });
  };

  const updateRule = (index: number, patch: Partial<DropRule>) => {
    const next = rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onUpdate(policyKey, { ...section, enabled: true, rules: next });
  };

  const addRule = () => {
    const groupName = groupNames[0] || '';
    onUpdate(policyKey, {
      ...section,
      enabled: true,
      rules: [...rules, { groupName, count: 1 }],
    });
  };

  const removeRule = (index: number) => {
    onUpdate(policyKey, { ...section, rules: rules.filter((_, i) => i !== index) });
  };

  return (
    <section className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <input type="checkbox" checked={!!section.enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {label}
      </label>
      {section.enabled && (
        <div className="ml-6 space-y-2">
          {rules.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Add a rule per assignment group.</p>
          )}
          {rules.map((rule, index) => (
            <div key={`${policyKey}-${index}`} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <label className="text-xs text-gray-600 dark:text-gray-400">Group</label>
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                  value={rule.groupName}
                  onChange={(e) => updateRule(index, { groupName: e.target.value })}
                >
                  {groupNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-600 dark:text-gray-400">Drop #</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-gray-800"
                  value={rule.count}
                  onChange={(e) => updateRule(index, { count: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRule(index)}
                className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRule}
            disabled={groupNames.length === 0}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
          >
            + Add rule
          </button>
        </div>
      )}
    </section>
  );
}
