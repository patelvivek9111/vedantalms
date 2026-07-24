import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { registrarGet, registrarPost, registrarPatch } from './registrarApi';
import { API_URL } from '../../config';
import { getMemoryAuthToken } from '../../utils/authToken';

type SisTab = 'import' | 'inbox' | 'jobs' | 'export' | 'config' | 'health';

type SyncRow = {
  _id: string;
  batchId: string;
  entityType: string;
  externalKey: string;
  status: string;
  proposed?: Record<string, unknown>;
  current?: Record<string, unknown> | null;
  diff?: { created?: boolean; fields?: Record<string, { from: unknown; to: unknown }> };
  applyError?: string;
  overrideReason?: string;
};

type SisJob = {
  _id: string;
  jobType: string;
  batchId: string;
  status: string;
  stagedCount?: number;
  appliedCount?: number;
  rejectedCount?: number;
  createdAt?: string;
};

type SisConfig = {
  provider?: string;
  syncDirection?: string;
  schedule?: string;
  isSourceOfTruth?: boolean;
  credentialsRef?: string;
  fieldMappings?: {
    users?: Record<string, string>;
    sections?: Record<string, string>;
    enrollments?: Record<string, string>;
    grades?: Record<string, string>;
  };
  lastSyncAt?: string | null;
  lastSyncStatus?: string;
  lastSyncError?: string;
  isActive?: boolean;
  notes?: string;
};

type SisHealth = {
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string;
  errorRate?: number;
  consecutiveFailures?: number;
  openConflicts?: number;
  openErrors?: number;
  schedule?: string;
  provider?: string;
  credentialsConfigured?: boolean;
  adapter?: { id: string; label: string; capabilities?: { pull?: boolean; push?: boolean } };
  recentJobs?: SisJob[];
};

const DEFAULT_MAP_HINT = {
  users: 'sis_id←id, email←email, first_name←givenName, last_name←familyName',
  sections: 'sis_section_id←crn, course_code←catalogNbr, term_code←term',
  enrollments: 'sis_student_id←emplid, sis_section_id←crn, status←status',
  grades: 'sis_student_id←emplid, final_grade←grade',
};

function parseMappingLine(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(line || '').split(',')) {
    const [lms, sis] = part.split('←').map((s) => s.trim());
    if (lms && sis) out[lms] = sis;
  }
  return out;
}

function formatMappingLine(map?: Record<string, string>): string {
  if (!map || !Object.keys(map).length) return '';
  return Object.entries(map)
    .map(([lms, sis]) => `${lms}←${sis}`)
    .join(', ');
}

