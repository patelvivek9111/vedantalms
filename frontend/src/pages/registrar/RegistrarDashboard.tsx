import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { registrarGet } from './registrarApi';

type DashboardData = {
  enrollments: { total: number; byStatus: { _id: string; count: number }[] };
  activeHolds: number;
  sisErrors: number;
  sisHealth?: {
    lastSyncAt?: string | null;
    lastSyncStatus?: string | null;
    errorRate?: number;
    consecutiveFailures?: number;
    openConflicts?: number;
    schedule?: string;
    provider?: string;
  } | null;
  activeTerms: number;
  gradeStatus: { coursesLinked: number; finalized: number; unfinalized: number };
};

type IntegrationsStatus = {
  ltiAgs?: { enabled?: boolean; ready?: boolean; note?: string; missing?: string[] };
  erpHolds?: { configured?: boolean; deadLetterCount?: number; auth?: string };
  boardSubmit?: { mode?: string; canSubmit?: boolean; note?: string };
  sis?: { provider?: string; schedule?: string; lastSyncStatus?: string | null };
};

export function RegistrarDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [dash, integ] = await Promise.all([
          registrarGet<{ data: DashboardData }>('/api/registrar/dashboard'),
          registrarGet<{ data: IntegrationsStatus }>('/api/registrar/integrations/status').catch(
            () => ({ data: null })
          ),
        ]);
        if (!cancelled) {
          setData(dash.data);
          setIntegrations(integ.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Failed to load dashboard'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800">
        {error}
      </div>
    );
  }

  const cards = [
    { label: 'Enrollments', value: data?.enrollments.total ?? 0, to: '/registrar/operations' },
    { label: 'Active holds', value: data?.activeHolds ?? 0, to: '/registrar/operations' },
    { label: 'SIS issues', value: data?.sisErrors ?? 0, to: '/registrar/sis' },
    { label: 'Active / grading terms', value: data?.activeTerms ?? 0, to: '/registrar/terms' },
    { label: 'Unfinalized courses', value: data?.gradeStatus.unfinalized ?? 0, to: '/registrar/grades' },
    { label: 'Finalized courses', value: data?.gradeStatus.finalized ?? 0, to: '/registrar/grades' },
  ];

  const sis = data?.sisHealth;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 hover:border-indigo-400 transition-colors"
          >
            <div className="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{c.value}</div>
          </Link>
        ))}
      </div>

      {sis && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">SIS sync health</h2>
            <Link to="/registrar/sis" className="text-xs text-indigo-600">
              Open SIS / retry →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">Provider / schedule</div>
              <div>
                {sis.provider || '—'} · {sis.schedule || 'manual'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last run</div>
              <div>{sis.lastSyncAt ? new Date(sis.lastSyncAt).toLocaleString() : 'Never'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status / error rate</div>
              <div>
                {sis.lastSyncStatus || '—'} · {sis.errorRate ?? 0}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Conflicts / failures</div>
              <div>
                {sis.openConflicts ?? 0} open · {sis.consecutiveFailures ?? 0} streak
              </div>
            </div>
          </div>
        </section>
      )}

      {integrations && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Integration status</h2>
            <Link to="/registrar/settings" className="text-xs text-indigo-600">
              Settings →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">LTI AGS</div>
              <div>
                {integrations.ltiAgs?.ready
                  ? 'Ready'
                  : integrations.ltiAgs?.enabled
                    ? 'Enabled (incomplete)'
                    : 'Off'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ERP holds</div>
              <div>
                {integrations.erpHolds?.configured ? 'Secret set' : 'Not configured'}
                {(integrations.erpHolds?.deadLetterCount || 0) > 0
                  ? ` · ${integrations.erpHolds?.deadLetterCount} DLQ`
                  : ''}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Board submit</div>
              <div>
                {integrations.boardSubmit?.canSubmit
                  ? 'Partner webhook'
                  : integrations.boardSubmit?.mode || 'export_only'}
              </div>
            </div>
          </div>
        </section>
      )}

      {(data?.enrollments.byStatus || []).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enrollment by status</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {data!.enrollments.byStatus.map((row) => (
              <span key={row._id} className="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1">
                {row._id}: <strong>{row.count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-3 text-sm">
        <Link className="text-blue-600 hover:underline" to="/registrar/terms">
          Manage terms
        </Link>
        <Link className="text-blue-600 hover:underline" to="/registrar/students">
          Search students
        </Link>
        <Link className="text-blue-600 hover:underline" to="/registrar/transcripts">
          Issue transcript
        </Link>
        <Link className="text-blue-600 hover:underline" to="/registrar/reports">
          Reports
        </Link>
      </section>
    </div>
  );
}

export default RegistrarDashboard;
