import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import { getMemoryAuthToken } from '../utils/authToken';
import { MobileAppShell } from '../components/common/MobileAppShell';
import { useAuth } from '../contexts/AuthContext';

type StudentEmailMode = 'auto-generate' | 'already-provided';

type Institution = {
  _id: string;
  name: string;
  code: string;
  institutionMode?: string;
  timezone?: string;
  planCode?: string;
  workflowState?: string;
  domain?: string;
  studentEmailMode?: StudentEmailMode;
  createdAt?: string;
};

type EmailDraft = {
  studentEmailMode: StudentEmailMode;
  domain: string;
};

function authHeaders() {
  return { Authorization: `Bearer ${getMemoryAuthToken()}` };
}

function activationEnabled(mode: StudentEmailMode, domain: string) {
  return mode === 'auto-generate' && Boolean(domain.trim());
}

const emptyForm = {
  name: '',
  code: '',
  host: '',
  institutionMode: 'school',
  timezone: 'UTC',
  adminEmail: '',
  adminPassword: '',
  adminFirstName: 'Institution',
  adminLastName: 'Admin',
  planCode: 'standard',
};

export function AdminPlatformInstitutions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Institution[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [emailDrafts, setEmailDrafts] = useState<Record<string, EmailDraft>>({});
  const [savingEmailId, setSavingEmailId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = user?.role === 'platform_admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/platform/accounts`, { headers: authHeaders() });
      const data = (res.data?.data || []) as Institution[];
      setRows(data);
      const drafts: Record<string, EmailDraft> = {};
      for (const row of data) {
        drafts[row._id] = {
          studentEmailMode: row.studentEmailMode === 'auto-generate' ? 'auto-generate' : 'already-provided',
          domain: row.domain || '',
        };
      }
      setEmailDrafts(drafts);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load institutions (need platform_admin)'
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        host: form.host.trim() || undefined,
        institutionMode: form.institutionMode,
        timezone: form.timezone || 'UTC',
        adminEmail: form.adminEmail.trim() || undefined,
        adminPassword: form.adminPassword || undefined,
        adminFirstName: form.adminFirstName.trim() || 'Institution',
        adminLastName: form.adminLastName.trim() || 'Admin',
        planCode: form.planCode || 'standard',
      };
      const res = await axios.post(`${API_URL}/api/platform/accounts`, body, {
        headers: authHeaders(),
      });
      setMessage(
        `Created ${res.data?.data?.account?.name || body.name} (${res.data?.data?.account?.code || body.code})`
      );
      setForm(emptyForm);
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Create failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const patchMode = async (id: string, institutionMode: string) => {
    try {
      await axios.patch(
        `${API_URL}/api/platform/accounts/${id}`,
        { institutionMode },
        { headers: authHeaders() }
      );
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Update failed'
      );
    }
  };

  const saveEmailSettings = async (id: string) => {
    if (!canManage) return;
    const draft = emailDrafts[id];
    if (!draft) return;
    setSavingEmailId(id);
    setError('');
    setMessage('');
    try {
      await axios.patch(
        `${API_URL}/api/platform/accounts/${id}`,
        {
          studentEmailMode: draft.studentEmailMode,
          domain: draft.domain.trim().toLowerCase(),
        },
        { headers: authHeaders() }
      );
      setMessage('Student email settings saved');
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to save student email settings'
      );
    } finally {
      setSavingEmailId(null);
    }
  };

  return (
    <MobileAppShell title="Institutions">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              Platform
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Institutions</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Canvas-style multi-tenant: each institution is a root Account in the same database,
              isolated by <code className="text-xs">rootAccountId</code>. Your current demo data lives
              under the Example / DEFAULT institution.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Home
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <form
          onSubmit={create}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="sm:col-span-2 lg:col-span-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Add institution
          </h2>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Springfield High"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Code
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase dark:border-slate-600 dark:bg-slate-950"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
              placeholder="SPRINGFIELD"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Host (optional)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              placeholder="springfield.localhost"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Mode
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={form.institutionMode}
              onChange={(e) => setForm((f) => ({ ...f, institutionMode: e.target.value }))}
            >
              <option value="school">School</option>
              <option value="college">College</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Admin email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={form.adminEmail}
              onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
              placeholder="admin@school.edu"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Admin password
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={form.adminPassword}
              onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
              placeholder="Min 8 characters"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving || !canManage}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              {saving ? 'Creating…' : 'Create institution'}
            </button>
            {!canManage && (
              <p className="mt-2 text-xs text-amber-700">Only platform_admin can create institutions.</p>
            )}
          </div>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              All institutions {loading ? '…' : `(${rows.length})`}
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => {
              const draft = emailDrafts[row._id] || {
                studentEmailMode: 'already-provided' as StudentEmailMode,
                domain: '',
              };
              const activateOn = activationEnabled(draft.studentEmailMode, draft.domain);
              return (
                <li key={row._id} className="px-4 py-4 space-y-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">
                        {row.name}{' '}
                        <span className="text-xs font-normal text-slate-500">({row.code})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {row.workflowState || 'active'} · plan {row.planCode || 'standard'} · id{' '}
                        <code>{row._id}</code>
                      </div>
                    </div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">
                      Mode
                      <select
                        className="ml-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={row.institutionMode || 'mixed'}
                        onChange={(e) => void patchMode(row._id, e.target.value)}
                        disabled={!canManage}
                        title="Same setting as Registrar → Settings → Institution mode"
                      >
                        <option value="school">school</option>
                        <option value="college">college</option>
                        <option value="mixed">mixed</option>
                      </select>
                    </label>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Student email / activation
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          activateOn
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        title={
                          activateOn
                            ? '/activate is reachable for this institution'
                            : '/activate is not available until auto-generate mode has a domain'
                        }
                      >
                        {activateOn ? '/activate enabled' : '/activate off'}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Student email mode
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                          value={draft.studentEmailMode}
                          disabled={!canManage}
                          onChange={(e) =>
                            setEmailDrafts((prev) => ({
                              ...prev,
                              [row._id]: {
                                ...draft,
                                studentEmailMode: e.target.value as StudentEmailMode,
                              },
                            }))
                          }
                        >
                          <option value="already-provided">Already provided (SIS import)</option>
                          <option value="auto-generate">Auto-generate (self-service activation)</option>
                        </select>
                      </label>
                      {draft.studentEmailMode === 'auto-generate' && (
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Email domain
                          <input
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                            value={draft.domain}
                            disabled={!canManage}
                            placeholder="lincolnhigh.edu"
                            onChange={(e) =>
                              setEmailDrafts((prev) => ({
                                ...prev,
                                [row._id]: { ...draft, domain: e.target.value },
                              }))
                            }
                          />
                        </label>
                      )}
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={!canManage || savingEmailId === row._id}
                          onClick={() => void saveEmailSettings(row._id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
                        >
                          {savingEmailId === row._id ? 'Saving…' : 'Save email settings'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auto-generate lets students claim accounts at <code>/activate</code> using a
                      pre-loaded roster. Already-provided means school emails come from the SIS users
                      import instead.
                    </p>
                  </div>
                </li>
              );
            })}
            {!loading && !rows.length && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">No institutions yet.</li>
            )}
          </ul>
        </section>

        <p className="text-xs text-slate-500">
          Mode (school / college / mixed) is one shared setting per institution — Platform and
          Registrar Settings edit the same value. After create: point DNS/host to this app, log in as
          the new admin on that host. Existing localhost data stays on the DEFAULT / MySL8TE root.
        </p>
      </div>
    </MobileAppShell>
  );
}

export default AdminPlatformInstitutions;
