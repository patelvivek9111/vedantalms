import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import InstitutionGradingPolicyTab from '../../components/admin/InstitutionGradingPolicyTab';
import {
  fetchAcademicSettings,
  updateAcademicSettings,
  type AcademicSettingsResponse,
} from '../../services/academicApi';
import { registrarGet, registrarPatch, registrarAuthHeaders, registrarUrl } from './registrarApi';

type Panel = 'grading' | 'calendar' | 'transcripts' | 'sis' | 'holds' | 'integrations' | 'links';

type TranscriptTemplate = {
  _id: string;
  name: string;
  isDefault?: boolean;
  locale?: string;
  gpaScale?: string;
};

type SisConfig = {
  provider?: string;
  schedule?: string;
  syncDirection?: string;
  isSourceOfTruth?: boolean;
};

const PANELS: { id: Panel; label: string }[] = [
  { id: 'grading', label: 'Grading defaults' },
  { id: 'calendar', label: 'Calendar & enrollment' },
  { id: 'transcripts', label: 'Transcript templates' },
  { id: 'sis', label: 'SIS schedule' },
  { id: 'holds', label: 'Hold defaults' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'links', label: 'Related tools' },
];

async function putSisConfig(body: Partial<SisConfig>) {
  const res = await axios.put(registrarUrl('/api/registrar/sis/config'), body, {
    headers: registrarAuthHeaders(),
  });
  return res.data as { success: boolean; data: SisConfig };
}

