import React, { useEffect, useState } from 'react';
import { DEFAULT_GRADING_POLICY, type GradingPolicyConfig } from '../../utils/gradeUtils';
import { fetchInstitutionGradingPolicy, saveInstitutionGradingPolicy } from '../../services/gradingApi';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import PolicyAuditHistory from '../grades/PolicyAuditHistory';

const InstitutionGradingPolicyTab: React.FC = () => {
  const [policy, setPolicy] = useState<GradingPolicyConfig>({ ...DEFAULT_GRADING_POLICY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchInstitutionGradingPolicy();
        if (res.success && res.data.policy) {
          setPolicy({ ...DEFAULT_GRADING_POLICY, ...res.data.policy });
          setDirty(false);
        }
      } catch {
        setMessage('Could not load institution grading defaults.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await saveInstitutionGradingPolicy(policy);
      setMessage('Institution grading defaults saved.');
      setDirty(false);
    } catch {
      setMessage('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Institution grading defaults</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Courses inherit these settings unless overridden. Changes apply to new grade calculations immediately.
        </p>
      </div>
      {message && <p className="text-sm text-blue-700 dark:text-blue-300">{message}</p>}
      <div>
        <label className="text-sm font-medium">Missing assignments</label>
        <select
          className="mt-1 block w-full max-w-md rounded border px-3 py-2 text-sm dark:bg-gray-900"
          value={policy.missingAssignment?.mode || 'count_as_zero'}
          onChange={(e) =>
            setPolicy((p) => ({
              ...p,
              missingAssignment: {
                mode: e.target.value as 'count_as_zero' | 'exclude_until_graded',
              },
            }))
          }
        >
          <option value="count_as_zero">Count as zero when past due</option>
          <option value="exclude_until_graded">Exclude until graded</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!policy.latePenalty?.enabled}
          onChange={(e) =>
            setPolicy((p) => ({
              ...p,
              latePenalty: { ...p.latePenalty!, enabled: e.target.checked },
            }))
          }
        />
        Enable late penalties by default
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save institution defaults'}
      </button>

      <section className="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Policy change history</h3>
        <p className="mt-1 text-xs text-gray-500">
          Institution changes do not alter frozen transcript snapshots for past terms.
        </p>
        <div className="mt-4">
          <PolicyAuditHistory entityType="institution" entityId="default" />
        </div>
      </section>
    </div>
  );
};

export default InstitutionGradingPolicyTab;
