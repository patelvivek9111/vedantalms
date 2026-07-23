import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { registrarGet, registrarPost, registrarPatch } from './registrarApi';
import { API_URL } from '../../config';
import { getMemoryAuthToken } from '../../utils/authToken';

type SisTab = 'import' | 'inbox' | 'jobs' | 'export' | 'config';

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
  const [config, setConfig] = useState<{
    provider?: string;
    syncDirection?: string;
    schedule?: string;
    isSourceOfTruth?: boolean;
  } | null>(null);

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
    const res = await registrarGet<{ data: typeof config }>('/api/registrar/sis/config');
    setConfig(res.data || null);
  };

  useEffect(() => {
    if (tab === 'inbox') void loadInbox().catch(() => setInbox([]));
    if (tab === 'jobs') void loadJobs().catch(() => setJobs([]));
    if (tab === 'config') void loadConfig().catch(() => setConfig(null));
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
    setError('');
    try {
      await registrarPatch(`/api/registrar/sis/staging/${id}`, {
        status: 'approved',
        overrideReason: conflict ? 'Registrar override after review' : undefined,
      });
      await loadInbox();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Approve failed'
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
      // If JSON slipped through, try parse for csvText
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
    await axios.put(
      `${API_URL}/api/registrar/sis/config`,
      config,
      { headers: { Authorization: `Bearer ${getMemoryAuthToken()}` } }
    );
    setMessage('SIS config saved');
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
    { id: 'config', label: 'Config' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        CSV-first SIS pipeline: stage users / sections / enrollments, review diffs, apply, then export
        finalized grades.
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
                        Approve{row.status === 'conflict' ? ' (override)' : ''}
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
            Export FINALIZED/AMENDED snapshots as grades.csv (sis_student_id, sis_section_id, final_grade, …).
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

      {tab === 'config' && config && (
        <section className="space-y-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 text-sm">
          <label className="block">
            Provider
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={config.provider || 'csv'}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
            >
              <option value="csv">csv</option>
              <option value="banner">banner (stub)</option>
              <option value="peoplesoft">peoplesoft (stub)</option>
              <option value="custom_rest">custom_rest (stub)</option>
            </select>
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
            <input
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={config.schedule || 'manual'}
              onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
              placeholder="manual (cron reserved)"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(config.isSourceOfTruth)}
              onChange={(e) => setConfig({ ...config, isSourceOfTruth: e.target.checked })}
            />
            SIS is source of truth
          </label>
          <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5" onClick={() => void saveConfig()}>
            Save config
          </button>
        </section>
      )}
    </div>
  );
}

export default RegistrarSis;
