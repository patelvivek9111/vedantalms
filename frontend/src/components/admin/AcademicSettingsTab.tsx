import React, { useEffect, useState } from 'react';
import {
  fetchAcademicSettings,
  updateAcademicSettings,
  applyInstitutionCalendarToCourses,
  type AcademicSettings,
} from '../../services/academicApi';
import { FormCheckboxOption } from '../common/FormControls';

export default function AcademicSettingsTab() {
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [presets, setPresets] = useState<Array<{ key: string; calendarType: string; periodCount: number }>>(
    []
  );
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await fetchAcademicSettings();
    if (res.success) {
      setSettings(res.data);
      setPresets(res.data.calendarPresets || []);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    try {
      await updateAcademicSettings(settings);
      setMessage('Academic settings saved.');
    } catch {
      setMessage('Could not save academic settings.');
    } finally {
      setSaving(false);
    }
  };

  const applyCalendar = async () => {
    setApplying(true);
    setMessage('');
    try {
      const res = await applyInstitutionCalendarToCourses();
      if (res.success) {
        setMessage(
          `Calendar applied to ${res.data?.coursesUpdated ?? 0} full-year course(s).`
        );
      }
    } catch {
      setMessage('Could not apply calendar to courses.');
    } finally {
      setApplying(false);
    }
  };

  if (!settings) {
    return <p className="text-sm text-gray-500">Loading academic settings…</p>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          {message}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Institution mode
        </label>
        <select
          value={settings.institutionMode}
          onChange={(e) =>
            setSettings((s) => ({
              ...s!,
              institutionMode: e.target.value as AcademicSettings['institutionMode'],
            }))
          }
          className="mt-1 w-full max-w-md rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
        >
          <option value="mixed">Mixed (school + college)</option>
          <option value="school">School (K-12)</option>
          <option value="college">College / university</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Sets defaults for new courses and which reporting terms appear on forms.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default schedule for new courses
          </label>
          <select
            value={settings.defaultScheduleType}
            onChange={(e) =>
              setSettings((s) => ({
                ...s!,
                defaultScheduleType: e.target.value as AcademicSettings['defaultScheduleType'],
              }))
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
          >
            <option value="single_term">Single term</option>
            <option value="full_year">Full year</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Calendar region
          </label>
          <select
            value={settings.calendarStyle}
            onChange={(e) =>
              setSettings((s) => ({
                ...s!,
                calendarStyle: e.target.value as AcademicSettings['calendarStyle'],
              }))
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
          >
            <option value="us">US (Aug–Jun)</option>
            <option value="india">India (Apr–Mar)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Grading period template
          </label>
          <select
            value={settings.calendarPreset}
            onChange={(e) =>
              setSettings((s) => ({ ...s!, calendarPreset: e.target.value as AcademicSettings['calendarPreset'] }))
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key.replace(/_/g, ' ')} ({p.periodCount} periods)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Academic year starts
          </label>
          <input
            type="number"
            min={2020}
            max={2100}
            value={settings.academicYearStart ?? ''}
            onChange={(e) =>
              setSettings((s) => ({
                ...s!,
                academicYearStart: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800"
            placeholder="e.g. 2025"
          />
        </div>
      </div>

      <FormCheckboxOption
        id="useInstitutionCalendar"
        checked={settings.useInstitutionCalendar}
        onChange={(e) =>
          setSettings((s) => ({ ...s!, useInstitutionCalendar: e.target.checked }))
        }
        title="Auto-apply institution calendar"
        description="New full-year courses get grading periods from the template above. Existing courses are unchanged unless you apply below."
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save academic settings'}
        </button>
        <button
          type="button"
          disabled={applying}
          onClick={() => void applyCalendar()}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {applying ? 'Applying…' : 'Apply calendar to all full-year courses'}
        </button>
      </div>
    </div>
  );
}