function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RegistrarSis() {
  const [tab, setTab] = useState<SisTab>('import');
  const [kind, setKind] = useState<'users' | 'sections' | 'enrollments'>('users');
  const [csvText, setCsvText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inbox, setInbox] = useState<SyncRow[]>([]);
  const [jobs, setJobs] = useState<SisJob[]>([]);
  const [batchId, setBatchId] = useState('');
  const [term, setTerm] = useState('Fall');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [config, setConfig] = useState<SisConfig | null>(null);
  const [health, setHealth] = useState<SisHealth | null>(null);
  const [mapDraft, setMapDraft] = useState({
    users: '',
    sections: '',
    enrollments: '',
    grades: '',
  });
  const [conflictRow, setConflictRow] = useState<SyncRow | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);

  const loadInbox = async () => {
    const res = await registrarGet<{ data: SyncRow[] }>('/api/registrar/sis/staging', {
      inbox: 1,
      batchId: batchId || undefined,
    });
    setInbox(res.data || []);
  };

  const loadJobs = async () => {
    const res = await registrarGet<{ data: SisJob[] }>('/api/registrar/sis/jobs');
    setJobs(res.data || []);
  };

  const loadConfig = async () => {
    const res = await registrarGet<{ data: SisConfig }>('/api/registrar/sis/config');
    const cfg = res.data || null;
    setConfig(cfg);
    if (cfg?.fieldMappings) {
      setMapDraft({
        users: formatMappingLine(cfg.fieldMappings.users),
        sections: formatMappingLine(cfg.fieldMappings.sections),
        enrollments: formatMappingLine(cfg.fieldMappings.enrollments),
        grades: formatMappingLine(cfg.fieldMappings.grades),
      });
    }
  };

  const loadHealth = async () => {
    const res = await registrarGet<{ data: SisHealth }>('/api/registrar/sis/health');
    setHealth(res.data || null);
  };

  useEffect(() => {
    if (tab === 'inbox') void loadInbox().catch(() => setInbox([]));
    if (tab === 'jobs') void loadJobs().catch(() => setJobs([]));
    if (tab === 'config') void loadConfig().catch(() => setConfig(null));
    if (tab === 'health') void loadHealth().catch(() => setHealth(null));
  }, [tab]);

  const stageImport = async () => {
    setError('');
    setMessage('');
    try {
      const res = await registrarPost<{ data: { batchId: string; staged: number } }>(
        `/api/registrar/sis/import/${kind}`,
        { csvText, provider: 'csv' }
      );
      setMessage(`Staged ${res.data?.staged || 0} ${kind} rows (batch ${res.data?.batchId})`);
      setBatchId(res.data?.batchId || '');
      setTab('inbox');
      await loadInbox();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Import failed'
      );
    }
  };

  const approveRow = async (id: string, conflict: boolean) => {
    if (conflict) {
      const row = inbox.find((r) => r._id === id) || null;
      setConflictRow(row);
      setOverrideReason('');
      return;
    }
    setError('');
    try {
      await registrarPatch(`/api/registrar/sis/staging/${id}`, { status: 'approved' });
      await loadInbox();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Approve failed'
      );
    }
  };

  const confirmConflictOverride = async () => {
    if (!conflictRow) return;
    if (overrideReason.trim().length < 8) {
      setError('Override reason must be at least 8 characters');
      return;
    }
    setError('');
    try {
      await registrarPatch(`/api/registrar/sis/staging/${conflictRow._id}`, {
        status: 'approved',
        overrideReason: overrideReason.trim(),
      });
      setConflictRow(null);
      setOverrideReason('');
      await loadInbox();
      setMessage('Conflict overridden with audit reason');
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Override failed'
      );
    }
  };

  const rejectRow = async (id: string) => {
    await registrarPatch(`/api/registrar/sis/staging/${id}`, { status: 'rejected' });
    await loadInbox();
  };

  const applyBatch = async () => {
    if (!batchId) {
      setError('Set a batch ID first (from import or filter)');
      return;
    }
    setError('');
    try {
      const res = await registrarPost<{ data: { applied: number; rejected: number } }>(
        '/api/registrar/sis/apply',
        { batchId, approvePending: true }
      );
      setMessage(`Applied ${res.data?.applied ?? 0}, rejected ${res.data?.rejected ?? 0}`);
      await loadInbox();
      await loadJobs();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Apply failed'
      );
    }
  };

  const retryBatch = async () => {
    if (!batchId) {
      setError('Set a batch ID to retry');
      return;
    }
    setError('');
    try {
      const res = await registrarPost<{ data: { applied: number; rejected: number } }>(
        `/api/registrar/sis/batches/${encodeURIComponent(batchId)}/retry`,
        { approvePending: true }
      );
      setMessage(`Retry applied ${res.data?.applied ?? 0}, rejected ${res.data?.rejected ?? 0}`);
      await loadInbox();
      await loadJobs();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Retry failed'
      );
    }
  };

  const exportGrades = async () => {
    setError('');
    try {
      const token = getMemoryAuthToken();
      const url = `${API_URL}/api/registrar/sis/grades/export?term=${encodeURIComponent(term)}&year=${year}&format=csv`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
        transformResponse: [(d) => d],
      });
      let csv = typeof res.data === 'string' ? res.data : '';
      if (csv.startsWith('{')) {
        const parsed = JSON.parse(csv);
        csv = parsed.data?.csvText || '';
      }
      downloadText(`grades-${term}-${year}.csv`, csv);
      setMessage(`Downloaded grades.csv for ${term} ${year}`);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data
          ? typeof err.response.data === 'string'
            ? err.response.data
            : String((err.response.data as { message?: string }).message || 'Export failed')
          : 'Export failed'
      );
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    const fieldMappings = {
      users: parseMappingLine(mapDraft.users),
      sections: parseMappingLine(mapDraft.sections),
      enrollments: parseMappingLine(mapDraft.enrollments),
      grades: parseMappingLine(mapDraft.grades),
    };
    await axios.put(
      `${API_URL}/api/registrar/sis/config`,
      { ...config, fieldMappings },
      { headers: { Authorization: `Bearer ${getMemoryAuthToken()}` } }
    );
    setMessage('SIS config saved');
    await loadConfig();
  };

  const runSyncNow = async (dryRun: boolean) => {
    setSyncBusy(true);
    setError('');
    try {
      const res = await registrarPost<{ data: { ok?: boolean; batchIds?: string[]; message?: string } }>(
        '/api/registrar/sis/sync/run',
        {
          dryRun,
          direction: config?.syncDirection || 'import',
          term,
          year: Number(year),
        }
      );
      setMessage(
        dryRun
          ? `Dry-run sync finished (${res.data?.message || 'ok'})`
          : `Sync finished — batches: ${(res.data?.batchIds || []).join(', ') || 'none'}`
      );
      await loadConfig();
      await loadHealth();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Sync failed'
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const applyPreset = async () => {
    if (!config?.provider) return;
    try {
      const res = await registrarGet<{
        data: { id: string; mappings: Record<string, Record<string, string>> }[];
      }>('/api/registrar/sis/mapping-presets');
      const preset = (res.data || []).find((p) => p.id === config.provider);
      if (!preset?.mappings) {
        setMessage('No preset for this provider');
        return;
      }
      setMapDraft({
        users: formatMappingLine(preset.mappings.users),
        sections: formatMappingLine(preset.mappings.sections),
        enrollments: formatMappingLine(preset.mappings.enrollments),
        grades: formatMappingLine(preset.mappings.grades),
      });
      setMessage(`Loaded ${preset.id} field-mapping preset — save config to keep`);
    } catch {
      setError('Could not load mapping presets');
    }
  };

  const placeholders: Record<typeof kind, string> = {
    users: 'sis_id,email,first_name,last_name,role,student_id,program\nS001,stu@school.edu,Ada,Lovelace,student,ADM1,CS',
    sections:
      'sis_section_id,course_code,term_code,section,instructor_email,max_enrollment,title\nSEC1,CS101,FALL26,1,teach@school.edu,40,Intro CS',
    enrollments:
      'sis_enrollment_id,sis_section_id,sis_student_id,role,status\nE1,SEC1,S001,student,active',
  };

  const tabs: { id: SisTab; label: string }[] = [
    { id: 'import', label: 'Import' },
    { id: 'inbox', label: 'Staging inbox' },
    { id: 'jobs', label: 'Sync history' },
    { id: 'export', label: 'Export grades' },
    { id: 'health', label: 'Health' },
    { id: 'config', label: 'Config' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        CSV-first SIS pipeline with live connectors (custom REST, Banner, PeopleSoft, Fedena). Stage →
        review → apply; schedule via worker:sis-sync.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600'
            }`}
          >
            {t.label}
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

      {conflictRow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-lg w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 space-y-3 shadow-lg">
            <h3 className="font-medium text-sm">Override SIS conflict</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {conflictRow.entityType} · {conflictRow.externalKey}. Approving overwrites LMS values with
              proposed SIS data. Provide an audit reason (min 8 characters).
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <pre className="bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-auto max-h-40">
                Current:{'\n'}
                {JSON.stringify(conflictRow.current, null, 2)}
              </pre>
              <pre className="bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-auto max-h-40">
                Proposed:{'\n'}
                {JSON.stringify(conflictRow.proposed, null, 2)}
              </pre>
            </div>
            <textarea
              className="w-full min-h-[72px] rounded border px-2 py-1 text-sm dark:bg-gray-800"
              placeholder="Why is this override safe? (required)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() => setConflictRow(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-amber-600 text-white px-3 py-1.5 text-sm"
                onClick={() => void confirmConflictOverride()}
              >
                Confirm override
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <section className="space-y-3">
          <label className="text-sm block">
            File type
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="users">users.csv</option>
              <option value="sections">sections.csv</option>
              <option value="enrollments">enrollments.csv</option>
            </select>
          </label>
          <textarea
            className="w-full min-h-[160px] rounded border px-2 py-1 font-mono text-xs dark:bg-gray-800"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={placeholders[kind]}
          />
          <button type="button" onClick={() => void stageImport()} className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm">
            Stage import
          </button>
        </section>
      )}

      {tab === 'inbox' && (
        <section className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 items-end">
            <label>
              Batch ID
              <input
                className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              />
            </label>
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => void loadInbox()}>
              Refresh
            </button>
            <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5" onClick={() => void applyBatch()}>
              Apply batch
            </button>
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => void retryBatch()}>
              Retry failed
            </button>
          </div>
          <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
            {inbox.map((row) => (
              <li key={row._id} className="px-3 py-2 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    <strong>{row.entityType}</strong> · {row.externalKey} · {row.status}
                    {row.applyError ? ` · ${row.applyError}` : ''}
                  </span>
                  {(row.status === 'pending' || row.status === 'conflict') && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        className="text-blue-600"
                        onClick={() => void approveRow(row._id, row.status === 'conflict')}
                      >
                        Approve{row.status === 'conflict' ? ' (override…)' : ''}
                      </button>
                      <button type="button" className="text-red-600" onClick={() => void rejectRow(row._id)}>
                        Reject
                      </button>
                    </span>
                  )}
                </div>
                {row.diff?.fields && Object.keys(row.diff.fields).length > 0 && (
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-auto">
                    {JSON.stringify(row.diff.fields, null, 2)}
                  </pre>
                )}
                {row.diff?.created && <div className="text-xs text-gray-500">New record (create on apply)</div>}
              </li>
            ))}
            {!inbox.length && <li className="px-3 py-4 text-gray-500">No staging rows.</li>}
          </ul>
        </section>
      )}

      {tab === 'jobs' && (
        <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
          {jobs.map((j) => (
            <li key={j._id} className="px-3 py-2">
              {j.jobType} · batch {j.batchId} · {j.status} · staged {j.stagedCount ?? 0} · applied{' '}
              {j.appliedCount ?? 0} · rejected {j.rejectedCount ?? 0} ·{' '}
              {j.createdAt ? new Date(j.createdAt).toLocaleString() : ''}
            </li>
          ))}
          {!jobs.length && <li className="px-3 py-4 text-gray-500">No SIS jobs yet.</li>}
        </ul>
      )}

      {tab === 'export' && (
        <section className="space-y-3 border rounded-md p-4 border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export FINALIZED/AMENDED snapshots as grades.csv. Live connectors also POST when dry-run is
            off.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Term
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Year
              <input
                type="number"
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
          </div>
          <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm" onClick={() => void exportGrades()}>
            Download grades.csv
          </button>
        </section>
      )}

      {tab === 'health' && (
        <section className="space-y-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 text-sm">
          <button type="button" className="rounded border px-3 py-1.5" onClick={() => void loadHealth()}>
            Refresh health
          </button>
          {health ? (
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-xs text-gray-500">Provider</dt>
                <dd>{health.provider}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Schedule</dt>
                <dd>{health.schedule}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Last sync</dt>
                <dd>{health.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Last status</dt>
                <dd>{health.lastSyncStatus || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Error rate (last 20)</dt>
                <dd>{health.errorRate ?? 0}%</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Consecutive failures</dt>
                <dd>{health.consecutiveFailures ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Open conflicts</dt>
                <dd>{health.openConflicts ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Open errors</dt>
                <dd>{health.openErrors ?? 0}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">No health data.</p>
          )}
          {health?.lastSyncError ? (
            <p className="text-red-700 text-xs">{health.lastSyncError}</p>
          ) : null}
        </section>
      )}

      {tab === 'config' && config && (
        <section className="space-y-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 text-sm">
          <label className="block">
            Provider
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={config.provider || 'csv'}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
            >
              <option value="csv">csv (manual fallback)</option>
              <option value="custom_rest">custom_rest</option>
              <option value="banner">banner</option>
              <option value="peoplesoft">peoplesoft</option>
              <option value="fedena">fedena</option>
            </select>
          </label>
          <label className="block">
            Base URL / credentialsRef
            <input
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1 font-mono text-xs"
              value={config.credentialsRef || ''}
              onChange={(e) => setConfig({ ...config, credentialsRef: e.target.value })}
              placeholder="https://sis.example.edu/api/v1"
            />
          </label>
          <label className="block">
            Sync direction
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={config.syncDirection || 'bidirectional'}
              onChange={(e) => setConfig({ ...config, syncDirection: e.target.value })}
            >
              <option value="import">import</option>
              <option value="export">export</option>
              <option value="bidirectional">bidirectional</option>
            </select>
          </label>
          <label className="block">
            Schedule
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={config.schedule || 'manual'}
              onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
            >
              <option value="manual">manual</option>
              <option value="hourly">hourly (worker:sis-sync)</option>
              <option value="nightly">nightly (worker:sis-sync)</option>
            </select>
          </label>
          <fieldset className="space-y-2 border rounded p-3 border-gray-200 dark:border-gray-700">
            <legend className="px-1 text-xs font-medium">Field mappings (LMS←SIS)</legend>
            <button type="button" className="text-xs text-indigo-600" onClick={() => void applyPreset()}>
              Apply provider preset
            </button>
            {(['users', 'sections', 'enrollments', 'grades'] as const).map((entity) => (
              <label key={entity} className="block text-xs">
                {entity}
                <input
                  className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1 font-mono"
                  value={mapDraft[entity]}
                  onChange={(e) => setMapDraft({ ...mapDraft, [entity]: e.target.value })}
                  placeholder={DEFAULT_MAP_HINT[entity]}
                />
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(config.isSourceOfTruth)}
              onChange={(e) => setConfig({ ...config, isSourceOfTruth: e.target.checked })}
            />
            SIS is source of truth
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5" onClick={() => void saveConfig()}>
              Save config
            </button>
            <button
              type="button"
              disabled={syncBusy || config.provider === 'csv'}
              className="rounded border px-3 py-1.5 disabled:opacity-50"
              onClick={() => void runSyncNow(true)}
            >
              Dry-run sync
            </button>
            <button
              type="button"
              disabled={syncBusy || config.provider === 'csv'}
              className="rounded bg-emerald-700 text-white px-3 py-1.5 disabled:opacity-50"
              onClick={() => void runSyncNow(false)}
            >
              Run sync now
            </button>
          </div>
          {config.lastSyncAt && (
            <p className="text-xs text-gray-500">
              Last sync: {new Date(config.lastSyncAt).toLocaleString()} · {config.lastSyncStatus || '—'}
              {config.lastSyncError ? ` · ${config.lastSyncError}` : ''}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default RegistrarSis;