export function RegistrarSettings() {
  const [panel, setPanel] = useState<Panel>('grading');
  const [academic, setAcademic] = useState<AcademicSettingsResponse | null>(null);
  const [templates, setTemplates] = useState<TranscriptTemplate[]>([]);
  const [sis, setSis] = useState<SisConfig | null>(null);
  const [integrations, setIntegrations] = useState<{
    ltiAgs?: { enabled?: boolean; ready?: boolean; note?: string; missing?: string[] };
    erpHolds?: { configured?: boolean; deadLetterCount?: number; auth?: string };
    boardSubmit?: { mode?: string; canSubmit?: boolean; note?: string };
  } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [acad, tpl, cfg, integ] = await Promise.all([
        fetchAcademicSettings(),
        registrarGet<{ data: TranscriptTemplate[] }>('/api/registrar/transcripts/templates'),
        registrarGet<{ data: SisConfig }>('/api/registrar/sis/config').catch(() => ({ data: null })),
        registrarGet<{ data: typeof integrations }>('/api/registrar/integrations/status').catch(
          () => ({ data: null })
        ),
      ]);
      setAcademic(acad.data);
      setTemplates(tpl.data || []);
      setSis(cfg.data || null);
      setIntegrations(integ.data || null);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load settings'
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveAcademic = async (patch: Record<string, unknown>) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await updateAcademicSettings(patch as Parameters<typeof updateAcademicSettings>[0]);
      setAcademic(res.data as AcademicSettingsResponse);
      setMessage('Saved');
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const setDefaultTemplate = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await registrarPatch(`/api/registrar/transcripts/templates/${id}`, { isDefault: true });
      setMessage('Default transcript template updated');
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Could not set default template'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveSisSchedule = async (schedule: string) => {
    setSaving(true);
    setError('');
    try {
      const res = await putSisConfig({ schedule });
      setSis(res.data);
      setMessage(
        schedule === 'manual'
          ? 'SIS schedule set to manual'
          : 'SIS schedule saved — ensure worker:sis-sync runs on cron'
      );
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'SIS config save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const holdDefaults = academic?.holdDefaults || {
    holdType: 'registration',
    blocksRegistration: true,
    blocksTranscript: false,
    blocksGrades: false,
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Registrar settings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Institution defaults for grading, calendar, transcripts, holds, and SIS. Deep-links keep Programs,
          Accounts, and Admin as the single source of truth where noted.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPanel(p.id)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              panel === p.id
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {panel === 'grading' && (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden [&_.p-6]:p-4">
          <InstitutionGradingPolicyTab />
        </div>
      )}

      {panel === 'calendar' && academic && (
        <div className="space-y-4 text-sm border rounded-md p-4 border-gray-200 dark:border-gray-700">
          <label className="block max-w-xs">
            Calendar style
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={academic.calendarStyle || 'us'}
              disabled={saving}
              onChange={(e) =>
                void saveAcademic({
                  calendarStyle: e.target.value as 'us' | 'india',
                  calendarPreset: e.target.value === 'india' ? 'india_terms' : 'us_quarters',
                })
              }
            >
              <option value="us">US</option>
              <option value="india">India</option>
            </select>
          </label>
          <label className="block max-w-xs">
            Institution mode
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={academic.institutionMode || 'mixed'}
              disabled={saving}
              onChange={(e) => void saveAcademic({ institutionMode: e.target.value as AcademicSettingsResponse['institutionMode'] })}
            >
              <option value="mixed">Mixed</option>
              <option value="college">College</option>
              <option value="school">School</option>
            </select>
          </label>
          <label className="block max-w-xs">
            Default enrollment method (new sections)
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={(academic as AcademicSettingsResponse & { defaultEnrollmentMethod?: string }).defaultEnrollmentMethod || 'open'}
              disabled={saving}
              onChange={(e) => void saveAcademic({ defaultEnrollmentMethod: e.target.value } as never)}
            >
              <option value="open">Open</option>
              <option value="approval">Approval</option>
              <option value="registrar_only">Registrar only</option>
              <option value="sis_only">SIS only</option>
            </select>
          </label>
          <p className="text-gray-500">
            Full calendar presets and apply-to-courses live in{' '}
            <Link className="text-blue-600 hover:underline" to="/admin/settings">
              Admin system settings
            </Link>
            .
          </p>
        </div>
      )}

      {panel === 'transcripts' && (
        <div className="space-y-3 text-sm border rounded-md p-4 border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">
            Set the default template used for official issue and bulk ZIP jobs. Edit layouts under Transcripts.
          </p>
          <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
            {templates.map((t) => (
              <li key={t._id} className="px-3 py-2 flex justify-between gap-2 items-center">
                <div>
                  <div className="font-medium">
                    {t.name}
                    {t.isDefault ? <span className="text-emerald-600 font-normal"> · default</span> : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t.locale || 'en'} · {t.gpaScale || 'gpa'}
                  </div>
                </div>
                {!t.isDefault && (
                  <button
                    type="button"
                    className="text-blue-600"
                    disabled={saving}
                    onClick={() => void setDefaultTemplate(t._id)}
                  >
                    Make default
                  </button>
                )}
              </li>
            ))}
            {!templates.length && <li className="px-3 py-3 text-gray-500">No templates yet.</li>}
          </ul>
          <Link className="text-blue-600 hover:underline" to="/registrar/transcripts?tab=templates">
            Manage templates →
          </Link>
        </div>
      )}

      {panel === 'sis' && (
        <div className="space-y-3 text-sm border rounded-md p-4 border-gray-200 dark:border-gray-700 max-w-lg">
          <p className="text-gray-600 dark:text-gray-400">
            Provider: <strong>{sis?.provider || 'csv'}</strong>
            {sis?.syncDirection ? ` · direction ${sis.syncDirection}` : ''}
          </p>
          <label className="block">
            Sync schedule
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={sis?.schedule || 'manual'}
              disabled={saving}
              onChange={(e) => void saveSisSchedule(e.target.value)}
            >
              <option value="manual">Manual only</option>
              <option value="hourly">Hourly (npm run worker:sis-sync -- --apply)</option>
              <option value="nightly">Nightly (npm run worker:sis-sync -- --apply)</option>
            </select>
          </label>
          <Link className="text-blue-600 hover:underline" to="/registrar/sis?tab=config">
            Open full SIS config →
          </Link>
        </div>
      )}

      {panel === 'holds' && academic && (
        <div className="space-y-3 text-sm border rounded-md p-4 border-gray-200 dark:border-gray-700 max-w-lg">
          <p className="text-gray-600 dark:text-gray-400">
            Defaults used when placing holds from Operations (UI presets). Place/release still happens on the
            Operations or Student page.
          </p>
          <label className="block">
            Default hold type
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={holdDefaults.holdType || 'registration'}
              disabled={saving}
              onChange={(e) =>
                void saveAcademic({
                  holdDefaults: { ...holdDefaults, holdType: e.target.value },
                } as never)
              }
            >
              <option value="registration">registration</option>
              <option value="transcript">transcript</option>
              <option value="grade">grade</option>
              <option value="financial">financial</option>
              <option value="disciplinary">disciplinary</option>
              <option value="other">other</option>
            </select>
          </label>
          {(
            [
              ['blocksRegistration', 'Blocks registration'],
              ['blocksTranscript', 'Blocks transcript'],
              ['blocksGrades', 'Blocks grades'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(holdDefaults[key])}
                disabled={saving}
                onChange={(e) =>
                  void saveAcademic({
                    holdDefaults: { ...holdDefaults, [key]: e.target.checked },
                  } as never)
                }
              />
              {label}
            </label>
          ))}
          <Link
            className="text-blue-600 hover:underline inline-block"
            to={`/registrar/operations?holdType=${encodeURIComponent(holdDefaults.holdType || 'registration')}`}
          >
            Place a hold in Operations →
          </Link>
        </div>
      )}

      {panel === 'integrations' && (
        <div className="space-y-3 text-sm border rounded-md p-4 border-gray-200 dark:border-gray-700 max-w-xl">
          <p className="text-gray-600 dark:text-gray-400">
            Live readiness for LTI AGS, ERP hold webhooks, and India board partner submit. Configure via
            environment (see .env.example).
          </p>
          {integrations ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs uppercase text-gray-500">LTI AGS</dt>
                <dd>
                  {integrations.ltiAgs?.ready
                    ? 'Ready for line-item score passback'
                    : integrations.ltiAgs?.enabled
                      ? `Enabled — missing ${(integrations.ltiAgs.missing || []).join(', ') || 'config'}`
                      : 'Off (set LTI_AGS_ENABLED=true)'}
                  {integrations.ltiAgs?.note ? (
                    <div className="text-xs text-gray-500 mt-1">{integrations.ltiAgs.note}</div>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500">ERP holds webhook</dt>
                <dd>
                  {integrations.erpHolds?.configured
                    ? 'Secret configured (HMAC or shared secret)'
                    : 'ERP_HOLDS_WEBHOOK_SECRET not set'}
                  {(integrations.erpHolds?.deadLetterCount || 0) > 0
                    ? ` · ${integrations.erpHolds?.deadLetterCount} dead-letter events`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500">Board / UDISE submit</dt>
                <dd>
                  {integrations.boardSubmit?.canSubmit
                    ? 'Partner webhook enabled'
                    : 'Export-only CSV (default)'}
                  {integrations.boardSubmit?.note ? (
                    <div className="text-xs text-gray-500 mt-1">{integrations.boardSubmit.note}</div>
                  ) : null}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">Could not load integration status.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link className="text-blue-600 hover:underline" to="/registrar/sis">
              SIS office →
            </Link>
            <Link className="text-blue-600 hover:underline" to="/registrar/reports">
              India reports →
            </Link>
            <span className="text-xs text-gray-500">
              Presets: docs/registrar/PARTNER_FIELD_MAPPING_PRESETS.md
            </span>
          </div>
        </div>
      )}

      {panel === 'links' && (
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>
            <Link className="text-blue-600 hover:underline" to="/registrar/programs">
              Programs
            </Link>{' '}
            — degree / stream catalog
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" to="/admin/settings">
              Admin system settings
            </Link>{' '}
            — full academic calendar & institution tools
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" to="/admin/accounts">
              Sub-accounts
            </Link>{' '}
            — department tree
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" to="/registrar/operations">
              Operations
            </Link>{' '}
            — holds & enrollment tools
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" to="/registrar/sis">
              SIS office
            </Link>{' '}
            — import inbox & grade export
          </li>
        </ul>
      )}
    </div>
  );
}

export default RegistrarSettings;
